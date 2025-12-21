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



export const mapOpcode = (op: number): string | null => {
    switch (op) {
        case 0x178d4519:
            return 'JettonWalletInternalTransfer';
        case 0x2717c4a2:
            return 'VaultInit';
        case 0x2d0e1e1b:
            return 'OrderInit';
        case 0xfc7532f4:
            return 'FeeCollectorAddFee';
        case 0xec9a92f6:
            return 'FeeCollectorWithDraw';
        case 0x47ff7e25:
            return 'OrderMatchOrder';
        case 0xdfe29f63:
            return 'OrderInternalMatchOrder';
        case 0x52e80bac:
            return 'OrderCloseOrder';
        case 0x55feb42a:
            return 'OrderSuccessMatch';
        case 0x64e90480:
            return 'VaultFactoryCreateVault';
        case 0xb6cf7f0f:
            return 'VaultFactoryChangeOwner';
        case 0x81e36595:
            return 'VaultFactoryInit';
        case 0x12966c79:
            return 'VaultJettonTransfer';
        case 0x7362d09c:
            return 'VaultJettonTransferNotification';
        case 0xcbcd047e:
            return 'VaultTonTransfer';
        case 0xee83652a:
            return 'VaultWithDraw';
        case 0xecd3ad8e:
            return 'BounceRevertInternalMatchOrder';
        case 0xd53276db:
            return 'JettonWalletInternalTransferExcesses';
        case 0xf8a7ea5:
            return 'JettonWalletTransfer';
        default:
            return null;
    }
};



// export function printFullInfoAboutFees(trs: BlockchainTransaction[], source: Address) {
//     let sourceTrs = trs.filter((e) => {
//         const tx = flattenTransaction(e);
//         return tx.from?.equals(source);
//     })
//     if (sourceTrs.length === 0) {
//         throw new Error("Source transaction not found");
//     }
//     sourceTrs.forEach(transaction => {
//         if (transaction.description.type === "generic") {
//             console.log("transaction.totalFwdFees,", transaction.description.actionPhase?.totalFwdFees)
//             console.log("transaction.totalActionFees,", transaction.description.actionPhase?.totalActionFees)
//             console.log("transaction.totalComputePhase,", transaction.description.computePhase?.type === "vm" ? transaction.description.computePhase?.gasFees : null);
//             console.log("transaction.totalCreditPhase,", transaction.description.creditPhase?.credit.coins);
//             console.log("transaction.totalStorageFees,", transaction.description.storagePhase?.storageFeesCollected);
//         }
//     })
// }

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
            vaultCode: await compile('Vault'),
            orderCode: await compile('Order'),
            feeCollectorCode: await compile('FeeCollector'),
        }, code));


        const deployResult = await vaultFactory.sendDeploy(deployer.getSender(), toNano(0.000526 + 0.01));

        console.log("deployResultVaultFactory TRS")
        printTransactionFees(deployResult.transactions, mapOpcode)

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

        const resultCreateVaultFrom = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, fromJettonMinter.address)

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
    //         toNano(0.01 + 0.0035 + 0.007 + 0.02),
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
    //         toNano(0.01 + 0.0035 + 0.007 + 0.02),
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
    //         toNano(0.01 + 0.0035 + 0.007 + 0.02),
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

    it("Success Create Vault with jetton", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.018176 + 0.000538 + 0.01), jettonWalletCodeCell, fromJettonMinter.address)
        console.log((await blockchain.getContract(vaultFactory.address)).balance)
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        console.log((await blockchain.getContract(vaultFactory.address)).balance)
    })

    it("Success Create Vault with ton", async () => {
        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.018176 + 0.000538 + 0.01), null, null)
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

    it("Full Cycle Jetton -> Jetton", async () => {
        const resMintJettonFrom = await fromJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletFrom = getJettonWalletWrapper(blockchain, resMintJettonFrom, fromJettonMinter.address)
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        console.log("resCreateVaultJETTON")
        printTransactionFees(res.transactions, mapOpcode)
        const vault1 = getVaultWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        console.log("resCreateVaultJETTON")
        printTransactionFees(res2.transactions, mapOpcode)
        const vault2 = getVaultWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_0,", balanceVault2_0)

        const resCreateOrderFrom = await jettonWalletFrom.sendCreateOrder(user1.getSender(), toNano(1), {
            jettonAmount: toNano(15),
            vault: vault1.address,
            owner: user1.address,
            priceRate: toNano(0.66),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })

        console.log("resCreateOrderFrom JETTON")
        printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1 = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1,", balanceVault1_1)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const balanceVault1_1_before_create_order_to = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1_before_create_order_to,", balanceVault1_1_before_create_order_to)

        const resCreateOrderTo = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(10),
            vault: vault2.address,
            owner: user2.address,
            priceRate: toNano(1.5),
            slippage: toNano(0.02),
            toJettonMinter: fromJettonMinter.address,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })

        const balanceVault1_1_after_create_order_to = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1_after_create_order_to,", balanceVault1_1_after_create_order_to)

        console.log("resCreateOrderTo JETTON")
        printTransactionFees(resCreateOrderTo.transactions, mapOpcode)


        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)
        const balanceOrder2 = (await blockchain.getContract(order2.address)).balance
        console.log("balanceOrder2,", balanceOrder2)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        })

        // printFullInfoAboutFees(resultMatchOrder.transactions)
        printTransactionFees(resultMatchOrder.transactions, mapOpcode)

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
        console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_2,", balanceVault2_2)
    })

    it("Full Cycle Ton -> Jetton", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        console.log("DWWD")

        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), null, null)
        console.log("resCreateVaultTON")
        printTransactionFees(res.transactions, mapOpcode)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });


        const vault1 = getVaultWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        console.log("resCreateVaultJETTON")
        printTransactionFees(res2.transactions, mapOpcode)
        const vault2 = getVaultWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_0,", balanceVault2_0)

        const balanceVault1_1_before_create_order_from = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1_before_create_order_from,", balanceVault1_1_before_create_order_from)

        const resCreateOrderFrom = await vault1.sendCreateOrder(user1.getSender(), toNano(15 + 0.01 + 0.00186 + 0.006737 + 0.002535), {
            amount: toNano(15),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("resCreateOrderFrom TON")
        printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1_after_create_order_from = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1_after_create_order_from,", balanceVault1_1_after_create_order_from)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const balanceOrder1 = (await blockchain.getContract(order1.address)).balance
        console.log("balanceOrder1,", balanceOrder1)

        const resCreateOrderTo = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(15),
            vault: vault2.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("resCreateOrderTo JETTON")
        printTransactionFees(resCreateOrderTo.transactions, mapOpcode)

        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)

        const vault_TON_balance_before_match_order = (await blockchain.getContract(vault1.address)).balance
        console.log("vault_TON_balance_before_match_order,", vault_TON_balance_before_match_order)

        const order_TON_balance_before_match_order = (await blockchain.getContract(order1.address)).balance
        console.log("order_TON_balance_before_match_order,", order_TON_balance_before_match_order)

        const vault_JETTON_balance_before_match_order = (await blockchain.getContract(vault2.address)).balance
        console.log("vault_JETTON_balance_before_match_order,", vault_JETTON_balance_before_match_order)

        const order_JETTON_balance_before_match_order = (await blockchain.getContract(order2.address)).balance
        console.log("order_JETTON_balance_before_match_order,", order_JETTON_balance_before_match_order)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(15),
        })
        printTransactionFees(resultMatchOrder.transactions, mapOpcode)

        const vault_TON_balance_after_match_order = (await blockchain.getContract(vault1.address)).balance
        console.log("vault_TON_balance_after_match_order,", vault_TON_balance_after_match_order)

        const order_TON_balance_after_match_order = (await blockchain.getContract(order1.address)).balance
        console.log("order_TON_balance_after_match_order,", order_TON_balance_after_match_order)

        const vault_JETTON_balance_after_match_order = (await blockchain.getContract(vault2.address)).balance
        console.log("vault_JETTON_balance_after_match_order,", vault_JETTON_balance_after_match_order)

        const order_JETTON_balance_after_match_order = (await blockchain.getContract(order2.address)).balance
        console.log("order_JETTON_balance_after_match_order,", order_JETTON_balance_after_match_order)


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
        console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_2,", balanceVault2_2)



        
    })

    it("Full Cycle Jetton -> Ton", async () => {
        const resMintJettonFrom = await fromJettonMinter.sendMint(deployer.getSender(), user1.address, toNano(100), null, null, null, undefined, undefined)
        const jettonWalletFrom = getJettonWalletWrapper(blockchain, resMintJettonFrom, fromJettonMinter.address)

        const res = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, fromJettonMinter.address)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vault1 = getVaultWrapper(blockchain, res)

        const balanceVault1_0 = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_0,", balanceVault1_0)

        const res2 = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), null, null)
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vault2 = getVaultWrapper(blockchain, res2)

        const balanceVault2_0 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_0,", balanceVault2_0)

        const resCreateOrderFrom = await jettonWalletFrom.sendCreateOrder(user1.getSender(), toNano(0.1), {
            jettonAmount: toNano(15),
            vault: vault1.address,
            owner: user1.address,
            priceRate: toNano(0.66),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.05),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        printTransactionFees(resCreateOrderFrom.transactions, mapOpcode)

        const balanceVault1_1 = (await blockchain.getContract(vault1.address)).balance
        console.log("balanceVault1_1,", balanceVault1_1)

        const order1 = getOrderWrapper(blockchain, resCreateOrderFrom, vault1.address)

        const resCreateOrderTo = await vault2.sendCreateOrder(user2.getSender(), toNano(10.02), {
            amount: toNano(10),
            priceRate: toNano(1.5),
            slippage: toNano(0.02),
            toJettonMinter: fromJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })

        const balanceVault2_1 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_1,", balanceVault2_1)

        const order2 = getOrderWrapper(blockchain, resCreateOrderTo, vault2.address)

        const resultMatchOrder = await order1.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vault2.address,
            anotherOrderOwner: user2.address,
            anotherOrder: order2.address,
            createdAt: (await order2.getData()).createdAt,
            amount: toNano(10),
        })
        printTransactionFees(resultMatchOrder.transactions, mapOpcode)

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
        console.log("balanceVault1_2,", balanceVault1_2)

        const balanceVault2_2 = (await blockchain.getContract(vault2.address)).balance
        console.log("balanceVault2_2,", balanceVault2_2)
    })

    it("TON -> JETTON: Two Sequential Matches with Same TON Vault", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(20000), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        // Create TON vault
        console.log("create TON vault")
        const resVaultTon = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.018176 + 0.000538 + 0.01), null, null)
        console.log("resVaultTon TON")
        printTransactionFees(resVaultTon.transactions, mapOpcode)
        expect(resVaultTon.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vaultTon = getVaultWrapper(blockchain, resVaultTon)
        const vaultTonBalance_0 = (await blockchain.getContract(vaultTon.address)).balance
        console.log("=== Vault TON balance after creation:", vaultTonBalance_0)

        // Create JETTON vault
        const resVaultJetton = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.018176 + 0.000538 + 0.01), jettonWalletCodeCell, toJettonMinter.address)
        expect(resVaultJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        printTransactionFees(resVaultJetton.transactions, mapOpcode)
        const vaultJetton = getVaultWrapper(blockchain, resVaultJetton)
        const vaultTonBalance_0_jetton = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_0 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after JETTON vault creation:", vaultTonBalance_0_jetton)
        console.log("=== Vault JETTON balance after creation:", vaultJettonBalance_0)

        // ========== FIRST MATCH ==========
        console.log("\n--- FIRST MATCH ---")

        // Create first TON order
        const resCreateOrderTon1 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(500 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006), {
            amount: toNano(500),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order TON 1 created")
        printTransactionFees(resCreateOrderTon1.transactions, mapOpcode)
        const vaultTonBalance_1 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_1 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after TON order 1 creation:", vaultTonBalance_1)
        console.log("=== Vault JETTON balance after TON order 1 creation:", vaultJettonBalance_1)
        const orderTon1 = getOrderWrapper(blockchain, resCreateOrderTon1, vaultTon.address)

        // Create first JETTON order
        const resCreateOrderJetton1 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(500),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order JETTON 1 created")
        printTransactionFees(resCreateOrderJetton1.transactions, mapOpcode)
        const vaultTonBalance_2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_2 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after JETTON order 1 creation:", vaultTonBalance_2)
        console.log("=== Vault JETTON balance after JETTON order 1 creation:", vaultJettonBalance_2)
        const orderJetton1 = getOrderWrapper(blockchain, resCreateOrderJetton1, vaultJetton.address)

        // Match first orders
        const vaultTonBalance_before_match1 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match1 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance BEFORE match 1:", vaultTonBalance_before_match1)
        console.log("=== Vault JETTON balance BEFORE match 1:", vaultJettonBalance_before_match1)

        const resultMatchOrder1 = await orderTon1.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton1.address,
            createdAt: (await orderJetton1.getData()).createdAt,
            amount: toNano(500),
        })
        console.log("Match 1 executed")
        printTransactionFees(resultMatchOrder1.transactions, mapOpcode)
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
        console.log("=== Vault TON balance AFTER match 1:", vaultTonBalance_after_match1)
        console.log("=== Vault JETTON balance AFTER match 1:", vaultJettonBalance_after_match1)
        console.log("=== Vault TON balance change in match 1:", vaultTonBalance_after_match1 - vaultTonBalance_before_match1)
        console.log("=== Vault JETTON balance change in match 1:", vaultJettonBalance_after_match1 - vaultJettonBalance_before_match1)

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
        console.log("\n--- SECOND MATCH ---")

        // Create second TON order (same vault)
        const resCreateOrderTon2 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(1000 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006), {
            amount: toNano(1000),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order TON 2 created (same vault)")
        printTransactionFees(resCreateOrderTon2.transactions, mapOpcode)
        const vaultTonBalance_3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_3 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after TON order 2 creation:", vaultTonBalance_3)
        console.log("=== Vault JETTON balance after TON order 2 creation:", vaultJettonBalance_3)
        const orderTon2 = getOrderWrapper(blockchain, resCreateOrderTon2, vaultTon.address)

        // Create second JETTON order
        const resCreateOrderJetton2 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(1000),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order JETTON 2 created")
        printTransactionFees(resCreateOrderJetton2.transactions, mapOpcode)
        const vaultTonBalance_4 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_4 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after JETTON order 2 creation:", vaultTonBalance_4)
        console.log("=== Vault JETTON balance after JETTON order 2 creation:", vaultJettonBalance_4)
        const orderJetton2 = getOrderWrapper(blockchain, resCreateOrderJetton2, vaultJetton.address)

        // Match second orders
        const vaultTonBalance_before_match2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match2 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance BEFORE match 2:", vaultTonBalance_before_match2)
        console.log("=== Vault JETTON balance BEFORE match 2:", vaultJettonBalance_before_match2)

        const resultMatchOrder2 = await orderTon2.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton2.address,
            createdAt: (await orderJetton2.getData()).createdAt,
            amount: toNano(1000),
        })

        console.log("Match 2 executed")
        printTransactionFees(resultMatchOrder2.transactions, mapOpcode)

        // // --- start withdraw from vault ton after match 2 ---
        // console.log("--- start withdraw from vault ton after match 2 ---")
        // const feeCollectorTon2 = getFeeCollectorWrapper(blockchain, resultMatchOrder2, vaultTon.address)
        // const withDrawRes2 = await feeCollectorTon2.sendWithDraw(user1.getSender(), toNano(1))
        // printTransactionFees(withDrawRes2.transactions, mapOpcode)
        // console.log("--- end withdraw from vault ton after match 2 ---")
        // /// --- end withdraw from vault ton after match 2 ---

        const vaultTonBalance_after_match2 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_after_match2 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance AFTER match 2:", vaultTonBalance_after_match2)
        console.log("=== Vault JETTON balance AFTER match 2:", vaultJettonBalance_after_match2)
        console.log("=== Vault TON balance change in match 2:", vaultTonBalance_after_match2 - vaultTonBalance_before_match2)
        console.log("=== Vault JETTON balance change in match 2:", vaultJettonBalance_after_match2 - vaultJettonBalance_before_match2)

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
        console.log("\n--- THIRD MATCH ---")

        // Create third TON order (same vault)
        const resCreateOrderTon3 = await vaultTon.sendCreateOrder(user1.getSender(), toNano(500 + 0.01 + 0.00186 + 0.006786 + 0.002744 + 0.006), {
            amount: toNano(500),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order TON 3 created (same vault)")
        printTransactionFees(resCreateOrderTon3.transactions, mapOpcode)
        const vaultTonBalance_5 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_5 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after TON order 3 creation:", vaultTonBalance_5)
        console.log("=== Vault JETTON balance after TON order 3 creation:", vaultJettonBalance_5)
        const orderTon3 = getOrderWrapper(blockchain, resCreateOrderTon3, vaultTon.address)

        // Create third JETTON order
        const resCreateOrderJetton3 = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(500),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order JETTON 3 created")
        printTransactionFees(resCreateOrderJetton3.transactions, mapOpcode)
        const vaultTonBalance_6 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_6 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance after JETTON order 3 creation:", vaultTonBalance_6)
        console.log("=== Vault JETTON balance after JETTON order 3 creation:", vaultJettonBalance_6)
        const orderJetton3 = getOrderWrapper(blockchain, resCreateOrderJetton3, vaultJetton.address)

        // Match third orders
        const vaultTonBalance_before_match3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_before_match3 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance BEFORE match 3:", vaultTonBalance_before_match3)
        console.log("=== Vault JETTON balance BEFORE match 3:", vaultJettonBalance_before_match3)

        const resultMatchOrder3 = await orderTon3.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton3.address,
            createdAt: (await orderJetton3.getData()).createdAt,
            amount: toNano(500),
        })
        console.log("Match 3 executed")
        printTransactionFees(resultMatchOrder3.transactions, mapOpcode)

        // // --- start withdraw from vault ton after match 3 ---
        // console.log("--- start withdraw from vault ton after match 3 ---")
        // const feeCollectorTon3 = getFeeCollectorWrapper(blockchain, resultMatchOrder3, vaultTon.address)
        // const withDrawRes3 = await feeCollectorTon3.sendWithDraw(user1.getSender(), toNano(1))
        // printTransactionFees(withDrawRes3.transactions, mapOpcode)
        // console.log("--- end withdraw from vault ton after match 3 ---")
        // /// --- end withdraw from vault ton after match 3 ---

        const vaultTonBalance_after_match3 = (await blockchain.getContract(vaultTon.address)).balance
        const vaultJettonBalance_after_match3 = (await blockchain.getContract(vaultJetton.address)).balance
        console.log("=== Vault TON balance AFTER match 3:", vaultTonBalance_after_match3)
        console.log("=== Vault JETTON balance AFTER match 3:", vaultJettonBalance_after_match3)
        console.log("=== Vault TON balance change in match 3:", vaultTonBalance_after_match3 - vaultTonBalance_before_match3)
        console.log("=== Vault JETTON balance change in match 3:", vaultJettonBalance_after_match3 - vaultJettonBalance_before_match3)

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
        console.log("\n--- SUMMARY ---")
        console.log("=== Vault TON balance initial:", vaultTonBalance_0)
        console.log("=== Vault TON balance after match 1:", vaultTonBalance_after_match1)
        console.log("=== Vault TON balance after match 2:", vaultTonBalance_after_match2)
        console.log("=== Vault TON balance after match 3:", vaultTonBalance_after_match3)
        console.log("=== Vault TON balance total change:", vaultTonBalance_after_match3 - vaultTonBalance_0)
        console.log("=== Vault JETTON balance initial:", vaultJettonBalance_0)
        console.log("=== Vault JETTON balance after match 1:", vaultJettonBalance_after_match1)
        console.log("=== Vault JETTON balance after match 2:", vaultJettonBalance_after_match2)
        console.log("=== Vault JETTON balance after match 3:", vaultJettonBalance_after_match3)
        console.log("=== Vault JETTON balance total change:", vaultJettonBalance_after_match3 - vaultJettonBalance_0)
    })

    it("TON -> JETTON: Partial Matches - Check Order Balance Changes", async () => {
        const resMintJettonTo = await toJettonMinter.sendMint(deployer.getSender(), user2.address, toNano(20000), null, null, null, undefined, undefined)
        const jettonWalletTo = getJettonWalletWrapper(blockchain, resMintJettonTo, toJettonMinter.address)

        // Create TON vault
        const resVaultTon = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(0.018176 + 0.000538 + 0.01), null, null)
        expect(resVaultTon.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vaultTon = getVaultWrapper(blockchain, resVaultTon)

        // Create JETTON vault
        const resVaultJetton = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address)
        expect(resVaultJetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            success: true,
        });
        const vaultJetton = getVaultWrapper(blockchain, resVaultJetton)

        // Create TON order with amount 1000
        const resCreateOrderTon = await vaultTon.sendCreateOrder(user1.getSender(), toNano(1000 + 0.01 + 0.00186 + 0.006737 + 0.002535), {
            amount: toNano(1000),
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: toJettonMinter.address,
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order TON created")
        printTransactionFees(resCreateOrderTon.transactions, mapOpcode)
        const orderTon = getOrderWrapper(blockchain, resCreateOrderTon, vaultTon.address)
        
        // Get initial order balance
        const orderTonDataInitial = await orderTon.getData()
        const orderTonBalanceInitial = orderTonDataInitial.exchangeInfo.amount
        const orderTonContractBalanceInitial = (await blockchain.getContract(orderTon.address)).balance
        console.log("=== Order TON initial balance:", orderTonBalanceInitial)
        console.log("=== Order TON contract balance initial:", orderTonContractBalanceInitial)

        // Create JETTON order with amount 1000
        const resCreateOrderJetton = await jettonWalletTo.sendCreateOrder(user2.getSender(), toNano(1), {
            jettonAmount: toNano(1000),
            vault: vaultJetton.address,
            owner: user2.address,
            priceRate: toNano(1),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: deployer.address,
            feeNum: 5,
            feeDenom: 1000,
            matcherFeeNum: 5,
            matcherFeeDenom: 1000,
        })
        console.log("Order JETTON created")
        printTransactionFees(resCreateOrderJetton.transactions, mapOpcode)
        const orderJetton = getOrderWrapper(blockchain, resCreateOrderJetton, vaultJetton.address)
        
        // Get initial order balance
        const orderJettonDataInitial = await orderJetton.getData()
        const orderJettonBalanceInitial = orderJettonDataInitial.exchangeInfo.amount
        const orderJettonContractBalanceInitial = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order JETTON initial balance:", orderJettonBalanceInitial)
        console.log("=== Order JETTON contract balance initial:", orderJettonContractBalanceInitial)

        // ========== FIRST MATCH (300) ==========
        console.log("\n--- FIRST MATCH (300) ---")
        
        const orderTonDataBeforeMatch1 = await orderTon.getData()
        const orderJettonDataBeforeMatch1 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch1 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch1 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance BEFORE match 1:", orderTonDataBeforeMatch1.exchangeInfo.amount)
        console.log("=== Order TON contract balance BEFORE match 1:", orderTonContractBalanceBeforeMatch1)
        console.log("=== Order JETTON balance BEFORE match 1:", orderJettonDataBeforeMatch1.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance BEFORE match 1:", orderJettonContractBalanceBeforeMatch1)

        const resultMatchOrder1 = await orderTon.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: toNano(300),
        })
        console.log("Match 1 executed (300)")
        printTransactionFees(resultMatchOrder1.transactions, mapOpcode)

        const orderTonDataAfterMatch1 = await orderTon.getData()
        const orderJettonDataAfterMatch1 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch1 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch1 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance AFTER match 1:", orderTonDataAfterMatch1.exchangeInfo.amount)
        console.log("=== Order TON contract balance AFTER match 1:", orderTonContractBalanceAfterMatch1)
        console.log("=== Order TON balance change in match 1:", orderTonDataAfterMatch1.exchangeInfo.amount - orderTonDataBeforeMatch1.exchangeInfo.amount)
        console.log("=== Order TON contract balance change in match 1:", orderTonContractBalanceAfterMatch1 - orderTonContractBalanceBeforeMatch1)
        console.log("=== Order JETTON balance AFTER match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance AFTER match 1:", orderJettonContractBalanceAfterMatch1)
        console.log("=== Order JETTON balance change in match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount - orderJettonDataBeforeMatch1.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance change in match 1:", orderJettonContractBalanceAfterMatch1 - orderJettonContractBalanceBeforeMatch1)

        expect(orderTonDataAfterMatch1.exchangeInfo.amount).toBe(orderTonBalanceInitial - toNano(300))
        expect(orderJettonDataAfterMatch1.exchangeInfo.amount).toBe(orderJettonBalanceInitial - toNano(300))

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
        console.log("\n--- SECOND MATCH (300) ---")
        
        const orderTonDataBeforeMatch2 = await orderTon.getData()
        const orderJettonDataBeforeMatch2 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch2 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch2 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance BEFORE match 2:", orderTonDataBeforeMatch2.exchangeInfo.amount)
        console.log("=== Order TON contract balance BEFORE match 2:", orderTonContractBalanceBeforeMatch2)
        console.log("=== Order JETTON balance BEFORE match 2:", orderJettonDataBeforeMatch2.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance BEFORE match 2:", orderJettonContractBalanceBeforeMatch2)

        const resultMatchOrder2 = await orderTon.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: toNano(300),
        })
        console.log("Match 2 executed (300)")
        printTransactionFees(resultMatchOrder2.transactions, mapOpcode)

        const orderTonDataAfterMatch2 = await orderTon.getData()
        const orderJettonDataAfterMatch2 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch2 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch2 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance AFTER match 2:", orderTonDataAfterMatch2.exchangeInfo.amount)
        console.log("=== Order TON contract balance AFTER match 2:", orderTonContractBalanceAfterMatch2)
        console.log("=== Order TON balance change in match 2:", orderTonDataAfterMatch2.exchangeInfo.amount - orderTonDataBeforeMatch2.exchangeInfo.amount)
        console.log("=== Order TON contract balance change in match 2:", orderTonContractBalanceAfterMatch2 - orderTonContractBalanceBeforeMatch2)
        console.log("=== Order JETTON balance AFTER match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance AFTER match 2:", orderJettonContractBalanceAfterMatch2)
        console.log("=== Order JETTON balance change in match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount - orderJettonDataBeforeMatch2.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance change in match 2:", orderJettonContractBalanceAfterMatch2 - orderJettonContractBalanceBeforeMatch2)

        expect(orderTonDataAfterMatch2.exchangeInfo.amount).toBe(orderTonBalanceInitial - toNano(600))
        expect(orderJettonDataAfterMatch2.exchangeInfo.amount).toBe(orderJettonBalanceInitial - toNano(600))

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
        console.log("\n--- THIRD MATCH (400) ---")
        
        const orderTonDataBeforeMatch3 = await orderTon.getData()
        const orderJettonDataBeforeMatch3 = await orderJetton.getData()
        const orderTonContractBalanceBeforeMatch3 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceBeforeMatch3 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance BEFORE match 3:", orderTonDataBeforeMatch3.exchangeInfo.amount)
        console.log("=== Order TON contract balance BEFORE match 3:", orderTonContractBalanceBeforeMatch3)
        console.log("=== Order JETTON balance BEFORE match 3:", orderJettonDataBeforeMatch3.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance BEFORE match 3:", orderJettonContractBalanceBeforeMatch3)

        const resultMatchOrder3 = await orderTon.sendMatchOrder(user1.getSender(), toNano(1), {
            anotherVault: vaultJetton.address,
            anotherOrderOwner: user2.address,
            anotherOrder: orderJetton.address,
            createdAt: (await orderJetton.getData()).createdAt,
            amount: toNano(400),
        })
        console.log("Match 3 executed (400)")
        printTransactionFees(resultMatchOrder3.transactions, mapOpcode)

        const orderTonDataAfterMatch3 = await orderTon.getData()
        const orderJettonDataAfterMatch3 = await orderJetton.getData()
        const orderTonContractBalanceAfterMatch3 = (await blockchain.getContract(orderTon.address)).balance
        const orderJettonContractBalanceAfterMatch3 = (await blockchain.getContract(orderJetton.address)).balance
        console.log("=== Order TON balance AFTER match 3:", orderTonDataAfterMatch3.exchangeInfo.amount)
        console.log("=== Order TON contract balance AFTER match 3:", orderTonContractBalanceAfterMatch3)
        console.log("=== Order TON balance change in match 3:", orderTonDataAfterMatch3.exchangeInfo.amount - orderTonDataBeforeMatch3.exchangeInfo.amount)
        console.log("=== Order TON contract balance change in match 3:", orderTonContractBalanceAfterMatch3 - orderTonContractBalanceBeforeMatch3)
        console.log("=== Order JETTON balance AFTER match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance AFTER match 3:", orderJettonContractBalanceAfterMatch3)
        console.log("=== Order JETTON balance change in match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount - orderJettonDataBeforeMatch3.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance change in match 3:", orderJettonContractBalanceAfterMatch3 - orderJettonContractBalanceBeforeMatch3)

        expect(orderTonDataAfterMatch3.exchangeInfo.amount).toBe(orderTonBalanceInitial - toNano(1000))
        expect(orderJettonDataAfterMatch3.exchangeInfo.amount).toBe(orderJettonBalanceInitial - toNano(1000))

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
        console.log("\n--- SUMMARY ---")
        console.log("=== Order TON initial balance:", orderTonBalanceInitial)
        console.log("=== Order TON initial contract balance:", orderTonContractBalanceInitial)
        console.log("=== Order TON balance after match 1:", orderTonDataAfterMatch1.exchangeInfo.amount)
        console.log("=== Order TON contract balance after match 1:", orderTonContractBalanceAfterMatch1)
        console.log("=== Order TON balance after match 2:", orderTonDataAfterMatch2.exchangeInfo.amount)
        console.log("=== Order TON contract balance after match 2:", orderTonContractBalanceAfterMatch2)
        console.log("=== Order TON balance after match 3:", orderTonDataAfterMatch3.exchangeInfo.amount)
        console.log("=== Order TON contract balance after match 3:", orderTonContractBalanceAfterMatch3)
        console.log("=== Order TON total change:", orderTonDataAfterMatch3.exchangeInfo.amount - orderTonBalanceInitial)
        console.log("=== Order TON contract balance total change:", orderTonContractBalanceAfterMatch3 - orderTonContractBalanceInitial)
        console.log("=== Order JETTON initial balance:", orderJettonBalanceInitial)
        console.log("=== Order JETTON initial contract balance:", orderJettonContractBalanceInitial)
        console.log("=== Order JETTON balance after match 1:", orderJettonDataAfterMatch1.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance after match 1:", orderJettonContractBalanceAfterMatch1)
        console.log("=== Order JETTON balance after match 2:", orderJettonDataAfterMatch2.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance after match 2:", orderJettonContractBalanceAfterMatch2)
        console.log("=== Order JETTON balance after match 3:", orderJettonDataAfterMatch3.exchangeInfo.amount)
        console.log("=== Order JETTON contract balance after match 3:", orderJettonContractBalanceAfterMatch3)
        console.log("=== Order JETTON total change:", orderJettonDataAfterMatch3.exchangeInfo.amount - orderJettonBalanceInitial)
        console.log("=== Order JETTON contract balance total change:", orderJettonContractBalanceAfterMatch3 - orderJettonContractBalanceInitial)
    })
});
