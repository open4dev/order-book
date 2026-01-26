import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { VaultTon } from '../wrappers/VaultTon';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { GAS_CREATE_ORDER_TON, GAS_CREATE_ORDER_JETTON, GAS_EXCESS, GAS_STORAGE, GAS_ORDER_FULL_MATCH, GAS_ORDER_CLOSE_ORDER, GAS_FEE_COLLECTOR_WITHDRAW, getOrderWrapper, getFeeCollectorWrapper, getJettonWalletWrapper, mapOpcode } from './Helper';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';

describe('VaultTon', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('VaultTon');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<VaultTon>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;
    let jettonMinter1: SandboxContract<JettonMinter>;
    let jettonMinter2: SandboxContract<JettonMinter>;
    let vaultJetton1: SandboxContract<Vault>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');

        jettonMinter1 = blockchain.openContract(JettonMinter.createFromConfig({
            admin: deployer.address,
            wallet_code: jettonWalletCodeCell,
            jetton_content: {
                uri: 'jetton1'
            }
        }, jettonMinterCodeCell));

        jettonMinter2 = blockchain.openContract(JettonMinter.createFromConfig({
            admin: deployer.address,
            wallet_code: jettonWalletCodeCell,
            jetton_content: {
                uri: 'jetton2'
            }
        }, jettonMinterCodeCell));

        vaultTon = blockchain.openContract(VaultTon.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));

        const vaultCode = await compile('Vault');
        vaultJetton1 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: {
                jettonMinter: jettonMinter1.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, vaultCode));
    });

    describe('InitVault', () => {
        it('Should initialize vault successfully with creator null', async () => {
            const deployResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            expect(deployResult.transactions).toHaveTransaction({
                from: mockVaultFactory.address,
                to: vaultTon.address,
                deploy: true,
                success: true,
            });

            // Check that creator is set to sender address when null
            expect(deployResult.transactions).toHaveTransaction({
                from: vaultTon.address,
                to: mockVaultFactory.address,
                success: true,
            });
        });

        it('Should initialize vault successfully with specific creator address', async () => {
            const creator = deployer.address;
            const deployResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: creator,
            });

            expect(deployResult.transactions).toHaveTransaction({
                from: mockVaultFactory.address,
                to: vaultTon.address,
                deploy: true,
                success: true,
            });

            // Check that creator receives notification
            expect(deployResult.transactions).toHaveTransaction({
                from: vaultTon.address,
                to: creator,
                success: true,
            });
        });

        it('Should fail initialization from non-factory address', async () => {
            const deployResult = await vaultTon.sendInitVault(deployer.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            expect(deployResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: vaultTon.address,
                success: false,
                exitCode: 403,
            });
        });
    });

    describe('CreateOrder', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should create order successfully (ton-jetton)', async () => {
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

            const transferTonResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: toNano(1),
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );

            expect(transferTonResult.transactions).toHaveTransaction({
                to: vaultTon.address,
                success: true,
            });

            // Check create order transaction
            expect(transferTonResult.transactions).toHaveTransaction({
                from: vaultTon.address,
                success: true,
                op: 0x2d0e1e1b, // OP_CODE_INIT_ORDER
            });

            const endVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;
            expect(endVaultBalance).toEqual(toNano(1.01)); // 1 USER TON + 0.01 GAS STORAGE
        });

        it('Should fail create order with insufficient gas', async () => {
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            const transferTonResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(0.01) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: toNano(1),
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            // printTransactionFees(transferTonResult.transactions);

            expect(transferTonResult.transactions).toHaveTransaction({
                to: vaultTon.address,
                success: false,
                exitCode: 422, // ERR_INSUFFICIENT_GAS
            });

            // Check that order was not created
            expect(transferTonResult.transactions).not.toHaveTransaction({
                from: vaultTon.address,
                success: true,
                op: 0x2d0e1e1b,
            });
        });

        it('Should create multiple orders successfully', async () => {
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            let totalAmount = toNano(0);
            const createdAt = Math.round(Number(new Date().getTime() / 1000));

            for (let i = 0; i < 5; i++) {
                totalAmount += toNano(1);
                const transferTonResult = await vaultTon.sendCreateOrder(
                    user1.getSender(),
                    toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                    {
                        amount: toNano(1),
                        priceRate: toNano(2),
                        oppositeVault: vaultJetton1.address,
                        slippage: toNano(0.02),
                        toJettonMinter: jettonMinter2.address,
                        providerFee: deployer.address,
                        feeNum: 5,
                        feeDenom: 1000,
                        matcherFeeNum: 1,
                        matcherFeeDenom: 1000,
                        createdAt: createdAt + i,
                    }
                );

                expect(transferTonResult.transactions).toHaveTransaction({
                    to: vaultTon.address,
                    success: true,
                });

                expect(transferTonResult.transactions).toHaveTransaction({
                    from: vaultTon.address,
                    success: true,
                    op: 0x2d0e1e1b,
                });
            }

            const endVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;
            expect(endVaultBalance).toEqual(totalAmount + GAS_STORAGE);
        });
    });

    describe('GetData and GetCodes', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should return correct vault data', async () => {
            const data = await vaultTon.getData();

            expect(data.vaultFactory.equals(mockVaultFactory.address)).toBe(true);
            expect(data.randomHash_hex).toBe('0');
            expect(data.amount).toEqual(BigInt(0));
        });

        it('Should return correct codes', async () => {
            const codes = await vaultTon.getCodes();

            expect(codes.orderCode.equals(orderCode)).toBe(true);
            expect(codes.feeCollectorCode.equals(feeCollectorCode)).toBe(true);
        });

        it('Should return updated amount after creating order', async () => {
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });

            const orderAmount = toNano(5);
            await vaultTon.sendCreateOrder(
                user1.getSender(),
                orderAmount + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: orderAmount,
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );

            const data = await vaultTon.getData();
            expect(data.amount).toEqual(orderAmount);
        });
    });

    describe('Integration tests', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should handle order creation with different price rates', async () => {
            const priceRates = [toNano(1), toNano(2), toNano(0.5), toNano(10)];

            for (const priceRate of priceRates) {
                const transferTonResult = await vaultTon.sendCreateOrder(
                    user1.getSender(),
                    toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                    {
                        amount: toNano(1),
                        priceRate: priceRate,
                        oppositeVault: vaultJetton1.address,
                        slippage: toNano(0.02),
                        toJettonMinter: jettonMinter2.address,
                        providerFee: deployer.address,
                        feeNum: 5,
                        feeDenom: 1000,
                        matcherFeeNum: 1,
                        matcherFeeDenom: 1000,
                        createdAt: Math.round(Number(new Date().getTime() / 1000))
                    }
                );

                expect(transferTonResult.transactions).toHaveTransaction({
                    to: vaultTon.address,
                    success: true,
                });
            }
        });

        it('Should handle order creation with different slippage values', async () => {
            const slippages = [toNano(0.01), toNano(0.02), toNano(0.05), toNano(0.1)];

            for (const slippage of slippages) {
                const transferTonResult = await vaultTon.sendCreateOrder(
                    user1.getSender(),
                    toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                    {
                        amount: toNano(1),
                        priceRate: toNano(2),
                        oppositeVault: vaultJetton1.address,
                        slippage: slippage,
                        toJettonMinter: jettonMinter2.address,
                        providerFee: deployer.address,
                        feeNum: 5,
                        feeDenom: 1000,
                        matcherFeeNum: 1,
                        matcherFeeDenom: 1000,
                        createdAt: Math.round(Number(new Date().getTime() / 1000))
                    }
                );

                expect(transferTonResult.transactions).toHaveTransaction({
                    to: vaultTon.address,
                    success: true,
                });
            }
        });
    });

    describe('CloseOrder', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should close order successfully and return TON to owner', async () => {
            const orderAmount = toNano(10);
            const createOrderResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                orderAmount + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: orderAmount,
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );

            const order = getOrderWrapper(blockchain, createOrderResult, vaultTon.address);
            const vaultBalanceBefore = (await blockchain.getContract(vaultTon.address)).balance;

            const closeOrderResult = await order.sendCloseOrder(user1.getSender(), GAS_ORDER_CLOSE_ORDER + GAS_EXCESS);

            expect(closeOrderResult.transactions).toHaveTransaction({
                from: user1.address,
                to: order.address,
                success: true,
                op: 0x52e80bac, // OP_CODE_CLOSE_ORDER
            });

            expect(closeOrderResult.transactions).toHaveTransaction({
                from: order.address,
                to: vaultTon.address,
                success: true,
                op: 0xa597947e, // OP_CODE_CLOSE_ORDER_VAULT
            });

            expect(closeOrderResult.transactions).toHaveTransaction({
                from: vaultTon.address,
                to: user1.address,
                success: true,
                op: 0x15082c35, // OP_CODE_SWAP_TON
            });

            const vaultBalanceAfter = (await blockchain.getContract(vaultTon.address)).balance;
            expect(vaultBalanceAfter).toEqual(GAS_STORAGE); // Only storage left
        });

        it('Should fail close order from invalid sender', async () => {
            const orderAmount = toNano(10);
            const createOrderResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                orderAmount + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: orderAmount,
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );

            const order = getOrderWrapper(blockchain, createOrderResult, vaultTon.address);

            // Try to close from wrong address
            const closeOrderResult = await order.sendCloseOrder(deployer.getSender(), GAS_ORDER_CLOSE_ORDER + GAS_EXCESS);

            expect(closeOrderResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: order.address,
                success: false,
                exitCode: 403, // ERR_INVALID_SENDER
            });
        });
    });

    describe('MatchOrder', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should match orders successfully (ton-jetton)', async () => {
            // Mint jetton for user1
            const mintJettonResult = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
            const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJettonResult, jettonMinter1.address);

            // Create jetton order
            const jettonOrderResult = await jettonWallet1.sendCreateOrder(
                user1.getSender(),
                toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
                {
                    jettonAmount: toNano(1000),
                    vault: vaultJetton1.address,
                    oppositeVault: vaultTon.address,
                    owner: user1.address,
                    priceRate: toNano(2),
                    slippage: toNano(0.05),
                    toJettonMinter: null,
                    forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderJetton = getOrderWrapper(blockchain, jettonOrderResult, vaultJetton1.address);

            // Create TON order
            const tonOrderResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: toNano(2000),
                    priceRate: toNano(0.5),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.05),
                    toJettonMinter: jettonMinter1.address,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderTon = getOrderWrapper(blockchain, tonOrderResult, vaultTon.address);

            // Match orders
            const matchResult = await orderJetton.sendMatchOrder(
                deployer.getSender(),
                GAS_ORDER_FULL_MATCH + GAS_EXCESS,
                {
                    anotherOrderOwner: user1.address,
                    createdAt: (await orderTon.getData()).createdAt,
                    amount: toNano(100),
                }
            );

            expect(matchResult.transactions).toHaveTransaction({
                from: orderJetton.address,
                to: vaultJetton1.address,
                success: true,
                op: 0x12966c79, // OP_CODE_VAULT_JETTON_TRANSFER
            });

            expect(matchResult.transactions).toHaveTransaction({
                from: orderTon.address,
                to: vaultTon.address,
                success: true,
                op: 0x12966c79, // OP_CODE_VAULT_JETTON_TRANSFER
            });

            // Check FeeCollector was created
            const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchResult, vaultTon.address);
            const feeCollectorTonAmount = (await feeCollectorTon.getData()).amount;
            expect(feeCollectorTonAmount).toBeGreaterThan(0n);

            const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchResult, vaultJetton1.address);
            const feeCollectorJettonAmount = (await feeCollectorJetton.getData()).amount;
            expect(feeCollectorJettonAmount).toBeGreaterThan(0n);
        });
    });

    describe('WithDraw', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should withdraw fees successfully through FeeCollector', async () => {
            // Mint jetton for user1
            const mintJettonResult = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
            const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJettonResult, jettonMinter1.address);

            // Create jetton order
            const jettonOrderResult = await jettonWallet1.sendCreateOrder(
                user1.getSender(),
                toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
                {
                    jettonAmount: toNano(1000),
                    vault: vaultJetton1.address,
                    oppositeVault: vaultTon.address,
                    owner: user1.address,
                    priceRate: toNano(2),
                    slippage: toNano(0.05),
                    toJettonMinter: null,
                    forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderJetton = getOrderWrapper(blockchain, jettonOrderResult, vaultJetton1.address);

            // Create TON order
            const tonOrderResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: toNano(2000),
                    priceRate: toNano(0.5),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.05),
                    toJettonMinter: jettonMinter1.address,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderTon = getOrderWrapper(blockchain, tonOrderResult, vaultTon.address);

            // Match orders
            const matchResult = await orderJetton.sendMatchOrder(
                deployer.getSender(),
                GAS_ORDER_FULL_MATCH + GAS_EXCESS,
                {
                    anotherOrderOwner: user1.address,
                    createdAt: (await orderTon.getData()).createdAt,
                    amount: toNano(100),
                }
            );

            const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchResult, vaultTon.address);
            const feeAmount = (await feeCollectorTon.getData()).amount;

            // Withdraw fees
            const withdrawResult = await feeCollectorTon.sendWithDraw(deployer.getSender(), GAS_FEE_COLLECTOR_WITHDRAW + GAS_EXCESS);
            // printTransactionFees(withdrawResult.transactions, mapOpcode);

            expect(withdrawResult.transactions).toHaveTransaction({
                from: feeCollectorTon.address,
                to: vaultTon.address,
                success: true,
                op: 0xee83652a, // OP_CODE_FEE_COLLECTOR_WITHDRAW
            });

            expect(withdrawResult.transactions).toHaveTransaction({
                from: vaultTon.address,
                to: deployer.address,
                success: true,
                op: 0x2b46ca81, // OP_CODE_VAULT_WITHDRAW_TON
            });

            // Check FeeCollector balance is now 0
            const feeCollectorDataAfter = await feeCollectorTon.getData();
            expect(feeCollectorDataAfter.amount).toEqual(0n);
        });

        it('Should fail withdraw from non-owner', async () => {
            // Mint jetton for user1
            const mintJettonResult = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
            const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJettonResult, jettonMinter1.address);

            // Create jetton order
            const jettonOrderResult = await jettonWallet1.sendCreateOrder(
                user1.getSender(),
                toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
                {
                    jettonAmount: toNano(1000),
                    vault: vaultJetton1.address,
                    oppositeVault: vaultTon.address,
                    owner: user1.address,
                    priceRate: toNano(2),
                    slippage: toNano(0.05),
                    toJettonMinter: null,
                    forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderJetton = getOrderWrapper(blockchain, jettonOrderResult, vaultJetton1.address);

            // Create TON order
            const tonOrderResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: toNano(2000),
                    priceRate: toNano(0.5),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.05),
                    toJettonMinter: jettonMinter1.address,
                    providerFee: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );
            const orderTon = getOrderWrapper(blockchain, tonOrderResult, vaultTon.address);

            // Match orders
            const matchResult = await orderJetton.sendMatchOrder(
                deployer.getSender(),
                GAS_ORDER_FULL_MATCH + GAS_EXCESS,
                {
                    anotherOrderOwner: user1.address,
                    createdAt: (await orderTon.getData()).createdAt,
                    amount: toNano(100),
                }
            );

            const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchResult, vaultTon.address);

            // Try to withdraw from wrong address (user1 instead of deployer)
            const withdrawResult = await feeCollectorTon.sendWithDraw(user1.getSender(), GAS_FEE_COLLECTOR_WITHDRAW + GAS_EXCESS);

            expect(withdrawResult.transactions).toHaveTransaction({
                from: user1.address,
                to: feeCollectorTon.address,
                success: false,
                exitCode: 403, // ERR_INVALID_SENDER
            });
        });
    });

    describe('Balance checks', () => {
        beforeEach(async () => {
            await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
            await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS, {
                creator: null,
            });
        });

        it('Should maintain correct balance after multiple operations', async () => {
            const orderAmount1 = toNano(5);
            const orderAmount2 = toNano(10);

            // Create first order
            await vaultTon.sendCreateOrder(
                user1.getSender(),
                orderAmount1 + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: orderAmount1,
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
                }
            );

            const data1 = await vaultTon.getData();
            expect(data1.amount).toEqual(orderAmount1);

            // Create second order
            await vaultTon.sendCreateOrder(
                user1.getSender(),
                orderAmount2 + GAS_CREATE_ORDER_TON + GAS_EXCESS,
                {
                    amount: orderAmount2,
                    priceRate: toNano(2),
                    oppositeVault: vaultJetton1.address,
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000)) + 1
                }
            );

            const data2 = await vaultTon.getData();
            expect(data2.amount).toEqual(orderAmount1 + orderAmount2);
        });
    });
});
