import { Blockchain, printTransactionFees, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
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


export function getJettonWalletWrapper(blockchain: Blockchain, trs: SendMessageResult, jettonMinter: Address)  {
    const jettonDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x178d4519;
    });
    const jettonWallet = blockchain.openContract(JettonWallet.createFromAddress(flattenTransaction(jettonDeployTrs!).to!));
    
    return jettonWallet;
}

export function getVaultWrapper(blockchain: Blockchain, trs: SendMessageResult)  {
    const vaultDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2717c4a2;
    });
    const vault = blockchain.openContract(Vault.createFromAddress(flattenTransaction(vaultDeployTrs!).to!));
    
    return vault;
}

export function getFeeCollectorWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const feeCollectorDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        // return (tx.op == 0xfc7532f4 && tx.from!.equals(vaultAddress));
        // return tx.from?.toRawString() == vaultAddress.toRawString();
        return (tx.op == 0xfc7532f4) && (tx.from?.equals(vaultAddress));
    });
    
    if (!feeCollectorDeployTrs) {
        throw new Error('FeeCollector deployment transaction not found');
    }
    
    const feeCollector = blockchain.openContract(FeeCollector.createFromAddress(flattenTransaction(feeCollectorDeployTrs).to!));
    
    return feeCollector;
}

export function getOrderWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const orderDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2d0e1e1b;
    });
    const order = blockchain.openContract(Order.createFromAddress(flattenTransaction(orderDeployTrs!).to!));
    
    return order;
}


describe('VaultFactory', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('VaultFactory');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vaultFactory: SandboxContract<VaultFactory>;
    let fromJettonMinter: SandboxContract<JettonMinter>
    let fromJettonWallet: SandboxContract<JettonWallet>
    let fromVault: SandboxContract<Vault>
    let toJettonMinter: SandboxContract<JettonMinter>
    let toJettonWallet: SandboxContract<JettonWallet>
    let toVault: SandboxContract<Vault>
    let fromVaultTon: SandboxContract<Vault>

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
            owner: deployer.address,
            vaultCode: await compile('Vault'),
            orderCode: await compile('Order'),
            feeCollectorCode: await compile('FeeCollector'),
            comissionInfo: {
                comission_num: 2,
                comission_denom: 100,
            },
            comissionInfoMatcher: {
                comission_num: 1,
                comission_denom: 100,
            },
        }, code));


        const deployResult = await vaultFactory.sendDeploy(deployer.getSender(), toNano('1'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
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

        const resultCreateVaultFrom = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.0065 + 0.0019 + 0.01), jettonWalletCodeCell, fromJettonMinter.address)

        // console.log("fromVault TRS")

        // printTransactionFees(resultCreateVaultFrom.transactions)

        fromVault = getVaultWrapper(blockchain, resultCreateVaultFrom)

        const resultCreateFromVaultTon = await vaultFactory.sendCreateVault(
            deployer.getSender(),
            toNano(1),
            null,
            null,
            
        )

        fromVaultTon = getVaultWrapper(blockchain, resultCreateFromVaultTon)

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

        const resultCreateVaultTo = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address)

        // console.log("toVault TRS")

        // printTransactionFees(resultCreateVaultTo.transactions)

        toVault = getVaultWrapper(blockchain, resultCreateVaultTo)
        // console.log(toVault.address)

    });

    // it('should deploy vault', async () => {
    //     const deployResultVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano('1'), beginCell().endCell(), randomAddress());
    //     const vault = getVaultWrapper(blockchain, deployResultVault)
    //     printTransactionFees(deployResultVault.transactions)
    //     console.log(await vault.getData())
    // });

    // it('should change owner', async () => {
    //     const oldOwner = await vaultFactory.getOwner();
    //     const changeOwnerResult = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano('0.0015'), user1.address);
    //     printTransactionFees(changeOwnerResult.transactions)
    //     const newOwner = await vaultFactory.getOwner();
    //     expect(oldOwner).not.toBe(newOwner);
    // });

    // it('should change commission', async () => {
    //     const oldCommission = await vaultFactory.getCommission();
    //     const changeCommissionResult = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano('0.002'), {
    //         comission_num: 1,
    //         comission_denom: 5,
    //     });
    //     printTransactionFees(changeCommissionResult.transactions)
    //     const newCommission = await vaultFactory.getCommission();
    //     expect(oldCommission.comission_num).not.toBe(newCommission.comission_num);
    //     expect(oldCommission.comission_denom).not.toBe(newCommission.comission_denom);
    // });

    // it('should deploy order', async () => {
    //     const amount = await fromJettonWallet.getJettonBalance()
    //     const priceRate = toNano(0.5)
    //     const toJettonMinterAddress = toJettonMinter.address
        
    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.14),
    //         {
    //             jettonAmount: amount,
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: priceRate,
    //             slippage: toNano(0.01),
    //             toJettonMinter: toJettonMinterAddress,
    //             forwardTonAmount: toNano(0.09)
    //         }
    //     )
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)
    //     const orderData = await fromOrder.getData()

    //     console.log(orderData)

    //     expect(orderData.exchangeInfo.amount).toBe(amount)
    //     expect(orderData.exchangeInfo.priceRate).toBe(priceRate)
    //     expect(orderData.exchangeInfo.fromJettonMinter!.toRawString()).toBe(fromJettonMinter.address.toRawString())
    //     expect(orderData.exchangeInfo.toJettonMinter!.toRawString()).toBe(toJettonMinter.address.toRawString())
    //     expect(orderData.owner.toRawString()).toBe(user1.address.toRawString())
    //     expect(orderData.vault.toRawString()).toBe(fromVault.address.toRawString())
    // });

    // it('should match order jetton-jetton', async () => {
    //     console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
    //     const toJettonMinterAddress = toJettonMinter.address
        
    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.04),
    //         {
    //             jettonAmount: toNano(100),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(1.01),
    //             slippage: toNano(0.02),
    //             toJettonMinter: toJettonMinterAddress,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )
    //     console.log("JETTON fromOrder TRS")
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

    //     console.log(await fromOrder.getData())


    //     const toPriceRate = toNano(2)
    //     const toFromJettonMinterAddress = fromJettonMinter.address
        
    //     const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(0.5),
    //         {
    //             jettonAmount: toNano(10),
    //             vault: toVault.address,
    //             owner: user2.address,
    //             priceRate: toNano(1),
    //             slippage: toNano(0.02),
    //             toJettonMinter: toFromJettonMinterAddress,
    //             forwardTonAmount: toNano(0.1)
    //         }
    //     )
    //     console.log("JETTON toOrder TRS")
    //     printTransactionFees(resultCreateToOrder.transactions)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

    //     console.log(await toOrder.getData())

    //     console.log("Before match order")

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await fromOrder.getData()).createdAt,
    //             amount: toNano(10)
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)

    //     console.log("amount FromOrder after match", await fromOrder.getData())
    //     console.log("amount ToOrder after match", await toOrder.getData())

    //     console.log("amount from vault", await fromVault.getData())
    //     console.log("amount to vault", await toVault.getData())

    //     console.log("FromVault address", fromVault.address)
    //     console.log("ToVault address", toVault.address)

    //     console.log("After fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("After toJettonWallet", await toJettonWallet.getWalletData())
    // });

    // it('should close order', async () => {
    //     const fromAmount = await fromJettonWallet.getJettonBalance()
    //     const toAmount = toNano(50)
    //     const toJettonMinterAddress = toJettonMinter.address

    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.5),
    //         {
    //             jettonAmount: fromAmount,
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toAmount,
    //             slippage: toNano(0.01),
    //             toJettonMinter: toJettonMinterAddress,
    //             forwardTonAmount: toNano(0.1)
    //         }
    //     )
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)
    //     console.log("fromOrder", await fromOrder.getData())

    //     const vaultData = await fromVault.getData()
    //     console.log("vaultData", vaultData)

    //     const resultCloseOrder = await fromOrder.sendCloseOrder(user1.getSender(), toNano(1))
    //     printTransactionFees(resultCloseOrder.transactions)

    //     const vaultDataAfterClose = await fromVault.getData()
    //     console.log("vaultDataAfterClose", vaultDataAfterClose)
    // })

    // it('should match order ton-jetton', async () => {
    //     console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
    //     const resultCreateOrder = await fromVaultTon.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(9.9 + 0.002 + 0.01 + 0.007),
    //         {
    //             amount: toNano(9.9),
    //             priceRate: toNano(2),
    //             slippage: toNano(0.02),
    //             toJettonMinter: toJettonMinter.address,
    //         }
    //     )
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

    //     console.log(await fromOrder.getData())


    //     const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(0.5),
    //         {
    //             jettonAmount: toNano(18),
    //             vault: toVault.address,
    //             owner: user2.address,
    //             priceRate: toNano(0.5),
    //             slippage: toNano(0.02),
    //             toJettonMinter: null,
    //             forwardTonAmount: toNano(0.1)
    //         }
    //     )
    //     printTransactionFees(resultCreateToOrder.transactions)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

    //     console.log(await toOrder.getData())

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(9.9)
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)

    //     console.log("amount FromOrder after match", await fromOrder.getData())
    //     console.log("amount ToOrder after match", await toOrder.getData())

    //     console.log("amount from vault", await fromVaultTon.getData())
    //     console.log("amount to vault", await toVault.getData())

    //     console.log("FromVault address", fromVaultTon.address)
    //     console.log("ToVault address", toVault.address)

    // });

    // it('should match order jetton-ton', async () => {
    //     console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.5),
    //         {
    //             jettonAmount: toNano(9),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(2),
    //             slippage: toNano(0.02),
    //             toJettonMinter: null,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.0057)
    //         }
    //     )
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

    //     console.log(await fromOrder.getData())


    //     const resultCreateToOrder = await fromVaultTon.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(19),
    //         {
    //             amount: toNano(18.9),
    //             priceRate: toNano(0.5),
    //             slippage: toNano(0.02),
    //             toJettonMinter: fromJettonMinter.address,
    //         }
    //     )
    //     printTransactionFees(resultCreateToOrder.transactions)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, fromVaultTon.address)

    //     console.log(await toOrder.getData())

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: fromVaultTon.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(18.9)
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)

    //     console.log("amount FromOrder after match", await fromOrder.getData())
    //     console.log("amount ToOrder after match", await toOrder.getData())

    //     console.log("amount from vault", await fromVaultTon.getData())
    //     console.log("amount to vault", await toVault.getData())

    //     console.log("FromVault address", fromVaultTon.address)
    //     console.log("ToVault address", toVault.address)

    // });

    // it('should match order jetton-jetton & WithDraw', async () => {
    //     console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
    //     const toJettonMinterAddress = toJettonMinter.address
        
    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.064),
    //         {
    //             jettonAmount: toNano(100),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(1.01),
    //             slippage: toNano(0.02),
    //             toJettonMinter: toJettonMinterAddress,
    //             forwardTonAmount: toNano(0.024)
    //         }
    //     )
    //     console.log("JETTON fromOrder TRS")
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

    //     console.log(await fromOrder.getData())


    //     const toPriceRate = toNano(2)
    //     const toFromJettonMinterAddress = fromJettonMinter.address
        
    //     const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(0.5),
    //         {
    //             jettonAmount: toNano(10),
    //             vault: toVault.address,
    //             owner: user2.address,
    //             priceRate: toNano(1),
    //             slippage: toNano(0.02),
    //             toJettonMinter: toFromJettonMinterAddress,
    //             forwardTonAmount: toNano(0.1)
    //         }
    //     )
    //     console.log("JETTON toOrder TRS")
    //     printTransactionFees(resultCreateToOrder.transactions)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

    //     console.log(await toOrder.getData())

    //     console.log("Before match order")

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(10)
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)

    //     // console.log("amount FromOrder after match", await fromOrder.getData())
    //     // console.log("amount ToOrder after match", await toOrder.getData())

    //     // console.log("amount from vault", await fromVault.getData())
    //     // console.log("amount to vault", await toVault.getData())

    //     // console.log("FromVault address", fromVault.address)
    //     // console.log("ToVault address", toVault.address)

    //     // console.log("After fromJettonWallet", await fromJettonWallet.getWalletData())
    //     // console.log("After toJettonWallet", await toJettonWallet.getWalletData())

    //     console.log("Before withDraw")
    //     console.log("FromVault balance", await fromVault.getData())
    //     const resultWithDraw = await vaultFactory.sendWithDraw(deployer.getSender(), toNano(0.07 + 0.07), fromVault.address)
    //     printTransactionFees(resultWithDraw.transactions)
    //     console.log("After withDraw")
    //     console.log("FromVault balance", await fromVault.getData())

    // });

    // it('should match order jetton-ton & WithDraw', async () => {
    //     console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
    //     console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
    //     const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
    //         {
    //             jettonAmount: toNano(9),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(2),
    //             slippage: toNano(0.02),
    //             toJettonMinter: null,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )
    //     printTransactionFees(resultCreateOrder.transactions)
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

    //     console.log(await fromOrder.getData())


    //     const resultCreateToOrder = await fromVaultTon.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(10),
    //         {
    //             amount: toNano(9.9),
    //             priceRate: toNano(0.5),
    //             slippage: toNano(0.02),
    //             toJettonMinter: fromJettonMinter.address,
    //         }
    //     )
    //     printTransactionFees(resultCreateToOrder.transactions)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, fromVaultTon.address)

    //     console.log(await toOrder.getData())

    //     console.log("amount before match from vault", await fromVault.getData())
    //     console.log("amount before match to vault", await fromVaultTon.getData())
    //     console.log("amount before match from order", await fromOrder.getData())
    //     console.log("amount before match to order", await toOrder.getData())

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: fromVaultTon.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(7)
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)

    //     // console.log("amount FromOrder after match", await fromOrder.getData())
    //     // console.log("amount ToOrder after match", await toOrder.getData())

    //     console.log("amount after match from vault", await fromVault.getData())
    //     console.log("amount after match to vault", await fromVaultTon.getData())
    //     console.log("amount after match from order", await fromOrder.getData())
    //     console.log("amount after match to order", await toOrder.getData())

    //     console.log("FromVault address", fromVaultTon.address)
    //     console.log("ToVault address", toVault.address)

    //     console.log("WithDraw")
    //     const resultWithDraw = await vaultFactory.sendWithDraw(deployer.getSender(), toNano(0.07 + 0.07), fromVaultTon.address)
    //     printTransactionFees(resultWithDraw.transactions)
    //     console.log("After withDraw")
    //     console.log("FromVault balance", await fromVaultTon.getData())

    //     const feeCollectorFromVaultTon = getFeeCollectorWrapper(blockchain, resultMatchOrder, fromVaultTon.address)
    //     console.log("WithDraw Matcher")
    //     const resultWithDrawMatcheFromVaultTon = await feeCollectorFromVaultTon.sendWithDraw(user1.getSender(), toNano(0.07 + 0.07))
    //     printTransactionFees(resultWithDrawMatcheFromVaultTon.transactions)

    //     const feeCollectorFromVault = getFeeCollectorWrapper(blockchain, resultMatchOrder, fromVault.address)
    //     console.log("WithDraw Matcher")
    //     const resultWithDrawMatcherFromVault = await feeCollectorFromVault.sendWithDraw(user1.getSender(), toNano(0.07 + 0.07))
    //     printTransactionFees(resultWithDrawMatcherFromVault.transactions)
    // });

    // it('should revert match order', async () => {
    //     const resultCreateFromOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.64),
    //         {
    //             jettonAmount: toNano(4),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(100),
    //             slippage: toNano(0.01),
    //             toJettonMinter: toJettonMinter.address,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )
    //     const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
    //         {
    //             jettonAmount: toNano(30),
    //             vault: toVault.address,
    //             owner: user2.address,
    //             priceRate: toNano(0.1),
    //             slippage: toNano(0.01),
    //             toJettonMinter: fromJettonMinter.address,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )

    //     const fromOrder = getOrderWrapper(blockchain, resultCreateFromOrder, fromVault.address)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

    //     console.log("Before match order")
    //     const fromOrderDataBefore = await fromOrder.getData()
    //     const toOrderDataBefore = await toOrder.getData()
    //     console.log("FromOrder", fromOrderDataBefore)
    //     console.log("ToOrder", toOrderDataBefore)

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         matcher.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: toOrderDataBefore.createdAt,
    //             amount: toNano(1)
    //         }
    //     )
    //     printTransactionFees(resultMatchOrder.transactions)

    //     console.log("After match order")
    //     const fromOrderDataAfter = await fromOrder.getData()
    //     const toOrderDataAfter = await toOrder.getData()
    //     console.log("FromOrder", fromOrderDataAfter)
    //     console.log("ToOrder", toOrderDataAfter)

    // })

    // it("Test revert match oreder with RichBounce", async () => {
    //     const resultCreateFromOrder = await fromJettonWallet.sendCreateOrder(
    //         user1.getSender(),
    //         toNano(0.64),
    //         {
    //             jettonAmount: toNano(4),
    //             vault: fromVault.address,
    //             owner: user1.address,
    //             priceRate: toNano(100),
    //             slippage: toNano(0.01),
    //             toJettonMinter: toJettonMinter.address,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )
    //     const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
    //         user2.getSender(),
    //         toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
    //         {
    //             jettonAmount: toNano(30),
    //             vault: toVault.address,
    //             owner: user2.address,
    //             priceRate: toNano(0.1),
    //             slippage: toNano(0.01),
    //             toJettonMinter: fromJettonMinter.address,
    //             forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //         }
    //     )
    //     const fromOrder = getOrderWrapper(blockchain, resultCreateFromOrder, fromVault.address)
    //     const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

    //     console.log("Before match order")
    //     const fromOrderDataBefore = await fromOrder.getData()
    //     const toOrderDataBefore = await toOrder.getData()
    //     console.log("FromOrder", fromOrderDataBefore)
    //     console.log("ToOrder", toOrderDataBefore)

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         matcher.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: toOrderDataBefore.createdAt,
    //             amount: toNano(1)
    //         }
    //     )
    //     printTransactionFees(resultMatchOrder.transactions)

    //     console.log("After match order")
    //     const fromOrderDataAfter = await fromOrder.getData()
    //     const toOrderDataAfter = await toOrder.getData()
    // })

    // it("Deploy Vault jetton", async () => {
    //     const resultCreateVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.0065 + 0.0019 + 0.01), jettonWalletCodeCell, fromJettonMinter.address)
    //     expect(resultCreateVault.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: true,
    //     });
    //     const vault = getVaultWrapper(blockchain, resultCreateVault)
    //     expect(vault).not.toBeNull()
    //     expect(vault.address).not.toBeNull()
    // })

    // it("Deploy Vault ton", async () => {
    //     const resultCreateVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.0065 + 0.0019 + 0.01), null, null)
    //     expect(resultCreateVault.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: true,
    //     });
    //     const vault = getVaultWrapper(blockchain, resultCreateVault)
    //     expect(vault).not.toBeNull()
    //     expect(vault.address).not.toBeNull()
    // })

    // it("Deploy Vault with a few ton", async () => {
    //     const resultCreateVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.001), jettonWalletCodeCell, fromJettonMinter.address)
    //     expect(resultCreateVault.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 422,
    //     });
    // })

    it("init VaultFactory - success", async () => {
        const res = await vaultFactory.sendDeploy(deployer.getSender(), toNano(0.1))
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

    // DELETED
    // it("Success withdraw jetton", async () => {
    //     const order1 = await fromJettonWallet.sendCreateOrder(user1.getSender(), toNano(0.5), {
    //         jettonAmount: toNano(10),
    //         vault: fromVault.address,
    //         owner: user1.address,
    //         priceRate: toNano(1),
    //         slippage: toNano(0.01),
    //         toJettonMinter: toJettonMinter.address,
    //         forwardTonAmount: toNano(0.1),
    //     })

    //     const order2 = await toJettonWallet.sendCreateOrder(user2.getSender(), toNano(0.5), {
    //         jettonAmount: toNano(10),
    //         vault: toVault.address,
    //         owner: user2.address,
    //         priceRate: toNano(1),
    //         slippage: toNano(0.01),
    //         toJettonMinter: fromJettonMinter.address,
    //         forwardTonAmount: toNano(0.1),
    //     })

    //     const fromOrder = getOrderWrapper(blockchain, order1, fromVault.address)
    //     const toOrder = getOrderWrapper(blockchain, order2, toVault.address)

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(10),
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)



    //     const res = await vaultFactory.sendWithDraw(deployer.getSender(), toNano(0.2), fromVault.address)
    //     expect(res.transactions).not.toHaveTransaction({
    //         success: false,
    //     });
    //     printTransactionFees(res.transactions)
    // })

    // it("Error withdraw not from owner", async () => {
    //     const res = await vaultFactory.sendWithDraw(user1.getSender(), toNano(0.2), fromVault.address)
    //     expect(res.transactions).toHaveTransaction({
    //         from: user1.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 403
    //     });
    // })

    // it("Error withdraw not enough gas", async () => {
    //     const res = await vaultFactory.sendWithDraw(deployer.getSender(), toNano(0.001), fromVault.address)
    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 422
    //     });
    // })

    // it("Success withdraw ton", async () => {
    //     const order1 = await fromVaultTon.sendCreateOrder(user1.getSender(), toNano(11), {
    //         amount: toNano(10),
    //         priceRate: toNano(1),
    //         slippage: toNano(0.01),
    //         toJettonMinter: toJettonMinter.address,
    //     })

    //     const order2 = await toJettonWallet.sendCreateOrder(user2.getSender(), toNano(0.5), {
    //         jettonAmount: toNano(10),
    //         vault: toVault.address,
    //         owner: user2.address,
    //         priceRate: toNano(1),
    //         slippage: toNano(0.01),
    //         toJettonMinter: null,
    //         forwardTonAmount: toNano(0.1),
    //     })

    //     const fromOrder = getOrderWrapper(blockchain, order1, fromVaultTon.address)
    //     const toOrder = getOrderWrapper(blockchain, order2, toVault.address)

    //     const resultMatchOrder = await fromOrder.sendMatchOrder(
    //         user1.getSender(),
    //         toNano(1),
    //         {
    //             anotherVault: toVault.address,
    //             anotherOrderOwner: user2.address,
    //             anotherOrder: toOrder.address,
    //             createdAt: (await toOrder.getData()).createdAt,
    //             amount: toNano(10),
    //         }
    //     )

    //     printTransactionFees(resultMatchOrder.transactions)


    //     const res = await vaultFactory.sendWithDraw(deployer.getSender(), toNano(0.2), fromVaultTon.address)
    //     expect(res.transactions).not.toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //     });
    //     printTransactionFees(res.transactions)

    // })



    // it("Change Commission - success", async () => {
    //     const commission = await vaultFactory.getCommission();
    //     expect(commission.comission_num).toEqual(2);
    //     const res = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano(0.1), {
    //         comission_num: 3,
    //         comission_denom: 100,
    //     }, false)
    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: true,
    //     });
    //     const commissionNew = await vaultFactory.getCommission();
    //     expect(commissionNew.comission_num).toEqual(3);
    //     expect(commissionNew.comission_denom).toEqual(100);
    // })

    // it("Change Commission - error not enough gas", async () => {
    //     const resError = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano(0.001), {
    //         comission_num: 3,
    //         comission_denom: 100,
    //     }, false)
    //     expect(resError.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 422,
    //     });
    // })

    // it("Change Commission - error MAX_COMMISSION", async () => {
    //     const resError = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano(0.1), {
    //         comission_num: 300,
    //         comission_denom: 100,
    //     }, false)
    //     expect(resError.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 400,
    //     });
    // })

    // it("Change Commission - error owner", async () => {
    //     const changeCommissionFromNotOwner = await vaultFactory.sendChangeCommission(user1.getSender(), toNano(0.1), {
    //         comission_num: 3,
    //         comission_denom: 100,
    //     }, false)
    //     expect(changeCommissionFromNotOwner.transactions).toHaveTransaction({
    //         from: user1.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 403,
    //     });
    // })

    // it("Change Commission Matcher - success", async () => {
    //     const commissionMatcher = await vaultFactory.getCommission();
    //     expect(commissionMatcher.comission_num_matcher).toEqual(1);
    //     expect(commissionMatcher.comission_denom_matcher).toEqual(100);
    //     const resMatcher = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano(0.1), {
    //         comission_num: 3,
    //         comission_denom: 100,
    //     }, true)
    //     expect(resMatcher.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: true,
    //     });
    //     const commissionMatcherNew = await vaultFactory.getCommission();
    //     expect(commissionMatcherNew.comission_num_matcher).toEqual(3);
    //     expect(commissionMatcherNew.comission_denom_matcher).toEqual(100);
    // })

    // it("Change Commission Matcher - error MAX_COMMISSION_MATCHER", async () => {
    //     const commissionMatcherError = await vaultFactory.getCommission();
    //     expect(commissionMatcherError.comission_num_matcher).toEqual(1);
    //     expect(commissionMatcherError.comission_denom_matcher).toEqual(100);
    //     const resMatcherError = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano(0.1), {
    //         comission_num: 300,
    //         comission_denom: 100,
    //     }, true)
    //     expect(resMatcherError.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 400,
    //     });
    //     const commissionMatcherNewError = await vaultFactory.getCommission();
    //     expect(commissionMatcherNewError.comission_num_matcher).toEqual(1);
    //     expect(commissionMatcherNewError.comission_denom_matcher).toEqual(100);
    // })

    // it("Change Commission Matcher - error owner", async () => {
    //     const changeCommissionFromNotOwnerMatcher = await vaultFactory.sendChangeCommission(user1.getSender(), toNano(0.1), {
    //         comission_num: 1,
    //         comission_denom: 100,
    //     }, true)
    //     expect(changeCommissionFromNotOwnerMatcher.transactions).toHaveTransaction({
    //         from: user1.address,
    //         to: vaultFactory.address,
    //         success: false,
    //         exitCode: 403,
    //     });
    // })

    it("Success Change Owner", async () => {
        const ownerBefore = await vaultFactory.getOwner();
        expect(ownerBefore.toRawString()).toEqual(deployer.address.toRawString());
        const res = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano(0.1), user1.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const ownerAfter = await vaultFactory.getOwner();
        expect(ownerAfter.toRawString()).toEqual(user1.address.toRawString());
        expect(ownerAfter.toRawString()).not.toEqual(ownerBefore.toRawString());
    })

    it("Error Change Owner not from owner", async () => {
        const res = await vaultFactory.sendChangeOwner(user1.getSender(), toNano(0.1), user2.address)
        expect(res.transactions).toHaveTransaction({
            from: user1.address,
            to: vaultFactory.address,
            success: false,
            exitCode: 403
        });
    })

    it("Error Change Owner not enough gas", async () => {
        const res = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano(0.001), user1.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: false,
            exitCode: 422
        });
    })

    it("Success Create Vault with jetton", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.1), jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
    })

    it("Success Create Vault with ton", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.1), null, null)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
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
});
