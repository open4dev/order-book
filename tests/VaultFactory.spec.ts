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


function getJettonWalletWrapper(blockchain: Blockchain, trs: SendMessageResult, jettonMinter: Address)  {
    const jettonDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x178d4519;
    });
    const jettonWallet = blockchain.openContract(JettonWallet.createFromAddress(flattenTransaction(jettonDeployTrs!).to!));
    
    return jettonWallet;
}

function getVaultWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultFactory: Address)  {
    const vaultDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2717c4a2;
    });
    const vault = blockchain.openContract(Vault.createFromAddress(flattenTransaction(vaultDeployTrs!).to!));
    
    return vault;
}

function getOrderWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
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

    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        vaultFactory = blockchain.openContract(VaultFactory.createFromConfig({
            owner: deployer.address,
            vaultCode1: await compile('Vault'),
            vaultCode2: await compile('Vault2'),
            orderCode: await compile('Order'),
            comissionInfo: {
                comission_num: 10,
                comission_denom: 100,
            },
        }, code));


        const deployResult = await vaultFactory.sendDeploy(deployer.getSender(), toNano('0.05'));

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

        fromJettonWallet = getJettonWalletWrapper(blockchain, resultUser1FromJettonWalletMint, fromJettonMinter.address)

        const resultCreateVaultFrom = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, fromJettonMinter.address, 0)

        fromVault = getVaultWrapper(blockchain, resultCreateVaultFrom, fromJettonMinter.address)


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

        toJettonWallet = getJettonWalletWrapper(blockchain, resultUser2ToJettonWalletMint, toJettonMinter.address)

        const resultCreateVaultTo = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address, 0)

        toVault = getVaultWrapper(blockchain, resultCreateVaultTo, toJettonMinter.address)
        console.log(toVault.address)

    });

    it('should deploy vault', async () => {
        const deployResultVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano('1'), beginCell().endCell(), randomAddress(), 0);
        const vault = getVaultWrapper(blockchain, deployResultVault, vaultFactory.address)
        printTransactionFees(deployResultVault.transactions)
        console.log(await vault.getData())
    });

    it('should change owner', async () => {
        const oldOwner = await vaultFactory.getOwner();
        const changeOwnerResult = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano('0.05'), user1.address);
        const newOwner = await vaultFactory.getOwner();
        expect(oldOwner).not.toBe(newOwner);
    });

    it('should change commission', async () => {
        const oldCommission = await vaultFactory.getCommission();
        const changeCommissionResult = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano('0.05'), {
            comission_num: 0,
            comission_denom: 0,
        });
        const newCommission = await vaultFactory.getCommission();
        expect(oldCommission.comission_num).not.toBe(newCommission.comission_num);
        expect(oldCommission.comission_denom).not.toBe(newCommission.comission_denom);
    });

    it('should deploy order', async () => {
        const amount = await fromJettonWallet.getJettonBalance()
        const priceRate = toNano(0.5)
        const toJettonMinterAddress = toJettonMinter.address
        
        const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
            user1.getSender(),
            toNano(0.5),
            {
                jettonAmount: amount,
                vault: fromVault.address,
                owner: user1.address,
                priceRate: priceRate,
                toJettonMinter: toJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateOrder.transactions)
        const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)
        const orderData = await fromOrder.getData()

        console.log(orderData)

        expect(orderData.exchangeInfo.amount).toBe(amount)
        expect(orderData.exchangeInfo.priceRate).toBe(priceRate)
        expect(orderData.exchangeInfo.fromJettonMinter.toRawString()).toBe(fromJettonMinter.address.toRawString())
        expect(orderData.exchangeInfo.toJettonMinter.toRawString()).toBe(toJettonMinter.address.toRawString())
        expect(orderData.owner.toRawString()).toBe(user1.address.toRawString())
        expect(orderData.vault.toRawString()).toBe(fromVault.address.toRawString())
    });

    it('should match order', async () => {
        console.log("Before fromJettonWallet", await fromJettonWallet.getWalletData())
        console.log("Before toJettonWallet", await toJettonWallet.getWalletData())
        const toJettonMinterAddress = toJettonMinter.address
        
        const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
            user1.getSender(),
            toNano(0.5),
            {
                jettonAmount: toNano(100),
                vault: fromVault.address,
                owner: user1.address,
                priceRate: toNano(0.1),
                toJettonMinter: toJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateOrder.transactions)
        const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

        console.log(await fromOrder.getData())


        const toPriceRate = toNano(2)
        const toFromJettonMinterAddress = fromJettonMinter.address
        
        const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
            user2.getSender(),
            toNano(0.5),
            {
                jettonAmount: toNano(20),
                vault: toVault.address,
                owner: user2.address,
                priceRate: toPriceRate,
                toJettonMinter: toFromJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateToOrder.transactions)
        const toOrder = getOrderWrapper(blockchain, resultCreateToOrder, toVault.address)

        console.log(await toOrder.getData())

        const resultMatchOrder = await fromOrder.sendMatchOrder(
            user1.getSender(),
            toNano(0.5),
            {
                anotherVault: toVault.address,
                anotherOrderOwner: user2.address,
                anotherOrder: toOrder.address,
                createdAt: (await fromOrder.getData()).createdAt
            }
        )

        printTransactionFees(resultMatchOrder.transactions)

        console.log("amount FromOrder after match", await fromOrder.getData())
        console.log("amount ToOrder after match", await toOrder.getData())

        console.log("amount from vault", await fromVault.getData())
        console.log("amount to vault", await toVault.getData())

        console.log("FromVault address", fromVault.address)
        console.log("ToVault address", toVault.address)

        console.log("After fromJettonWallet", await fromJettonWallet.getWalletData())
        console.log("After toJettonWallet", await toJettonWallet.getWalletData())
    });

    it('should close order', async () => {
        const fromAmount = await fromJettonWallet.getJettonBalance()
        const toAmount = toNano(50)
        const toJettonMinterAddress = toJettonMinter.address

        const resultCreateOrder = await fromJettonWallet.sendCreateOrder(
            user1.getSender(),
            toNano(0.5),
            {
                jettonAmount: fromAmount,
                vault: fromVault.address,
                owner: user1.address,
                priceRate: toAmount,
                toJettonMinter: toJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateOrder.transactions)
        const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)
        console.log("fromOrder", await fromOrder.getData())

        const vaultData = await fromVault.getData()
        console.log("vaultData", vaultData)

        const resultCloseOrder = await fromOrder.sendCloseOrder(user1.getSender(), toNano(0.5))
        printTransactionFees(resultCloseOrder.transactions)

        const vaultDataAfterClose = await fromVault.getData()
        console.log("vaultDataAfterClose", vaultDataAfterClose)
    })

});
