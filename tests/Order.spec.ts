import { Blockchain, loadConfig, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Order } from '../wrappers/Order';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Vault } from '../wrappers/Vault';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { GAS_CREATE_ORDER_JETTON, GAS_CREATE_ORDER_TON, GAS_ORDER_CLOSE_ORDER, GAS_ORDER_FULL_MATCH, GAS_ORDER_INIT, GAS_STORAGE, GAS_VAULT_CLOSE_ORDER, GAS_VAULT_INIT, getJettonWalletWrapper, getOrderWrapper, mapOpcode, printGasUsage } from './Helper';
import { time } from 'console';
import { VaultTon } from '../wrappers/VaultTon';


const anotherJettonWalletCode = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")
const anotherMinterCode = Cell.fromHex("b5ee9c720101030100610002149058de03ab50a0cfce300102084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395005c68747470733a2f2f63646e2e6a6f696e636f6d6d756e6974792e78797a2f636c69636b65722f6e6f742e6a736f6e")

describe('Order', () => {
    let code: Cell;
    let vaultCode: Cell;
    let vaultTonCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('Order');
        vaultCode = await compile('Vault');
        vaultTonCode = await compile('VaultTon');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let fakeVault: SandboxContract<TreasuryContract>;
    let order: SandboxContract<Order>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<VaultTon>;
    let vaultJetton1: SandboxContract<Vault>;
    let vaultJetton2: SandboxContract<Vault>;
    let jettonMinter1: SandboxContract<JettonMinter>;
    let jettonMinter2: SandboxContract<JettonMinter>;
    let anotherJettonMinter: SandboxContract<JettonMinter>;
    let anotherJettonWallet: SandboxContract<JettonWallet>;
    let user1: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create()
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

        vaultTon = blockchain.openContract(VaultTon.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                orderCode: code,
                feeCollectorCode: feeCollectorCode,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, vaultTonCode));

        vaultJetton1 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: code,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: {
                jettonMinter: jettonMinter1.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, vaultCode));

        vaultJetton2 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: code,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: {
                jettonMinter: jettonMinter2.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, vaultCode));

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


        const deployResult = await order.sendInit(fakeVault.getSender(), GAS_STORAGE + GAS_ORDER_INIT, {
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
        const initResult = await order.sendInit(deployer.getSender(), GAS_STORAGE + GAS_ORDER_INIT, {
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
        const initResult = await order.sendInit(fakeVault.getSender(), GAS_STORAGE + GAS_ORDER_INIT - toNano(0.0001), {
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
        const initResult = await order.sendInit(fakeVault.getSender(), GAS_STORAGE + GAS_ORDER_INIT, {
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

        const failedInitResult = await order.sendInit(fakeVault.getSender(), GAS_STORAGE + GAS_ORDER_INIT, {
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
            from: order.address,
            to: fakeVault.address,
            success: true,
            op: 0xa597947e,
        });

    });

    it("Match Orders -> Bounce", async() => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resInitVault2 = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resMint2 = await jettonMinter2.sendMint(deployer.getSender(), deployer.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet2 = getJettonWalletWrapper(blockchain, resMint2, jettonMinter2.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(1),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(2),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        });
        // printTransactionFees(resCreateOrder1.transactions, mapOpcode);
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await jettonWallet2.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(1),    
            vault: vaultJetton2.address,
            owner: deployer.address,
            priceRate: toNano(1),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter1.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        });
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton2.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton2.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(1), // 1 jetton
        });
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: order2.address,
            exitCode: 430,
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
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);

        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(1),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(2),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        expect((await order1.getData()).exchangeInfo.amount).toEqual(toNano(1));
        const res = await order1.sendCloseOrder(deployer.getSender(), GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER);
        // printTransactionFees(res.transactions, mapOpcode);
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })
        expect((await order1.getData()).exchangeInfo.amount).toEqual(0n)
    })

    it("Test match and close order", async () => {
        // console.log("blockchain.config", loadConfig(blockchain.config))
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resInitVault2 = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resMint2 = await jettonMinter2.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet2 = getJettonWalletWrapper(blockchain, resMint2, jettonMinter2.address);
        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        // printTransactionFees(resCreateOrder1.transactions, mapOpcode);
        
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await jettonWallet2.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(10),
            vault: vaultJetton2.address,
            owner: deployer.address,
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton2.address);
        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton2.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });
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
        const vaultTonBalanceBeforeCloseOrder1 = (await blockchain.getContract(vaultJetton1.address)).balance;
        const orderTonBalanceBeforeCloseOrder1 = (await blockchain.getContract(order1.address)).balance;
        const resCloseOrder1 = await order1.sendCloseOrder(deployer.getSender(), GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER);
        const vaultTonBalanceAfterCloseOrder1 = (await blockchain.getContract(vaultJetton1.address)).balance;
        const orderTonBalanceAfterCloseOrder1 = (await blockchain.getContract(order1.address)).balance;
        // console.log("vaultTonBalanceBeforeCloseOrder1", vaultTonBalanceBeforeCloseOrder1);
        // console.log("vaultTonBalanceAfterCloseOrder1", vaultTonBalanceAfterCloseOrder1);
        // console.log("orderTonBalanceBeforeCloseOrder1", orderTonBalanceBeforeCloseOrder1);
        // console.log("orderTonBalanceAfterCloseOrder1", orderTonBalanceAfterCloseOrder1);
        // printTransactionFees(resCloseOrder1.transactions, mapOpcode);
        expect(resCloseOrder1.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })
        expect(resCloseOrder1.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
        })
        expect((await order1.getData()).exchangeInfo.amount).toEqual(0n)

        const vaultTonBalanceBeforeCloseOrder2 = (await blockchain.getContract(vaultJetton2.address)).balance;
        const resCloseOrder2 = await order2.sendCloseOrder(deployer.getSender(), GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER);
        const vaultTonBalanceAfterCloseOrder2 = (await blockchain.getContract(vaultJetton2.address)).balance;
        // console.log("vaultTonBalanceBeforeCloseOrder2", vaultTonBalanceBeforeCloseOrder2);
        // console.log("vaultTonBalanceAfterCloseOrder2", vaultTonBalanceAfterCloseOrder2);
        // printTransactionFees(resCloseOrder2.transactions, mapOpcode);
        expect(resCloseOrder2.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultJetton2.address,
            success: true,
        })
        expect(resCloseOrder2.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultJetton2.address,
            success: true,
        })
        expect((await order2.getData()).exchangeInfo.amount).toEqual(0n)
    })

    it("Match Orders jetton -> jetton", async () => {
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resInitVault2 = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resMint2 = await jettonMinter2.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet2 = getJettonWalletWrapper(blockchain, resMint2, jettonMinter2.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter2.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })

        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await jettonWallet2.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(10),
            vault: vaultJetton2.address,
            owner: deployer.address,
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton2.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton2.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(100),
        });
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
        const resInitVault1 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resInitVault2 = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);

        const resCreateOrder1 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })

        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultJetton1.address);
        const resCreateOrder2 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.05),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultTon.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultTon.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(100),
        });
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
        const resInitVault1 = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resInitVault2 = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);

        // First order: TON -> jetton
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        // printTransactionFees(resCreateOrder1.transactions, mapOpcode);
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        // Second order: jetton -> TON (reverse)
        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        // printTransactionFees(resCreateOrder2.transactions, mapOpcode);
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });
        // printTransactionFees(res.transactions, mapOpcode);
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

        const order1Data = await order1.getData();
        const order2Data = await order2.getData();
        // console.log("order1Data", order1Data);
        // console.log("order2Data", order2Data);
    })

    it('MatchOrder -> Failed with not enough gas', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH - toNano(0.001), {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 422,
        })
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: deployer.address,
            success: true,
            inMessageBounced: true
        })
    });

    it('MatchOrder -> Success with enough gas', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultTon.address,
            success: true,
            op: 0x12966c79
        })
        expect(res.transactions).toHaveTransaction({
            from: vaultTon.address,
            to: deployer.address,
            success: true,
        })
        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultJetton1.address,
            success: true,
            op: 0x12966c79
        })
        expect(res.transactions).toHaveTransaction({
            to: jettonWallet1.address,
            success: true,
            op: 0x178d4519
        })
    });

    it('MatchOrder -> Failed with amount not available (amount == 0)', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        const match2 = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });
        expect(match2.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 406,
        })

        expect(match2.transactions).toHaveTransaction({
            from: order1.address,
            to: deployer.address,
            success: true,
            inMessageBounced: true
        })
    });

    // Already tested
    // it('MatchOrder -> Success with amount available', async () => {
    // });

    it('MatchOrder -> Failed with invalid amount (msg.amount > exchangeInfo.amount)', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(11),
        });
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 407,
        })

        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: deployer.address,
            success: true,
            inMessageBounced: true
        })
    });

    // Already tested
    // it('MatchOrder -> Success with valid amount', async () => {
    // });

    it('InternalMatchOrder -> Failed with invalid sender', async () => {
        // TODO: Add test logic for assert(in.senderAddress == generatedAnotherOrderAddress) throw ERR_INVALID_SENDER;
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendInternalMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            matcher: deployer.address,
            feeInfo: {
                provider: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            },
            matchExchangeInfo: {
                amount: toNano(10),
                priceRate: toNano(10),
                slippage: toNano(0.02),
            },
            createdAt: (await order2.getData()).createdAt,
        });
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 403,
        })
    });

    it('InternalMatchOrder -> Success with valid sender', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: order2.address,
            success: true,
            op: 0xdfe29f63
        })
    });

    it('InternalMatchOrder -> Failed with invalid slippage', async () => {
        // TODO: Add test logic for assert ((exchangeInfo.amount > 0) && (compareSlippage == 0) && (anotherCompareSlippage == 0)) throw ERR_INVALID_SLIPPAGE;
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.0001),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: order2.address,
            success: false,
            op: 0xdfe29f63,
            exitCode: 430,
        })
    });

    // Already tested
    it('InternalMatchOrder -> Success with valid slippage', async () => {
        // TODO: Add positive test logic for assert ((exchangeInfo.amount > 0) && (compareSlippage == 0) && (anotherCompareSlippage == 0));
    });

    
    it('SuccessMatch -> Failed with invalid sender', async () => {
        // TODO: Add test logic for assert(in.senderAddress == generatedAnotherOrderAddress) throw ERR_INVALID_SENDER;
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.0001),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendSuccessMatch(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            anotherOrderCreatedAt: (await order2.getData()).createdAt,
            matcher: deployer.address,
            feeInfo: {
                provider: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            },
            matchExchangeInfo: {
                startAmount: toNano(10),
                amount: toNano(10),
            },
        });

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 403,
        })

    });

    it('SuccessMatch -> Success with valid sender', async () => {
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resMint1 = await jettonMinter1.sendMint(deployer.getSender(), deployer.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, resMint1, jettonMinter1.address);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const resCreateOrder2 = await jettonWallet1.sendCreateOrder(deployer.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON, {
            jettonAmount: toNano(100),
            vault: vaultJetton1.address,
            owner: deployer.address,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order2 = getOrderWrapper(blockchain, resCreateOrder2, vaultJetton1.address);

        const res = await order1.sendMatchOrder(deployer.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton1.address,
            anotherOrderOwner: deployer.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        });

        expect(res.transactions).toHaveTransaction({
            from: order2.address,
            to: order1.address,
            success: true,
            op: 0x55feb42a
        })
    });

    it('CloseOrder -> Failed with not enough gas', async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const res = await order1.sendCloseOrder(deployer.getSender(), GAS_ORDER_CLOSE_ORDER);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: false,
            exitCode: 422,
        })

    });

    it('CloseOrder -> Success with enough gas', async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER);
        await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);
        const resCreateOrder1 = await vaultTon.sendCreateOrder(deployer.getSender(), toNano(10) + GAS_CREATE_ORDER_TON, {
            amount: toNano(10),
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: jettonMinter1.address,
            providerFee: deployer.address,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000)),
        })
        // printTransactionFees(resCreateOrder1.transactions);
        const order1 = getOrderWrapper(blockchain, resCreateOrder1, vaultTon.address);

        const res = await order1.sendCloseOrder(deployer.getSender(), GAS_VAULT_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: order1.address,
            success: true,
        })
        expect(res.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultTon.address,
            success: true,
            op: 0xa597947e
        })
        expect(res.transactions).toHaveTransaction({
            from: vaultTon.address,
            to: deployer.address,
            success: true,
            op: 0x15082c35,
        })
    });
});
