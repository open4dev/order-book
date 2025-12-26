import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { getFeeCollectorWrapper, getJettonWalletWrapper, getOrderWrapper, mapOpcode } from './Helper';

const anotherJettonWalletCode = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")
const anotherMinterCode = Cell.fromHex("b5ee9c720101030100610002149058de03ab50a0cfce300102084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395005c68747470733a2f2f63646e2e6a6f696e636f6d6d756e6974792e78797a2f636c69636b65722f6e6f742e6a736f6e")

describe('Vault', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('Vault');
        feeCollectorCode = await compile('FeeCollector');
        orderCode = await compile('Order');
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
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: undefined,
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));

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
        }, code));

        vaultJetton2 = blockchain.openContract(Vault.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeCell,
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
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

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
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
    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(1),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.01 + 0.0035),
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

    });


    // it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not correct jetton wallet code", async () => {
    //     const mintJetton1Result = await anotherJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
    //     const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, anotherJettonMinter.address);

    //     const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        

    //     expect((await vaultJetton1.getData()).amount).toBe(toNano(0));

    //     const transferJettonResult = await jettonWallet1.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         {
    //             jettonAmount: toNano(1),
    //             vault: vaultJetton1.address,
    //             owner: user1.address,
    //             priceRate: toNano(2),
    //             slippage: toNano(0.02),
    //             toJettonMinter: jettonMinter2.address,
    //             forwardTonAmount: toNano(0.01 + 0.0035 + 0.007),
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

        const errorTransferTonForCreateOrderToJettonVault = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(1),
            {
                jettonAmount: toNano(1),
                vault: vaultTon.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
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
    });


    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - forward_payload == null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        const transferJettonResult = await jettonWallet1.sendCreateOrderWithoutForwardPayload(
            user1.getSender(),
            toNano(1),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
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

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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
        // console.log(startVaultBalance);
        // console.log(endVaultBalance);
        expect(endVaultBalance).toEqual(toNano(1.01)); // 1 USER TON + 0.01 GAS STORAGE
    });


    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(0.01 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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
        // console.log(startVaultBalance);
        // console.log(endVaultBalance);
    });

    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - fromJetton != null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        const transferTonResult = await vaultJetton1.sendCreateOrder(
            user1.getSender(),
            toNano(1 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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

    it("(Vault_V1)WithDraw(jetton + ton) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(1),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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


        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            deployer.getSender(),
            toNano(1),
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                anotherOrder: order2.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )
        // printTransactionFees(matchRes.transactions, mapOpcode);

        const order1Data = await order1.getData();
        const order2Data = await order2.getData();
        // console.log("order1Data", order1Data);
        // console.log("order2Data", order2Data);

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);
        const feeCollectorTonAmount = (await feeCollectorTon.getData()).amount;
        // console.log("feeCollectorTonAmount", feeCollectorTonAmount);
        expect(feeCollectorTonAmount).toEqual(toNano(0.4));

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);
        const feeCollectorJettonAmount = (await feeCollectorJetton.getData()).amount;
        // console.log("feeCollectorJettonAmount", feeCollectorJettonAmount);
        expect(feeCollectorJettonAmount).toEqual(toNano(0.2));


        const withDrawRes = await feeCollectorTon.sendWithDraw(deployer.getSender(), toNano(1));
        expect(withDrawRes.transactions).toHaveTransaction({
            from: vaultTon.address,
            to: deployer.address,
            success: true,
        });

        // console.log("withDrawResTON TRS")
        // printTransactionFees(withDrawRes.transactions, mapOpcode)


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(deployer.getSender(), toNano(1));
        expect(withDrawResJetton.transactions).toHaveTransaction({
            to: deployer.address,
            success: true,
        });
        // console.log("withDrawResJETTON TRS")
        // printTransactionFees(withDrawResJetton.transactions, mapOpcode)
        expect(withDrawResJetton.transactions.length).toBe(6);
        const balanceVaultJetton1 = (await blockchain.getContract(vaultJetton1.address)).balance;
        expect(balanceVaultJetton1).toEqual(toNano(0.01));
        const balanceVaultTon = (await blockchain.getContract(vaultTon.address)).balance;
        expect(balanceVaultTon).toEqual(toNano(1800.01)); // 2000 - (200 + fee)USER TON + 0.01 GAS STORAGE

    });

    it("(Vault_V1)WithDraw Failed(not enough gas)", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), toNano('0.05'));

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.1 + 0.01 + 0.00206 + 0.007084 + 0.003278),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(user1.getSender(), toNano(0.05));
        expect(withDrawRes.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollectorTon.address,
            success: false,
            exitCode: 422,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(user1.getSender(), toNano(0.05));
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
            toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
            }
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006),
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

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(deployer.getSender(), toNano(1));
        expect(withDrawRes.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollectorTon.address,
            success: false,
            exitCode: 403,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(deployer.getSender(), toNano(1));
        expect(withDrawResJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollectorJetton.address,
            success: false,
            exitCode: 403,
        });
    });
});
