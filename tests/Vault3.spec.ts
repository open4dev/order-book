import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault3 } from '../wrappers/Vault3';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { getOrderWrapper } from './Helper';


// it is NOT jetton wallet code
// jetton master: EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT
const jettonWalletCodeOfVault3 = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")

describe('Vault3', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;


    beforeAll(async () => {
        code = await compile('Vault3');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<Vault3>;
    let vaultJetton: SandboxContract<Vault3>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;
    let mockJettonMinter: SandboxContract<TreasuryContract>;
    let mockJettonMinter2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');
        mockJettonMinter = await blockchain.treasury('mockJettonMinter');
        mockJettonMinter2 = await blockchain.treasury('mockJettonMinter2');

        // Vault for TON (fromJetton = undefined)
        vaultTon = blockchain.openContract(Vault3.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: undefined,
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: undefined,
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));

        // Vault for Jetton (fromJetton != undefined)
        vaultJetton = blockchain.openContract(Vault3.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeOfVault3,
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: {
                jettonMinter: mockJettonMinter.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));
    });

    it('should deploy', async () => {
        const deployResult = await vaultJetton.sendDeploy(mockVaultFactory.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultJetton.address,
            deploy: true,
            success: true,
        });
    });

    // ==================== InitVault Tests ====================

    it('(Vault3) Send init Success', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: true,
        });
    });

    it('(Vault3) Send init From not Vault Factory address - should fail with 403', async () => {
        const sendInitResult = await vaultTon.sendInitVault(deployer.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTon.address,
            success: false,
            exitCode: 403,
        });
    });

    it('(Vault3) Send init with not enough value - should fail with 422', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.005'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });
    });

    // ==================== TonTransfer Tests ====================

    it('(Vault3) Ton Transfer (ton-jetton)(createOrder) - Success', async () => {
        const vaultTonInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: true,
        });

        // check create order transaction
        expect(transferTonResult.transactions).toHaveTransaction({
            from: vaultTon.address,
            success: true,
            op: 0x2d0e1e1b, // InitOrder opcode
        });

        const endVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;
        expect(endVaultBalance).toEqual(toNano(1.01)); // 1 USER TON + 0.01 GAS STORAGE
    });

    it('(Vault3) Ton Transfer (ton-jetton)(createOrder) - not enough value - should fail with 422', async () => {
        const vaultTonInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(0.01 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006), // Not enough for amount
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });

        // check create order transaction was NOT sent
        expect(transferTonResult.transactions).not.toHaveTransaction({
            from: vaultTon.address,
            success: true,
            op: 0x2d0e1e1b,
        });
    });

    it('(Vault3) Ton Transfer to jetton vault - fromJetton != null - should fail with 432', async () => {
        const vaultJettonInitResult = await vaultJetton.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const transferTonResult = await vaultJetton.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultJetton.address,
            success: false,
            exitCode: 432, // ERR_VAULT_ALREADY_HAS_JETTON
        });

        // check create order transaction was NOT sent
        expect(transferTonResult.transactions).not.toHaveTransaction({
            from: vaultJetton.address,
            success: true,
            op: 0x2d0e1e1b,
        });
    });

    // ==================== Getter Tests ====================

    it('(Vault3) getData returns correct values', async () => {
        await vaultJetton.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const data = await vaultJetton.getData();

        expect(data.vaultFactory.equals(mockVaultFactory.address)).toBe(true);
        expect(data.amount).toBe(BigInt(0));
    });

    it('(Vault3) getCodes returns correct values', async () => {
        await vaultJetton.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const codes = await vaultJetton.getCodes();

        expect(codes.jettonWalletCode).toBeDefined();
        expect(codes.orderCode).toBeDefined();
    });

    // ==================== Order Creation and Amount Tracking ====================

    it('(Vault3) Multiple TON transfers accumulate amount correctly', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        // First transfer
        await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.05),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        const data1 = await vaultTon.getData();
        expect(data1.amount).toBe(toNano(1));

        // Second transfer
        await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2 + 0.05),
            {
                amount: toNano(2),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        const data2 = await vaultTon.getData();
        expect(data2.amount).toBe(toNano(3)); // 1 + 2
    });

    it('(Vault3) Order is created with correct parameters', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.05),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        // Verify order was created
        const order = getOrderWrapper(blockchain, transferTonResult, vaultTon.address);
        const orderData = await order.getData();

        expect(orderData.owner.equals(user1.address)).toBe(true);
        expect(orderData.vault.equals(vaultTon.address)).toBe(true);
        expect(orderData.exchangeInfo.amount).toBe(toNano(1));
        expect(orderData.exchangeInfo.priceRate).toBe(toNano(2));
    });

    // ==================== Vault3 Specific - Different StateInit Format ====================

    it('(Vault3) Deploys with raw stateInit cell format', async () => {
        // Vault3 uses a different calculateJettonWallet implementation
        // that uses raw stateInit cell format for NOT, BUILD, USDT tokens
        const deployResult = await vaultJetton.sendDeploy(mockVaultFactory.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultJetton.address,
            deploy: true,
            success: true,
        });

        // Verify the vault is properly initialized
        const data = await vaultJetton.getData();
        expect(data.vaultFactory.equals(mockVaultFactory.address)).toBe(true);
    });

    it('(Vault3) Can handle significant order amounts', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const significantAmount = toNano(100); // 100 TON - reasonable test amount

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            significantAmount + toNano(0.05),
            {
                amount: significantAmount,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: mockJettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        );

        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: true,
        });

        const data = await vaultTon.getData();
        expect(data.amount).toBe(significantAmount);
    });
});
