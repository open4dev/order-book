import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { GAS_CREATE_ORDER_JETTON, GAS_CREATE_ORDER_TON, GAS_EXCESS, GAS_FEE_COLLECTOR_WITHDRAW, GAS_JETTON_WALLET_TRANSFER, GAS_ORDER_CLOSE_ORDER, GAS_ORDER_FULL_MATCH, GAS_STORAGE, getFeeCollectorWrapper, getJettonWalletWrapper, getOrderWrapper, mapOpcode } from './Helper';
import { VaultTon } from '../wrappers/VaultTon';

const anotherJettonWalletCode = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")
const anotherMinterCode = Cell.fromHex("b5ee9c720101030100610002149058de03ab50a0cfce300102084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395005c68747470733a2f2f63646e2e6a6f696e636f6d6d756e6974792e78797a2f636c69636b65722f6e6f742e6a736f6e")

describe('Vault', () => {
    let code: Cell;
    let orderCode: Cell;
    let vaultTonCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('Vault');
        vaultTonCode = await compile('VaultTon');
        feeCollectorCode = await compile('FeeCollector');
        orderCode = await compile('Order');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
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

        vaultTon = blockchain.openContract(VaultTon.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, vaultTonCode));

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
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: true,
        });
    });

    it('Send init From not Vault Factory address', async () => {
        const sendInitResult = await vaultTon.sendInitVault(deployer.getSender(), GAS_STORAGE);

        expect(sendInitResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTon.address,
            success: false,
            exitCode: 403,
        });
    });

    it('Send init with not enough value', async () => {
        const sendInitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE - toNano(0.0001));

        expect(sendInitResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vaultTon.address,
            success: false,
            exitCode: 422,
        });
    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
                createdAt: Math.round(Number(new Date().getTime() / 1000))
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
        expect(endVaultBalance).toBe(toNano(0.01));
    });


    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder 5 transactions) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        for (let i = 0; i < 5; i++) {
            const transferJettonResult = await jettonWallet1.sendCreateOrder(
                user1.getSender(),
                toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
                {
                    jettonAmount: toNano(1),
                    vault: vaultJetton1.address,
                    owner: user1.address,
                    priceRate: toNano(2),
                    slippage: toNano(0.02),
                    toJettonMinter: jettonMinter2.address,
                    forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                    providerFee: deployer.address,
                    feeNum: 5,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
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
            expect(endVaultBalance).toBe(toNano(0.01));
        }
    });

    it("(Vault_V1)Jetton Transfer Notification(ton-jetton)(createOrder 5 transactions) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        var amountVaultTon = toNano(0)

        for (let i = 0; i < 5; i++) {
            amountVaultTon += toNano(1)
            const transferTonResult = await vaultTon.sendCreateOrder(
                user1.getSender(),
                toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                    createdAt: Math.round(Number(new Date().getTime() / 1000))
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
            expect(endVaultBalance).toBe(amountVaultTon + toNano(0.01));
        }
    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - not enough value", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startJettonBalance = await jettonWallet1.getJettonBalance();

        const transferJettonResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.02),
                toJettonMinter: jettonMinter2.address,
                forwardTonAmount: GAS_CREATE_ORDER_JETTON - toNano(0.001),
                providerFee: deployer.address,
                feeNum: 5,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: true,
        });
        // check create order transaction
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: jettonWallet1.address,
            success: true,
            op: 0xf8a7ea5, // OP_CODE_JETTON_TRANSFER
        });

    });

    it("(Vault_V1)Jetton Transfer Notification(jetton1-jetton2)(createOrder) - forward_payload == null", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultJetton1.address)).balance;

        const startJettonBalance = await jettonWallet1.getJettonBalance();

        const transferJettonResult = await jettonWallet1.sendCreateOrderWithoutForwardPayload(
            user1.getSender(),
            toNano(1),
            {
                jettonAmount: toNano(1),
                vault: vaultJetton1.address,
                owner: user1.address,
                forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            }
        )
        printTransactionFees(transferJettonResult.transactions);
        expect(transferJettonResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: true,
        });

        expect(transferJettonResult.transactions).toHaveTransaction({
            to: jettonWallet1.address,
            success: true,
            op: 0xf8a7ea5, // OP_CODE_JETTON_TRANSFER
        });

        const endJettonBalance = await jettonWallet1.getJettonBalance();
        expect(endJettonBalance).toEqual(startJettonBalance);
    });

    it("(Vault_V1)Ton Transfer (ton-jetton2)(createOrder) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(1) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
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

        const vaultTon1InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const startVaultBalance = (await blockchain.getContract(vaultTon.address)).balance;

        const transferTonResult = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(0.01) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
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

    it("(Vault_V1)WithDraw(jetton + ton) - Success", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

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
                forwardTonAmount: GAS_CREATE_ORDER_JETTON,
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )


        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            deployer.getSender(),
            GAS_ORDER_FULL_MATCH + GAS_EXCESS,
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
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
        expect(balanceVaultJetton1).toEqual(GAS_STORAGE);
        const balanceVaultTon = (await blockchain.getContract(vaultTon.address)).balance;
        expect(balanceVaultTon).toEqual(toNano(1800) + GAS_STORAGE); // 2000 - (200 + fee)USER TON + 0.01 GAS STORAGE

    });

    it("(Vault_V1)WithDraw Failed(not enough gas)", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        // printTransactionFees(vaultJetton1InitResult.transactions, mapOpcode);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);
        // printTransactionFees(vaultJetton2InitResult.transactions, mapOpcode);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.1) + GAS_CREATE_ORDER_JETTON,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )
        // printTransactionFees(jettonTransferResult.transactions, mapOpcode);


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )
        // printTransactionFees(jettonTransferResult2.transactions, mapOpcode);


        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            GAS_ORDER_FULL_MATCH + GAS_EXCESS,
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )
        // printTransactionFees(matchRes.transactions, mapOpcode);

        const feeCollectorTon = getFeeCollectorWrapper(blockchain, matchRes, vaultTon.address);

        const feeCollectorJetton = getFeeCollectorWrapper(blockchain, matchRes, vaultJetton1.address);


        const withDrawRes = await feeCollectorTon.sendWithDraw(user1.getSender(), GAS_FEE_COLLECTOR_WITHDRAW + GAS_JETTON_WALLET_TRANSFER - toNano(0.0001));
        expect(withDrawRes.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollectorTon.address,
            success: false,
            exitCode: 422,
        });


        const withDrawResJetton = await feeCollectorJetton.sendWithDraw(user1.getSender(), GAS_FEE_COLLECTOR_WITHDRAW + GAS_JETTON_WALLET_TRANSFER - toNano(0.0001));
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

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )


        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            GAS_ORDER_FULL_MATCH + GAS_EXCESS,
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
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

    it("VaultJettonTransfer -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJettonTransferResult = await vaultJetton1.sendVaultJettonTransfer(
            user1.getSender(),
            GAS_JETTON_WALLET_TRANSFER - toNano(0.0001),
            {
                feeInfo: {
                    provider: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                },
                orderOwner: user1.address,
                matcher: deployer.address,
                anotherOwnerOrder: user1.address,
                toJettonMinter: jettonMinter1.address,
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        );
        expect(vaultJettonTransferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 422,
        });
    });

    it("VaultJettonTransfer -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_JETTON_WALLET_TRANSFER);
        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJettonTransferResult = await vaultJetton1.sendVaultJettonTransfer(
            user1.getSender(),
            GAS_JETTON_WALLET_TRANSFER,
            {
                feeInfo: {
                    provider: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                },
                orderOwner: user1.address,
                matcher: deployer.address,
                anotherOwnerOrder: user1.address,
                toJettonMinter: jettonMinter1.address,
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        );
        expect(vaultJettonTransferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 403,
        });
    });

    it("VaultJettonTransfer -> Failed with invalid sender (not from generated order)", async () => {
        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJettonTransferResult = await vaultJetton1.sendVaultJettonTransfer(
            user1.getSender(),
            GAS_JETTON_WALLET_TRANSFER,
            {
                feeInfo: {
                    provider: deployer.address,
                    feeNum: 1,
                    feeDenom: 1000,
                    matcherFeeNum: 1,
                    matcherFeeDenom: 1000,
                },
                orderOwner: user1.address,
                matcher: deployer.address,
                anotherOwnerOrder: user1.address,
                toJettonMinter: jettonMinter1.address,
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        );
        expect(vaultJettonTransferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 403,
        });
    });

    it("VaultJettonTransfer -> Success with valid sender", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )


        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const jettonTransferResult2 = await vaultTon.sendCreateOrder(
            user1.getSender(),
            toNano(2000) + GAS_CREATE_ORDER_TON + GAS_EXCESS,
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
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )


        const order2 = getOrderWrapper(blockchain, jettonTransferResult2, vaultTon.address);

        const matchRes = await order1.sendMatchOrder(
            user1.getSender(),
            GAS_ORDER_FULL_MATCH + GAS_EXCESS,
            {
                anotherVault: vaultTon.address,
                anotherOrderOwner: user1.address,
                createdAt: (await order2.getData()).createdAt,
                amount: toNano(100),
            }
        )

        expect(matchRes.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
            op: 0x12966c79
        });
        expect(matchRes.transactions).toHaveTransaction({
            from: order2.address,
            to: vaultTon.address,
            success: true,
            op: 0x12966c79
        });
    });

    it("CloseOrder (Vault) -> Failed with not enough gas", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const closeOrderResult = await vaultJetton1.sendCloseOrder(
            user1.getSender(),
            GAS_ORDER_CLOSE_ORDER - toNano(0.0001),
            {
                orderOwner: user1.address,
                toJetton: {
                    jettonMinter: jettonMinter1.address,
                },
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        )
        expect(closeOrderResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 422,
        });
    });

    it("CloseOrder (Vault) -> Success with enough gas", async () => {
        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const closeOrderResult = await vaultJetton1.sendCloseOrder(
            user1.getSender(),
            GAS_ORDER_CLOSE_ORDER,
            {
                orderOwner: user1.address,
                toJetton: {
                    jettonMinter: jettonMinter1.address,
                },
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        )
        expect(closeOrderResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 403,
        });
    });

    it("CloseOrder (Vault) -> Failed with invalid sender (not from generated order)", async () => {
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const closeOrderResult = await vaultJetton1.sendCloseOrder(
            user1.getSender(),
            GAS_ORDER_CLOSE_ORDER,
            {
                orderOwner: user1.address,
                toJetton: {
                    jettonMinter: jettonMinter1.address,
                },
                amountTransfer: toNano(100),
                createdAtOrder: Math.round(Number(new Date().getTime() / 1000)),
            }
        )
        expect(closeOrderResult.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultJetton1.address,
            success: false,
            exitCode: 403,
        });
    });

    it("CloseOrder (Vault) -> Success with valid sender", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )
        const order1 = getOrderWrapper(blockchain, jettonTransferResult, vaultJetton1.address);

        const closeOrderResult = await order1.sendCloseOrder(user1.getSender(), GAS_ORDER_CLOSE_ORDER + GAS_ORDER_CLOSE_ORDER + GAS_EXCESS);
        expect(closeOrderResult.transactions).toHaveTransaction({
            from: user1.address,
            to: order1.address,
            success: true,
            op: 0x52e80bac
        });
        expect(closeOrderResult.transactions).toHaveTransaction({
            from: order1.address,
            to: vaultJetton1.address,
            success: true,
            op: 0xa597947e
        });
    });

    it("JettonTransferNotification -> Failed with not enough gas", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        // Get initial balance
        const initialBalance = await jettonWallet1.getJettonBalance();

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
                owner: user1.address,
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: null,
                forwardTonAmount: GAS_CREATE_ORDER_JETTON - toNano(0.0001),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
                createdAt: Math.round(Number(new Date().getTime() / 1000))
            }
        )
        printTransactionFees(jettonTransferResult.transactions);

        // Transaction should be successful, jettons should be returned
        expect(jettonTransferResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: true,
        });

        // Check that jettons were returned to user
        expect(jettonTransferResult.transactions).toHaveTransaction({
            to: jettonWallet1.address,
            success: true,
            op: 0xf8a7ea5, // OP_CODE_JETTON_TRANSFER
        });

        // Verify balance was returned (should be same as initial)
        const finalBalance = await jettonWallet1.getJettonBalance();
        expect(finalBalance).toEqual(initialBalance);
    });

    it("JettonTransferNotification -> Success with enough gas", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )

        expect(jettonTransferResult.transactions).toHaveTransaction({
            success: true,
            from: vaultJetton1.address,
            op: 0x2d0e1e1b // InitOrder
        });
    });

    it("JettonTransferNotification -> Failed with invalid jetton wallet", async () => {
        const mintJetton1Result = await anotherJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        // printTransactionFees(mintJetton1Result.transactions);
        const anotherJettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);
        await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        // Get initial balance
        const initialBalance = await anotherJettonWallet1.getJettonBalance();

        const jettonTransferResult = await anotherJettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )
        printTransactionFees(jettonTransferResult.transactions);

        // Transaction should be successful, jettons should be returned
        expect(jettonTransferResult.transactions).toHaveTransaction({
            to: vaultJetton1.address,
            success: true,
        });

        // Check that jettons were returned to user
        expect(jettonTransferResult.transactions).toHaveTransaction({
            from: vaultJetton1.address,
            to: anotherJettonWallet1.address,
            success: true,
            op: 0xf8a7ea5, // OP_CODE_JETTON_TRANSFER
        });

        // Verify balance was returned (should be same as initial)
        const finalBalance = await anotherJettonWallet1.getJettonBalance();
        expect(finalBalance).toEqual(initialBalance);
    });

    it("JettonTransferNotification -> Success with valid jetton wallet", async () => {
        const mintJetton1Result = await jettonMinter1.sendMint(deployer.getSender(), user1.address, toNano(1000), null, null, null, undefined, undefined);
        const jettonWallet1 = getJettonWalletWrapper(blockchain, mintJetton1Result, jettonMinter1.address);

        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);
        const vaultJetton2InitResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE);

        const jettonTransferResult = await jettonWallet1.sendCreateOrder(
            user1.getSender(),
            toNano(0.15) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS,
            {
                jettonAmount: toNano(1000),
                vault: vaultJetton1.address,
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
        )

        expect(jettonTransferResult.transactions).toHaveTransaction({
            success: true,
            to: vaultJetton1.address,
            op: 0x7362d09c // JettonTransferNotification
        });
    });

    it("WithDraw (Vault) -> Failed with not enough gas", async () => {
        const vaultJetton1InitResult = await vaultJetton1.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_EXCESS);

        const withDrawResult = await vaultJetton1.sendWithDraw(deployer.getSender(), toNano(0.003), {
            feeAddress: deployer.address,
            amount: toNano(100),
        });

        expect(withDrawResult.transactions).toHaveTransaction({
            success: false,
            to: vaultJetton1.address,
            exitCode: 422,
        });
    });

    it("WithDraw (Vault) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW);
    });

    it("WithDraw (Vault) -> Failed with invalid sender (not from fee collector)", async () => {
        // TODO: Add test logic for assert(feeCollectorAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("WithDraw (Vault) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(feeCollectorAddress == in.senderAddress);
    });
});
