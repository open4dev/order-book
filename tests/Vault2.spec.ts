import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault2 } from '../wrappers/Vault2';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { getOrderWrapper } from './Helper';


// it is anon jetton wallet code
// jetton master: EQDv-yr41_CZ2urg2gfegVfa44PDPjIK9F-MilEDKDUIhlwZ
const jettonWalletCodeOfVault2 = Cell.fromHex("b5ee9c7201021101000323000114ff00f4a413f4bcf2c80b0102016202030202cc0405001ba0f605da89a1f401f481f481a8610201d40607020120080900c30831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc2000113e910c1c2ebcb853600201200a0b0083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa401f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80c0201200d0e009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5402f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600f1000d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed54")

describe('Vault2', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('Vault2');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<Vault2>;
    let vaultJetton: SandboxContract<Vault2>;
    let mockJettonMinter: SandboxContract<TreasuryContract>;
    let mockJettonMinter2: SandboxContract<TreasuryContract>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        mockJettonMinter = await blockchain.treasury('mockJettonMinter');
        mockJettonMinter2 = await blockchain.treasury('mockJettonMinter2');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');

        // Vault for TON (fromJetton = undefined)
        vaultTon = blockchain.openContract(Vault2.createFromConfig({
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
        vaultJetton = blockchain.openContract(Vault2.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeOfVault2,
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

    it('(Vault2) Send init Success', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: true,
        });
    });

    it('(Vault2) Send init From not Vault Factory address - should fail with 403', async () => {
        const sendInitResult = await vaultTon.sendInitVault(deployer.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTon.address,
            success: false,
            exitCode: 403,
        });
    });

    it('(Vault2) Send init with not enough value - should fail with 422', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.005'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });
    });

    // ==================== TonTransfer Tests ====================

    it('(Vault2) Ton Transfer (ton-jetton)(createOrder) - Success', async () => {
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

    it('(Vault2) Ton Transfer (ton-jetton)(createOrder) - not enough value - should fail with 422', async () => {
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

    it('(Vault2) Ton Transfer to jetton vault - fromJetton != null - should fail with 432', async () => {
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

    it('(Vault2) getData returns correct values', async () => {
        await vaultJetton.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const data = await vaultJetton.getData();

        expect(data.vaultFactory.equals(mockVaultFactory.address)).toBe(true);
        expect(data.amount).toBe(BigInt(0));
    });

    it('(Vault2) getCodes returns correct values', async () => {
        await vaultJetton.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const codes = await vaultJetton.getCodes();

        expect(codes.jettonWalletCode).toBeDefined();
        expect(codes.orderCode).toBeDefined();
    });

    // ==================== Order Creation and Amount Tracking ====================

    it('(Vault2) Multiple TON transfers accumulate amount correctly', async () => {
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

    it('(Vault2) Order is created with correct parameters', async () => {
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
});
