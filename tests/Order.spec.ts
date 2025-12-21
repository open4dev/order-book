import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Order } from '../wrappers/Order';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Vault } from '../wrappers/Vault';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { getJettonWalletWrapper, getOrderWrapper, mapOpcode } from './VaultFactory.spec';


const anotherJettonWalletCode = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")
const anotherMinterCode = Cell.fromHex("b5ee9c720101030100610002149058de03ab50a0cfce300102084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395005c68747470733a2f2f63646e2e6a6f696e636f6d6d756e6974792e78797a2f636c69636b65722f6e6f742e6a736f6e")


const GAS_ORDER_FULL_MATCH = toNano("1")
const GAS_CREATE_ORDER_JETTON_NOTIFICATION = toNano(0.01 + 0.0035 + 0.007 + 0.02)
const GAS_CREATE_ORDER_TON_TRANSFER = toNano(10 + 0.01 + 0.0035 + 0.005)

describe('Order', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Order');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let fakeVault: SandboxContract<TreasuryContract>;
    let order: SandboxContract<Order>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<Vault>;
    let vaultJetton1: SandboxContract<Vault>;
    let vaultJetton2: SandboxContract<Vault>;
    let jettonMinter1: SandboxContract<JettonMinter>;
    let jettonMinter2: SandboxContract<JettonMinter>;
    let anotherJettonMinter: SandboxContract<JettonMinter>;
    let anotherJettonWallet: SandboxContract<JettonWallet>;
    let user1: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        fakeVault = await blockchain.treasury('fakeVault');
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

        anotherJettonMinter = blockchain.openContract(JettonMinter.createFromConfig({
            admin: deployer.address,
            wallet_code: anotherJettonWalletCode,
            jetton_content: {
                uri: 'anotherJetton'
            }
        }, anotherMinterCode));

        vaultTon = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: undefined,
                orderCode: await compile('Order'),
                feeCollectorCode: await compile('FeeCollector'),
            },
            fromJetton: undefined,
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, await compile('Vault')));

        vaultJetton1 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: await compile('Order'),
                feeCollectorCode: await compile('FeeCollector'),
            },
            fromJetton: {
                jettonMinter: jettonMinter1.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, await compile('Vault')));

        vaultJetton2 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: await compile('Order'),
                feeCollectorCode: await compile('FeeCollector'),
            },
            fromJetton: {
                jettonMinter: jettonMinter2.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, await compile('Vault')));

        order = blockchain.openContract(Order.createFromConfig({
            owner: deployer.address,
            vault: fakeVault.address,
            feeInfo: null,
            exchangeInfo: {
                from: null,
                to: null,
                amount: toNano(0),
                priceRate: toNano(0),
                slippage: toNano(0),
            },
            createdAt: BigInt(0),
        }, code));


        const deployResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(deployResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            deploy: true,
            success: true,
        });
    });

    it('Init Order -> Failed from not vault', async () => {
        // the check is done inside beforeEach
        // blockchain and order are ready to use
        const initResult = await order.sendInit(deployer.getSender(), toNano('0.05'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(initResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: order.address,
            success: false,
            exitCode: 403,
        });
    });

    it('Init Order -> Failed with not enough value', async () => {
        const initResult = await order.sendInit(fakeVault.getSender(), toNano('0.005'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(initResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            success: false,
            exitCode: 422,
        });
    });

    it('Init Order -> Failed with already initialized', async () => {
        const initResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(1),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        const failedInitResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(1),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(failedInitResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            success: false,
            exitCode: 403,
        });
    });

    it("Match Orders -> Bounce", async() => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault1.transactions, mapOpcode)
        const resInitVault2 = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault2.transactions, mapOpcode)
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1), null, null, null, undefined, undefined);
        printTransactionFees(resMint1.transactions, mapOpcode)
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resMint2 = await jettonMinter2.sendMint(deployer.getSender(), deployer.address, toNano(100), null, null, null, undefined, undefined);
        printTransactionFees(resMint2.transactions, mapOpcode)
        const jettonWallet2 = getJettonWalletWrapper(blockchain, resMint2, jettonMinter2.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.1), {
            jettonAmount: toNano(1),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(2),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: toNano(0.05),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        });
        printTransactionFees(resCreateOrder1.transactions, mapOpcode)
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await jettonWallet2.sendCreateOrder(deployer.getSender(), toNano(0.1), {
            jettonAmount: toNano(1),    
            vault: vaultJetton2.address,
            owner: deployer.address,
            priceRate: toNano(1),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter1.address,
            forwardTonAmount: toNano(0.05),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        });
        printTransactionFees(resCreateOrder2.transactions, mapOpcode)
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton2.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), toNano(1), {
            anotherVault: vaultJetton2.address,
            anotherOrderOwner: deployer.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(1), // 1 jetton
        });
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: order2.address,
            exitCode: 407,
        })

        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: order1.address,
            success: true,
            inMessageBounced: true
        })

        expect((await order1.getData()).exchangeInfo.amount).toBe(toNano(1));
    })

    it("Test Close Order", async () => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));

        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1), null, null, null, undefined, undefined);
        printTransactionFees(resMint1.transactions, mapOpcode)
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.01 + 0.0035 + 0.007 + 0.02), {
            jettonAmount: toNano(1),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(2),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })
        printTransactionFees(resCreateOrder1.transactions, mapOpcode)
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const res = await order1.sendCloseOrder(deployer.getSender(), toNano(0.1));
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })
    })

    it("Match Orders jetton -> jetton", async () => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault1.transactions, mapOpcode)
        const resInitVault2 = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault2.transactions, mapOpcode)
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        printTransactionFees(resMint1.transactions, mapOpcode)
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resMint2 = await jettonMinter2.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        printTransactionFees(resMint2.transactions, mapOpcode)
        const jettonWallet2 = getJettonWalletWrapper(blockchain, resMint2, jettonMinter2.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.01 + 0.0035 + 0.007 + 0.02), {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })

        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await jettonWallet2.sendCreateOrder(deployer.getSender(), toNano(0.01 + 0.0035 + 0.007 + 0.02), {
            jettonAmount: toNano(10),
            vault: vaultJetton2.address,
            owner: deployer.address,
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton2.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), toNano(1), {
            anotherVault: vaultJetton2.address,
            anotherOrderOwner: deployer.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(100),
        });
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })

        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultJetton2.address,
            success: true,
        })
    })

    it("Match Orders jetton -> ton", async () => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault1.transactions, mapOpcode)
        const resInitVault2 = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault2.transactions, mapOpcode)
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        printTransactionFees(resMint1.transactions, mapOpcode)
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.01 + 0.0035 + 0.007 + 0.02), {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })

        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10 + 0.01 + 0.0035 + 0.005), {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultTon.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), toNano(1), {
            anotherVault: vaultTon.address,
            anotherOrderOwner: deployer.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(100),
        });
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })

        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultTon.address,
            success: true,
        })
    })

    it("Match Orders ton -> jetton", async () => {
        const resInitVault1 = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault1.transactions, mapOpcode)
        const resInitVault2 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano(0.05));
        printTransactionFees(resInitVault2.transactions, mapOpcode)
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        printTransactionFees(resMint1.transactions, mapOpcode)
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);

        // Первый ордер: TON -> jetton
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10 + 0.01 + 0.0035 + 0.005), {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        // Второй ордер: jetton -> TON (наоборот)
        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.01 + 0.0035 + 0.007 + 0.02), {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), toNano(1), {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultTon.address,
            success: true,
        })

        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultJetton1.address,
            success: true,
        })
    })
});
