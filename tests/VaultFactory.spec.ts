import { Blockchain, BlockchainTransaction, printTransactionFees, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { flattenTransaction, randomAddress } from '@ton/test-utils';
import { JettonMinter, jettonMinterCodeCell, JettonMinterConfig, JettonMinterContent } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Vault2 } from '../wrappers/Vault2';
import { Order } from '../wrappers/Order';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { GAS_CREATE_ORDER_JETTON, GAS_CREATE_ORDER_TON, GAS_EXCESS, GAS_ORDER_FULL_MATCH, GAS_STORAGE, GAS_VAULT_FACTORY_CREATE_VAULT, GAS_VAULT_FACTORY_INIT, getJettonWalletWrapper, getOrderWrapper, getVaultTonWrapper, getVaultWrapper, mapOpcode, printGasUsage } from './Helper';
import { VaultTon } from '../wrappers/VaultTon';
import { createHash } from 'crypto';

describe('VaultFactory', () => {
    let code: Cell;
    let vaultCode: Cell;
    let vaultTonCode: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('VaultFactory');
        vaultCode = await compile('Vault');
        vaultTonCode = await compile('VaultTon');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vaultFactory: SandboxContract<VaultFactory>;
    let vaultTonFactory: SandboxContract<VaultFactory>;
    let fromJettonMinter: SandboxContract<JettonMinter>
    let fromJettonWallet: SandboxContract<JettonWallet>
    let fromVault: SandboxContract<Vault>
    let toJettonMinter: SandboxContract<JettonMinter>
    let toJettonWallet: SandboxContract<JettonWallet>
    let toVault: SandboxContract<Vault>
    let fromVaultTon: SandboxContract<VaultTon>

    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let matcher: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        matcher = await blockchain.treasury('matcher');

        vaultFactory = blockchain.openContract(VaultFactory.createFromConfig({
            vaultCode: vaultCode,
            orderCode: orderCode,
            feeCollectorCode: feeCollectorCode,
        }, code));

        vaultTonFactory = blockchain.openContract(VaultFactory.createFromConfig({
            vaultCode: vaultTonCode,
            orderCode: orderCode,
            feeCollectorCode: feeCollectorCode,
        }, code));

        const deployResult = await vaultFactory.sendDeploy(deployer.getSender(), GAS_VAULT_FACTORY_INIT + GAS_STORAGE + GAS_EXCESS);

        const deployTonFactoryResult = await vaultTonFactory.sendDeploy(deployer.getSender(), GAS_VAULT_FACTORY_INIT + GAS_STORAGE + GAS_EXCESS);

        // console.log("deployResultVaultFactory TRS")
        // printTransactionFees(deployResult.transactions, mapOpcode)

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            deploy: true,
            success: true,
        });

        expect(deployTonFactoryResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            deploy: true,
            success: true,
        });

        const fromJettonMinterContent: JettonMinterContent = {
            uri: 'from'
        }
        const fromJettonMinterConfig: JettonMinterConfig = {
            admin: deployer.address,
            wallet_code: jettonWalletCodeCell,
            jetton_content: fromJettonMinterContent
        }
        fromJettonMinter = blockchain.openContract(JettonMinter.createFromConfig(
            fromJettonMinterConfig,
            jettonMinterCodeCell,
            0
        ))

        const deployResultFromJettonMinter = await fromJettonMinter.sendDeploy(deployer.getSender(), toNano(0.5))

        expect(deployResultFromJettonMinter.transactions).toHaveTransaction({
            from: deployer.address,
            to: fromJettonMinter.address,
            deploy: true,
            success: true,
        });


        const resultUser1FromJettonWalletMint = await fromJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined)
        // console.log("FromJettonMinter TRS")
        // printTransactionFees(resultUser1FromJettonWalletMint.transactions)

        fromJettonWallet = getJettonWalletWrapper(blockchain, resultUser1FromJettonWalletMint, fromJettonMinter.address)

        const resultCreateVaultFrom = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, jettonWalletCodeCell, fromJettonMinter.address)

        // console.log("fromVault TRS")

        // printTransactionFees(resultCreateVaultFrom.transactions)

        fromVault = getVaultWrapper(blockchain, resultCreateVaultFrom)

        const resultCreateFromVaultTon = await vaultTonFactory.sendCreateVault(
            deployer.getSender(),
            GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS,
            null,
            null,
            
        )

        fromVaultTon = getVaultTonWrapper(blockchain, resultCreateFromVaultTon)

        // console.log("fromVaultTon TRS")

        // printTransactionFees(resultCreateFromVaultTon.transactions)


        const toJettonMinterContent: JettonMinterContent = {
            uri: 'to'
        }
        const toJettonMinterConfig: JettonMinterConfig = {
            admin: deployer.address,
            wallet_code: jettonWalletCodeCell,
            jetton_content: toJettonMinterContent
        }
        toJettonMinter = blockchain.openContract(JettonMinter.createFromConfig(
            toJettonMinterConfig,
            jettonMinterCodeCell,
            0
        ))

        const deployResultToJettonMinter = await toJettonMinter.sendDeploy(deployer.getSender(), toNano(0.5))

        expect(deployResultToJettonMinter.transactions).toHaveTransaction({
            from: deployer.address,
            to: toJettonMinter.address,
            deploy: true,
            success: true,
        });


        const resultUser2ToJettonWalletMint = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(100), null, null, null, undefined, undefined)

        // console.log("ToJettonMinter TRS")
        // printTransactionFees(resultUser2ToJettonWalletMint.transactions)

        toJettonWallet = getJettonWalletWrapper(blockchain, resultUser2ToJettonWalletMint, toJettonMinter.address)

        const resultCreateVaultTo = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, jettonWalletCodeCell, toJettonMinter.address)

        // console.log("toVault TRS")

        // printTransactionFees(resultCreateVaultTo.transactions)

        toVault = getVaultWrapper(blockchain, resultCreateVaultTo)
        // console.log(toVault.address)

    });


    it("init VaultFactory - success", async () => {
        const res = await vaultFactory.sendDeploy(deployer.getSender(), GAS_VAULT_FACTORY_INIT + GAS_STORAGE + GAS_EXCESS)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
    })

    it("init VaultFactory - error not enough gas", async () => {
        const res = await vaultFactory.sendDeploy(deployer.getSender(), toNano(0.001))
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: false,
            exitCode: 422,
        });
    })

    it("Success Create Vault with jetton", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, jettonWalletCodeCell, fromJettonMinter.address)
        // console.log((await blockchain.getContract(vaultFactory.address)).balance)
        // printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        expect((await blockchain.getContract(vaultFactory.address)).balance).toEqual(toNano(0.01)) // only gas storage
        // console.log((await blockchain.getContract(vaultFactory.address)).balance)
    })

    it("Success Create Vault with ton", async () => {
        const res = await vaultTonFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, null, null)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            success: true,
        });
    })

    it("Error Create Vault not enough gas", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.001), jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: false,
            exitCode: 422
        });
    })

    it("Full Cycle Jetton -> Jetton", async () => {
        const resMintJettonFrom = await fromJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletFrom = getJettonWalletWrapper(blockchain, resMintJettonFrom, fromJettonMinter.address)
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        const res = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        // console.log("resCreateVaultJETTON")
        // printTransactionFees(res.transactions, mapOpcode)
        const vault1 = getVaultWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, jettonWalletCodeCell, toJettonMinter.address)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        // console.log("resCreateVaultJETTON")
        // printTransactionFees(res2.transactions, mapOpcode)
        const vault2 = getVaultWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_0,", balanceVault2_0)

        const resCreateOrderFrom = await jettonWalletFrom.sendCreateOrder(user1.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(15),
            vault: vault1.address,
            owner: user1.address,
            priceRate: toNano(0.66),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })

        // console.log("resCreateOrderFrom JETTON")
        // printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1,", balanceVault1_1)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const balanceVault1_1_before_create_order_to = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1_before_create_order_to,", balanceVault1_1_before_create_order_to)

        const resCreateOrderTo = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(10),
            vault: vault2.address,
            owner: user2.address,
            priceRate: toNano(1.5),
            slippage: toNano(0.02),
            toJettonMinter: fromJettonMinter.address,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })

        const balanceVault1_1_after_create_order_to = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1_after_create_order_to,", balanceVault1_1_after_create_order_to)

        // console.log("resCreateOrderTo JETTON")
        // printTransactionFees(resCreateOrderTo.transactions, mapOpcode)


        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)
        const balanceOrder2 = (await blockchain.getContract(order2.address)).balance
        // console.log("balanceOrder2,", balanceOrder2)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH + GAS_EXCESS, {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        })

        // printFullInfoAboutFees(resultMatchOrder.transactions)
        // printTransactionFees(resultMatchOrder.transactions, mapOpcode)

        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order1.address,
            to: vault1.address,
            success: true,
        });

        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order2.address,
            to: vault2.address,
            success: true,
        });

        const balanceVault1_2 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_2,", balanceVault2_2)
    })

    it("Full Cycle Ton -> Jetton", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        const res = await vaultTonFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, null, null)
        // console.log("resCreateVaultTON")
        // printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            success: true,
        });


        const vault1 = getVaultTonWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, jettonWalletCodeCell, toJettonMinter.address)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        // console.log("resCreateVaultJETTON")
        // printTransactionFees(res2.transactions, mapOpcode)
        const vault2 = getVaultWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_0,", balanceVault2_0)

        const balanceVault1_1_before_create_order_from = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1_before_create_order_from,", balanceVault1_1_before_create_order_from)

        const resCreateOrderFrom = await vault1.sendCreateOrder(user1.getSender(), toNano(15) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(15),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("resCreateOrderFrom TON")
        // printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1_after_create_order_from = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1_after_create_order_from,", balanceVault1_1_after_create_order_from)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const balanceOrder1 = (await blockchain.getContract(order1.address)).balance
        // console.log("balanceOrder1,", balanceOrder1)

        const resCreateOrderTo = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(15),
            vault: vault2.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("resCreateOrderTo JETTON")
        // printTransactionFees(resCreateOrderTo.transactions, mapOpcode)

        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)

        const vault_TON_balance_before_match_order = (await blockchain.getContract(vault1.address)).balance
        // console.log("vault_TON_balance_before_match_order,", vault_TON_balance_before_match_order)

        const order_TON_balance_before_match_order = (await blockchain.getContract(order1.address)).balance
        // console.log("order_TON_balance_before_match_order,", order_TON_balance_before_match_order)

        const vault_JETTON_balance_before_match_order = (await blockchain.getContract(vault2.address)).balance
        // console.log("vault_JETTON_balance_before_match_order,", vault_JETTON_balance_before_match_order)

        const order_JETTON_balance_before_match_order = (await blockchain.getContract(order2.address)).balance
        // console.log("order_JETTON_balance_before_match_order,", order_JETTON_balance_before_match_order)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH + GAS_EXCESS, {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(15),
        })
        // printTransactionFees(resultMatchOrder.transactions, mapOpcode)

        const vault_TON_balance_after_match_order = (await blockchain.getContract(vault1.address)).balance
        // console.log("vault_TON_balance_after_match_order,", vault_TON_balance_after_match_order)

        const order_TON_balance_after_match_order = (await blockchain.getContract(order1.address)).balance
        // console.log("order_TON_balance_after_match_order,", order_TON_balance_after_match_order)

        const vault_JETTON_balance_after_match_order = (await blockchain.getContract(vault2.address)).balance
        // console.log("vault_JETTON_balance_after_match_order,", vault_JETTON_balance_after_match_order)

        const order_JETTON_balance_after_match_order = (await blockchain.getContract(order2.address)).balance
        // console.log("order_JETTON_balance_after_match_order,", order_JETTON_balance_after_match_order)


        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order1.address,
            to: vault1.address,
            success: true,
        });

        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order2.address,
            to: vault2.address,
            success: true,
        });

        const balanceVault1_2 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_2,", balanceVault2_2)
    })

    it("Full Cycle Jetton -> Ton", async () => {
        const resMintJettonFrom = await fromJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletFrom = getJettonWalletWrapper(blockchain, resMintJettonFrom, fromJettonMinter.address)

        const res = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS, jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vault1 = getVaultWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultTonFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, null, null)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            success: true,
        });
        const vault2 = getVaultTonWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_0,", balanceVault2_0)

        const resCreateOrderFrom = await jettonWalletFrom.sendCreateOrder(user1.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(15),
            vault: vault1.address,
            owner: user1.address,
            priceRate: toNano(0.66),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_1,", balanceVault1_1)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const resCreateOrderTo = await vault2.sendCreateOrder(user2.getSender(), toNano(10) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(10),
            priceRate: toNano(1.5),
            slippage: toNano(0.02),
            toJettonMinter: fromJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })

        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH + GAS_EXCESS, {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        })
        // printTransactionFees(resultMatchOrder.transactions, mapOpcode)

        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order1.address,
            to: vault1.address,
            success: true,
        });

        expect(resultMatchOrder.transactions).toHaveTransaction({
            from: order2.address,
            to: vault2.address,
            success: true,
        });

        const balanceVault1_2 = (await blockchain.getContract(vault1.address)).balance
        // console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        // console.log("balanceVault2_2,", balanceVault2_2)
    })

    it("TON -> JETTON: Two Sequential Matches with Same TON Vault", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(20000), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        // Create TON vault
        // console.log("create TON vault")
        const resVaultTon = await vaultTonFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, null, null)
        // console.log("resVaultTon TON")
        // printTransactionFees(resVaultTon.transactions, mapOpcode)
        expect(resVaultTon.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            success: true,
        });
        const vaultTon = getVaultTonWrapper(blockchain, resVaultTon)
        const vaultTonBalance_0 = (await blockchain.getContract(vaultTon.address)).balance
        // console.log("=== Vault TON balance after creation:", vaultTonBalance_0)

        // Create JETTON vault
        const resVaultJetton = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, jettonWalletCodeCell, toJettonMinter.address)
        expect(resVaultJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        // printTransactionFees(resVaultJetton.transactions, mapOpcode)
        const vaultJetton = getVaultWrapper(blockchain, resVaultJetton)
        const vaultTonBalance_0_jetton = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_0 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after JETTON vault creation:", vaultTonBalance_0_jetton)
        // console.log("=== Vault JETTON balance after creation:", vaultJettonBalance_0)

        // ========== FIRST MATCH ==========
        // console.log("\n--- FIRST MATCH ---")

        // Create first TON order
        const resCreateOrderTon1 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(500) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(500),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order TON 1 created")
        // printTransactionFees(resCreateOrderTon1.transactions, mapOpcode)
        const vaultTonBalance_1 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_1 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after TON order 1 creation:", vaultTonBalance_1)
        // console.log("=== Vault JETTON balance after TON order 1 creation:", vaultJettonBalance_1)
        const orderTon1 = getOrderWrapper(blockchain, resCreateOrderTon1, vaultTon.address)

        // Create first JETTON order
        const resCreateOrderJetton1 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(500),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("balanceTonInVaultjetton,", (await blockchain.getContract(vaultJetton.address)).balance)
        // console.log("Order JETTON 1 created")
        // printTransactionFees(resCreateOrderJetton1.transactions, mapOpcode)
        const vaultTonBalance_2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_2 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after JETTON order 1 creation:", vaultTonBalance_2)
        // console.log("=== Vault JETTON balance after JETTON order 1 creation:", vaultJettonBalance_2)
        const orderJetton1 = getOrderWrapper(blockchain, resCreateOrderJetton1, vaultJetton.address)

        // Match first orders
        const vaultTonBalance_before_match1 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match1 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance BEFORE match 1:", vaultTonBalance_before_match1)
        // console.log("=== Vault JETTON balance BEFORE match 1:", vaultJettonBalance_before_match1)

        const resultMatchOrder1 = await orderTon1.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton1.getData()).createdAt,
            amount: toNano(500),
        })
        // console.log("Match 1 executed")
        // printTransactionFees(resultMatchOrder1.transactions, mapOpcode)
        // printFullInfoAboutFees(resultMatchOrder1.transactions, vaultTon.address)


        // // --- start withdraw from vault ton after match 1 ---
        // console.log("--- start withdraw from vault ton after match 1 ---")
        // const feeCollectorTon = getFeeCollectorWrapper(blockchain, resultMatchOrder1, vaultTon.address)
        // const withDrawRes = await feeCollectorTon.sendWithDraw(user1.getSender(), toNano(1))
        // printTransactionFees(withDrawRes.transactions, mapOpcode)
        // console.log("--- end withdraw from vault ton after match 1 ---")
        // /// --- end withdraw from vault ton after match 1 ---

        const vaultTonBalance_after_match1 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_after_match1 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance AFTER match 1:", vaultTonBalance_after_match1)
        // console.log("=== Vault JETTON balance AFTER match 1:", vaultJettonBalance_after_match1)
        // console.log("=== Vault TON balance change in match 1:", vaultTonBalance_after_match1 - vaultTonBalance_before_match1)
        // console.log("=== Vault JETTON balance change in match 1:", vaultJettonBalance_after_match1 - vaultJettonBalance_before_match1)

        expect(resultMatchOrder1.transactions).toHaveTransaction({
            from: orderTon1.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder1.transactions).toHaveTransaction({
            from: orderJetton1.address,
            to: vaultJetton.address,
            success: true,
        });

        // ========== SECOND MATCH ==========
        // console.log("\n--- SECOND MATCH ---")

        // Create second TON order (same vault)
        const resCreateOrderTon2 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(1000) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(1000),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order TON 2 created (same vault)")
        // printTransactionFees(resCreateOrderTon2.transactions, mapOpcode)
        const vaultTonBalance_3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_3 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after TON order 2 creation:", vaultTonBalance_3)
        // console.log("=== Vault JETTON balance after TON order 2 creation:", vaultJettonBalance_3)
        const orderTon2 = getOrderWrapper(blockchain, resCreateOrderTon2, vaultTon.address)

        // Create second JETTON order
        const resCreateOrderJetton2 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(1000),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order JETTON 2 created")
        // printTransactionFees(resCreateOrderJetton2.transactions, mapOpcode)
        const vaultTonBalance_4 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_4 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after JETTON order 2 creation:", vaultTonBalance_4)
        // console.log("=== Vault JETTON balance after JETTON order 2 creation:", vaultJettonBalance_4)
        const orderJetton2 = getOrderWrapper(blockchain, resCreateOrderJetton2, vaultJetton.address)

        // Match second orders
        const vaultTonBalance_before_match2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match2 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance BEFORE match 2:", vaultTonBalance_before_match2)
        // console.log("=== Vault JETTON balance BEFORE match 2:", vaultJettonBalance_before_match2)

        const resultMatchOrder2 = await orderTon2.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton2.getData()).createdAt,
            amount: toNano(1000),
        })
        // printTransactionFees(resultMatchOrder2.transactions, mapOpcode)

        // console.log("Match 2 executed")
        // printTransactionFees(resultMatchOrder2.transactions, mapOpcode)

        // // --- start withdraw from vault ton after match 2 ---
        // console.log("--- start withdraw from vault ton after match 2 ---")
        // const feeCollectorTon2 = getFeeCollectorWrapper(blockchain, resultMatchOrder2, vaultTon.address)
        // const withDrawRes2 = await feeCollectorTon2.sendWithDraw(user1.getSender(), toNano(1))
        // printTransactionFees(withDrawRes2.transactions, mapOpcode)
        // console.log("--- end withdraw from vault ton after match 2 ---")
        // /// --- end withdraw from vault ton after match 2 ---

        const vaultTonBalance_after_match2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_after_match2 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance AFTER match 2:", vaultTonBalance_after_match2)
        // console.log("=== Vault JETTON balance AFTER match 2:", vaultJettonBalance_after_match2)
        // console.log("=== Vault TON balance change in match 2:", vaultTonBalance_after_match2 - vaultTonBalance_before_match2)
        // console.log("=== Vault JETTON balance change in match 2:", vaultJettonBalance_after_match2 - vaultJettonBalance_before_match2)

        expect(resultMatchOrder2.transactions).toHaveTransaction({
            from: orderTon2.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder2.transactions).toHaveTransaction({
            from: orderJetton2.address,
            to: vaultJetton.address,
            success: true,
        });

        // ========== THIRD MATCH ==========
        // console.log("\n--- THIRD MATCH ---")

        // Create third TON order (same vault)
        const resCreateOrderTon3 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(500) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(500),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order TON 3 created (same vault)")
        // printTransactionFees(resCreateOrderTon3.transactions, mapOpcode)
        const vaultTonBalance_5 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_5 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after TON order 3 creation:", vaultTonBalance_5)
        // console.log("=== Vault JETTON balance after TON order 3 creation:", vaultJettonBalance_5)
        const orderTon3 = getOrderWrapper(blockchain, resCreateOrderTon3, vaultTon.address)

        // Create third JETTON order
        const resCreateOrderJetton3 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(500),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order JETTON 3 created")
        // printTransactionFees(resCreateOrderJetton3.transactions, mapOpcode)
        const vaultTonBalance_6 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_6 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance after JETTON order 3 creation:", vaultTonBalance_6)
        // console.log("=== Vault JETTON balance after JETTON order 3 creation:", vaultJettonBalance_6)
        const orderJetton3 = getOrderWrapper(blockchain, resCreateOrderJetton3, vaultJetton.address)

        // Match third orders
        const vaultTonBalance_before_match3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match3 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance BEFORE match 3:", vaultTonBalance_before_match3)
        // console.log("=== Vault JETTON balance BEFORE match 3:", vaultJettonBalance_before_match3)

        const resultMatchOrder3 = await orderTon3.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton3.getData()).createdAt,
            amount: toNano(500),
        })
        // console.log("Match 3 executed")
        // printTransactionFees(resultMatchOrder3.transactions, mapOpcode)

        // // --- start withdraw from vault ton after match 3 ---
        // console.log("--- start withdraw from vault ton after match 3 ---")
        // const feeCollectorTon3 = getFeeCollectorWrapper(blockchain, resultMatchOrder3, vaultTon.address)
        // const withDrawRes3 = await feeCollectorTon3.sendWithDraw(user1.getSender(), toNano(1))
        // printTransactionFees(withDrawRes3.transactions, mapOpcode)
        // console.log("--- end withdraw from vault ton after match 3 ---")
        // /// --- end withdraw from vault ton after match 3 ---

        const vaultTonBalance_after_match3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_after_match3 = (await blockchain.getContract(vaultJetton.address)).balance
        // console.log("=== Vault TON balance AFTER match 3:", vaultTonBalance_after_match3)
        // console.log("=== Vault JETTON balance AFTER match 3:", vaultJettonBalance_after_match3)
        // console.log("=== Vault TON balance change in match 3:", vaultTonBalance_after_match3 - vaultTonBalance_before_match3)
        // console.log("=== Vault JETTON balance change in match 3:", vaultJettonBalance_after_match3 - vaultJettonBalance_before_match3)

        expect(resultMatchOrder3.transactions).toHaveTransaction({
            from: orderTon3.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder3.transactions).toHaveTransaction({
            from: orderJetton3.address,
            to: vaultJetton.address,
            success: true,
        });

        // Summary
        // console.log("\n--- SUMMARY ---")
        // console.log("=== Vault TON balance initial:", vaultTonBalance_0)
        // console.log("=== Vault TON balance after match 1:", vaultTonBalance_after_match1)
        // console.log("=== Vault TON balance after match 2:", vaultTonBalance_after_match2)
        // console.log("=== Vault TON balance after match 3:", vaultTonBalance_after_match3)
        // console.log("=== Vault TON balance total change:", vaultTonBalance_after_match3 - vaultTonBalance_0)
        // console.log("=== Vault JETTON balance initial:", vaultJettonBalance_0)
        // console.log("=== Vault JETTON balance after match 1:", vaultJettonBalance_after_match1)
        // console.log("=== Vault JETTON balance after match 2:", vaultJettonBalance_after_match2)
        // console.log("=== Vault JETTON balance after match 3:", vaultJettonBalance_after_match3)
        // console.log("=== Vault JETTON balance total change:", vaultJettonBalance_after_match3 - vaultJettonBalance_0)
    })

    it("TON -> JETTON: Partial Matches - Check Order Balance Changes", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(20000), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        // Create TON vault
        const resVaultTon = await vaultTonFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, null, null)
        expect(resVaultTon.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTonFactory.address,
            success: true,
        });
        const vaultTon = getVaultTonWrapper(blockchain, resVaultTon)

        // Create JETTON vault
        const resVaultJetton = await vaultFactory.sendCreateVault(deployer.getSender(), GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE, jettonWalletCodeCell, toJettonMinter.address)
        expect(resVaultJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vaultJetton = getVaultWrapper(blockchain, resVaultJetton)

        // Create TON order with amount 1000
        const resCreateOrderTon = await vaultTon.sendCreateOrder(user1.getSender(), toNano(1000) + GAS_CREATE_ORDER_TON + GAS_EXCESS, {
            amount: toNano(1000),
            priceRate: toNano(1),
            slippage: toNano(0.01),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order TON created")
        // printTransactionFees(resCreateOrderTon.transactions, mapOpcode)
        const orderTon = getOrderWrapper(blockchain, resCreateOrderTon, vaultTon.address)
        
        // Get initial order balance
        const orderTonDataInitial = await orderTon.getData()
        const orderTonBalanceInitial = orderTonDataInitial.exchangeInfo.amount
        const orderTonContractBalanceInitial = (await blockchain.getContract(orderTon.address)).balance
        // console.log("=== Order TON initial balance:", orderTonBalanceInitial)
        // console.log("=== Order TON contract balance initial:", orderTonContractBalanceInitial)

        // Create JETTON order with amount 1000
        const resCreateOrderJetton = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(0.05) + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, {
            jettonAmount: toNano(1000),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.01),
            toJettonMinter: null,
            forwardTonAmount: GAS_CREATE_ORDER_JETTON,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
            createdAt: Math.round(Number(new Date().getTime() / 1000))
        })
        // console.log("Order JETTON created")
        // printTransactionFees(resCreateOrderJetton.transactions, mapOpcode)
        const orderJetton = getOrderWrapper(blockchain, resCreateOrderJetton, vaultJetton.address)
        
        // Get initial order balance
        const orderJettonDataInitial = await orderJetton.getData()
        const orderJettonBalanceInitial = orderJettonDataInitial.exchangeInfo.amount
        const orderJettonContractBalanceInitial = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order JETTON initial balance:", orderJettonBalanceInitial)
        // console.log("=== Order JETTON contract balance initial:", orderJettonContractBalanceInitial)

        // ========== FIRST MATCH (300) ==========
        // console.log("\n--- FIRST MATCH (300) ---")
        
        const orderTonDataBeforeMatch1 = await orderTon.getData()
        const orderJettonDataBeforeMatch1 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch1 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch1 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance BEFORE match 1:", orderTonDataBeforeMatch1.exchangeInfo.amount)
        // console.log("=== Order TON contract balance BEFORE match 1:", orderTonContractBalanceBeforeMatch1)
        // console.log("=== Order JETTON balance BEFORE match 1:", orderJettonDataBeforeMatch1.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance BEFORE match 1:", orderJettonContractBalanceBeforeMatch1)


        const matchAmount1 = toNano(300);

        const resultMatchOrder1 = await orderTon.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: matchAmount1,
        })
        // printGasUsage(resultMatchOrder1.transactions, mapOpcode)
        // console.log("Match 1 executed (300)")
        // printTransactionFees(resultMatchOrder1.transactions, mapOpcode)

        const orderTonDataAfterMatch1 = await orderTon.getData()
        const orderJettonDataAfterMatch1 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch1 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch1 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance AFTER match 1:", orderTonDataAfterMatch1.exchangeInfo.amount)
        // console.log("=== Order TON contract balance AFTER match 1:", orderTonContractBalanceAfterMatch1)
        // console.log("=== Order TON balance change in match 1:", orderTonDataAfterMatch1.exchangeInfo.amount - orderTonDataBeforeMatch1.exchangeInfo.amount)
        // console.log("=== Order TON contract balance change in match 1:", orderTonContractBalanceAfterMatch1 - orderTonContractBalanceBeforeMatch1)
        // console.log("=== Order JETTON balance AFTER match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance AFTER match 1:", orderJettonContractBalanceAfterMatch1)
        // console.log("=== Order JETTON balance change in match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount - orderJettonDataBeforeMatch1.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance change in match 1:", orderJettonContractBalanceAfterMatch1 - orderJettonContractBalanceBeforeMatch1)

        expect(orderTonDataAfterMatch1.exchangeInfo.amount).toBe(orderTonBalanceInitial - matchAmount1)
        expect(orderJettonDataAfterMatch1.exchangeInfo.amount).toBe(orderJettonBalanceInitial - matchAmount1)

        expect(resultMatchOrder1.transactions).toHaveTransaction({
            from: orderTon.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder1.transactions).toHaveTransaction({
            from: orderJetton.address,
            to: vaultJetton.address,
            success: true,
        });

        // ========== SECOND MATCH (300) ==========
        // console.log("\n--- SECOND MATCH (300) ---")
        
        const orderTonDataBeforeMatch2 = await orderTon.getData()
        const orderJettonDataBeforeMatch2 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch2 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch2 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance BEFORE match 2:", orderTonDataBeforeMatch2.exchangeInfo.amount)
        // console.log("=== Order TON contract balance BEFORE match 2:", orderTonContractBalanceBeforeMatch2)
        // console.log("=== Order JETTON balance BEFORE match 2:", orderJettonDataBeforeMatch2.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance BEFORE match 2:", orderJettonContractBalanceBeforeMatch2)


        const matchAmount2 = toNano(300);

        const resultMatchOrder2 = await orderTon.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: matchAmount2,
        })
        // console.log("Match 2 executed (300)")
        // printTransactionFees(resultMatchOrder2.transactions, mapOpcode)

        const orderTonDataAfterMatch2 = await orderTon.getData()
        const orderJettonDataAfterMatch2 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch2 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch2 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance AFTER match 2:", orderTonDataAfterMatch2.exchangeInfo.amount)
        // console.log("=== Order TON contract balance AFTER match 2:", orderTonContractBalanceAfterMatch2)
        // console.log("=== Order TON balance change in match 2:", orderTonDataAfterMatch2.exchangeInfo.amount - orderTonDataBeforeMatch2.exchangeInfo.amount)
        // console.log("=== Order TON contract balance change in match 2:", orderTonContractBalanceAfterMatch2 - orderTonContractBalanceBeforeMatch2)
        // console.log("=== Order JETTON balance AFTER match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance AFTER match 2:", orderJettonContractBalanceAfterMatch2)
        // console.log("=== Order JETTON balance change in match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount - orderJettonDataBeforeMatch2.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance change in match 2:", orderJettonContractBalanceAfterMatch2 - orderJettonContractBalanceBeforeMatch2)

        expect(orderTonDataAfterMatch2.exchangeInfo.amount).toBe(orderTonBalanceInitial - matchAmount1 - matchAmount2)
        expect(orderJettonDataAfterMatch2.exchangeInfo.amount).toBe(orderJettonBalanceInitial - matchAmount1 - matchAmount2)

        expect(resultMatchOrder2.transactions).toHaveTransaction({
            from: orderTon.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder2.transactions).toHaveTransaction({
            from: orderJetton.address,
            to: vaultJetton.address,
            success: true,
        });

        // ========== THIRD MATCH (400) ==========
        // console.log("\n--- THIRD MATCH (400) ---")
        
        const orderTonDataBeforeMatch3 = await orderTon.getData()
        const orderJettonDataBeforeMatch3 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch3 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch3 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance BEFORE match 3:", orderTonDataBeforeMatch3.exchangeInfo.amount)
        // console.log("=== Order TON contract balance BEFORE match 3:", orderTonContractBalanceBeforeMatch3)
        // console.log("=== Order JETTON balance BEFORE match 3:", orderJettonDataBeforeMatch3.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance BEFORE match 3:", orderJettonContractBalanceBeforeMatch3)

        const matchAmount3 = toNano(400);

        const resultMatchOrder3 = await orderTon.sendMatchOrder(user1.getSender(), GAS_ORDER_FULL_MATCH, {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: matchAmount3,
        })
        // console.log("Match 3 executed (400)")
        // printTransactionFees(resultMatchOrder3.transactions, mapOpcode)

        const orderTonDataAfterMatch3 = await orderTon.getData()
        const orderJettonDataAfterMatch3 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch3 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch3 = (await blockchain.getContract(orderJetton.address)).balance
        // console.log("=== Order TON balance AFTER match 3:", orderTonDataAfterMatch3.exchangeInfo.amount)
        // console.log("=== Order TON contract balance AFTER match 3:", orderTonContractBalanceAfterMatch3)
        // console.log("=== Order TON balance change in match 3:", orderTonDataAfterMatch3.exchangeInfo.amount - orderTonDataBeforeMatch3.exchangeInfo.amount)
        // console.log("=== Order TON contract balance change in match 3:", orderTonContractBalanceAfterMatch3 - orderTonContractBalanceBeforeMatch3)
        // console.log("=== Order JETTON balance AFTER match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance AFTER match 3:", orderJettonContractBalanceAfterMatch3)
        // console.log("=== Order JETTON balance change in match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount - orderJettonDataBeforeMatch3.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance change in match 3:", orderJettonContractBalanceAfterMatch3 - orderJettonContractBalanceBeforeMatch3)

        expect(orderTonDataAfterMatch3.exchangeInfo.amount).toBe(orderTonBalanceInitial - matchAmount1 - matchAmount2 - matchAmount3)
        expect(orderJettonDataAfterMatch3.exchangeInfo.amount).toBe(orderJettonBalanceInitial - matchAmount1 - matchAmount2 - matchAmount3)

        expect(resultMatchOrder3.transactions).toHaveTransaction({
            from: orderTon.address,
            to: vaultTon.address,
            success: true,
        });

        expect(resultMatchOrder3.transactions).toHaveTransaction({
            from: orderJetton.address,
            to: vaultJetton.address,
            success: true,
        });

        // Summary
        // console.log("\n--- SUMMARY ---")
        // console.log("=== Order TON initial balance:", orderTonBalanceInitial)
        // console.log("=== Order TON initial contract balance:", orderTonContractBalanceInitial)
        // console.log("=== Order TON balance after match 1:", orderTonDataAfterMatch1.exchangeInfo.amount)
        // console.log("=== Order TON contract balance after match 1:", orderTonContractBalanceAfterMatch1)
        // console.log("=== Order TON balance after match 2:", orderTonDataAfterMatch2.exchangeInfo.amount)
        // console.log("=== Order TON contract balance after match 2:", orderTonContractBalanceAfterMatch2)
        // console.log("=== Order TON balance after match 3:", orderTonDataAfterMatch3.exchangeInfo.amount)
        // console.log("=== Order TON contract balance after match 3:", orderTonContractBalanceAfterMatch3)
        // console.log("=== Order TON total change:", orderTonDataAfterMatch3.exchangeInfo.amount - orderTonBalanceInitial)
        // console.log("=== Order TON contract balance total change:", orderTonContractBalanceAfterMatch3 - orderTonContractBalanceInitial)
        // console.log("=== Order JETTON initial balance:", orderJettonBalanceInitial)
        // console.log("=== Order JETTON initial contract balance:", orderJettonContractBalanceInitial)
        // console.log("=== Order JETTON balance after match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance after match 1:", orderJettonContractBalanceAfterMatch1)
        // console.log("=== Order JETTON balance after match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance after match 2:", orderJettonContractBalanceAfterMatch2)
        // console.log("=== Order JETTON balance after match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount)
        // console.log("=== Order JETTON contract balance after match 3:", orderJettonContractBalanceAfterMatch3)
        // console.log("=== Order JETTON total change:", orderJettonDataAfterMatch3.exchangeInfo.amount - orderJettonBalanceInitial)
        // console.log("=== Order JETTON contract balance total change:", orderJettonContractBalanceAfterMatch3 - orderJettonContractBalanceInitial)
    })

    it("CreateVault -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
    });

    it("CreateVault -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE);
    });

    it("InitVaultFactory -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_FACTORY_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
    });

    it("InitVaultFactory -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_FACTORY_INIT + GAS_STORAGE);
    });
});
