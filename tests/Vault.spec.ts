import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { getFeeCollectorWrapper, getJettonWalletWrapper, getOrderWrapper } from './VaultFactory.spec';

const anotherJettonWalletCode = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")
const anotherMinterCode = Cell.fromHex("b5ee9c720101030100610002149058de03ab50a0cfce300102084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395005c68747470733a2f2f63646e2e6a6f696e636f6d6d756e6974792e78797a2f636c69636b65722f6e6f742e6a736f6e")

describe('Vault', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Vault');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
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
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');

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
        }, code));

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
        }, code));

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
        }, code));
    });

    it('Send init Success', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: true,
        });
    });

    it('Send init From not Vault Factory address', async () => {
        const sendInitResult = await vaultTon.sendInitVault(deployer.getSender(), toNano('0.05'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });
    });

    it('Send init with not enough value', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.005'));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: false,
            exitCode: 423,
        });
    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: true,
        });
        // check create order transaction
        expect(transferJettonResult.transactions).toHaveTransaction({
            from: vaultJetton1.address,
            success: true,
            op: 0x2d0e1e1b,
        });

        const endVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;
        expect(endVaultBalance - startVaultBalance).toBe(toNano(0));
        expect((await vaultJetton1.getData()).amount).toBe(toNano(1));
    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.001),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: false,
            exitCode: 422,
        });
        // check create order transaction
        expect(transferJettonResult.transactions).not.toHaveTransaction({
            from: vaultJetton1.address,
            success: true,
            op: 0x2d0e1e1b,
        });

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));
    });


    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.001),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: false,
            exitCode: 422,
        });
        // check create order transaction
        expect(transferJettonResult.transactions).not.toHaveTransaction({
            from: vaultJetton1.address,
            success: true,
            op: 0x2d0e1e1b,
        });

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));
    });

    // it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not correct jetton wallet code", async () => {
    //     const mintJetton1Result = await anotherJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
    //     const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, anotherJettonMinter.address);

    //     const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        

    //     expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

    //     const transferJettonResult = await jettonWallet1.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
    //         {
    //             jettonAmount: toNano(1),
    //             vault: vaultJetton1.address,
    //             owner: user1.address,
    //             priceRate: toNano(2),
    //             slippage: toNano(0.02),
    //             toJettonMinter: jettonMinter2.address,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.001),
    //             providerFee: deployer.address,
    //             feeNum: 5,
    //             feeDenom: 1000,
    //             matcherFeeNum: 1,
    //             matcherFeeDenom: 1000,
    //         }
    //     )
    //     expect(transferJettonResult.transactions).toHaveTransaction({
    //         to: vaultJetton1.address,
    //         success: false,
    //         exitCode: 429,
    //     });
    //     // check create order transaction
    //     expect(transferJettonResult.transactions).not.toHaveTransaction({
    //         from: vaultJetton1.address,
    //         success: true,
    //         op: 0x2d0e1e1b,
    //     });
    //     expect((await vaultJetton1.getData()).amount).toBe(toNano(0));
    // });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - fromJetton == null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultTonInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const errorTransferTonForCreateOrderToJettonVault = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultTon.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.5 + 0.002 + 0.01 + 0.001),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(errorTransferTonForCreateOrderToJettonVault.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: false,
            exitCode: 428,
        });
        expect((await vaultJetton1.getData()).amount).toBe(toNano(0))
    });


    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - forward_payload == null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const transferJettonResult = await jettonWallet1.sendCreateOrderWithoutForwardPayload(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
            }
        )
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: false,
            exitCode: 427,
        });
    });

    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        expect((await vaultTon.getData()).amount).toBe(toNano(0));

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: true,
        });
        // check create order transaction
        expect(transferTonResult.transactions).toHaveTransaction({
            from: vaultTon.address,
            success: true,
            op: 0x2d0e1e1b,
        });

        const endVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;
        console.log(startVaultBalance);
        console.log(endVaultBalance);
        expect(endVaultBalance).toBeGreaterThanOrEqual(startVaultBalance + toNano(1));
    });


    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        expect((await vaultTon.getData()).amount).toBe(toNano(0));

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });
        // check create order transaction
        expect(transferTonResult.transactions).not.toHaveTransaction({
            from: vaultTon.address,
            success: true,
            op: 0x2d0e1e1b,
        });

        const endVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;
        console.log(startVaultBalance);
        console.log(endVaultBalance);
    });

    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - fromJetton != null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

        const transferTonResult = await vaultJetton1.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(1),
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )
        expect(transferTonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: false,
            exitCode: 403,
        });
        // check create order transaction
        expect(transferTonResult.transactions).not.toHaveTransaction({
            from: vaultJetton1.address,
            success: true,
            op: 0x2d0e1e1b,
        });
    });

    it("(Vault_V1)WithDraw jetton - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const mintJetton2Result = await jettonMinter2.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet2 = getJettonWalletWrapper(blockchain, mintJetton2Result, jettonMinter2.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultJetton2.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));


        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult.transactions);

        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await jettonWallet2.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton2.address,
                owner: user1.address,
                priceRate: toNano(0.5),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter1.address,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult2.transactions);

        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultJetton2.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            toNano(1),
            {
                anotherVault: vaultJetton1.address,
                anotherOrderOwner: user1.address,
                anotherOrder: order2.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(1),
            }
        )
        printTransactionFees(matchRes.transactions);

        const feeCollector = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);

        const withDrawRes = await feeCollector.sendWithDraw(user1.getSender(), toNano(1));
        printTransactionFees(withDrawRes.transactions);
    });

    it("(Vault_V1)WithDraw - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult.transactions);

        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(2000),
                priceRate: toNano(0.5),
                slippage: toNano(0.05),
                toJettonMinter: jettonMinter1.address,
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult2.transactions);

        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            toNano(1),
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                anotherOrder: order2.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )
        printTransactionFees(matchRes.transactions);

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(user1.getSender(), toNano(1));
        printTransactionFees(withDrawRes.transactions);
        expect(withDrawRes.transactions).toHaveTransaction({
            from: vaultTon.address,
            to: user1.address,
            success: true,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(user1.getSender(), toNano(1));
        printTransactionFees(withDrawResJetton.transactions);
        expect(withDrawResJetton.transactions).toHaveTransaction({
            to: user1.address,
            success: true,
        });
        expect(withDrawResJetton.transactions.length).toBe(6);

    });

    it("(Vault_V1)WithDraw Failed(not enough gas)", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult.transactions);

        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(2000),
                priceRate: toNano(0.5),
                slippage: toNano(0.05),
                toJettonMinter: jettonMinter1.address,
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult2.transactions);

        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            toNano(1),
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                anotherOrder: order2.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )
        printTransactionFees(matchRes.transactions);

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(user1.getSender(), toNano(0.01));
        printTransactionFees(withDrawRes.transactions);
        expect(withDrawRes.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollectorTon.address,
            success: false,
            exitCode: 422,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(user1.getSender(), toNano(0.01));
        printTransactionFees(withDrawResJetton.transactions);
        expect(withDrawResJetton.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollectorJetton.address,
            success: false,
            exitCode: 422,
        });
    });

    it("(Vault_V1)WithDraw Failed(not from owner)", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult.transactions);

        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.02 + 0.002 + 0.01 + 0.007 + 0.005),
            {
                amount: toNano(2000),
                priceRate: toNano(0.5),
                slippage: toNano(0.05),
                toJettonMinter: jettonMinter1.address,
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )

        printTransactionFees(jettonTransferResult2.transactions);

        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            toNano(1),
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                anotherOrder: order2.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )
        printTransactionFees(matchRes.transactions);

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(deployer.getSender(), toNano(1));
        printTransactionFees(withDrawRes.transactions);
        expect(withDrawRes.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollectorTon.address,
            success: false,
            exitCode: 403,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(deployer.getSender(), toNano(1));
        printTransactionFees(withDrawResJetton.transactions);
        expect(withDrawResJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollectorJetton.address,
            success: false,
            exitCode: 403,
        });
    });
});
