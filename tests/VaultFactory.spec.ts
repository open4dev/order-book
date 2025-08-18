import { Blockchain, printTransactionFees, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { flattenTransaction, randomAddress } from '@ton/test-utils';
import { JettonMinter, jettonMinterCodeCell, JettonMinterConfig, JettonMinterContent } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
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
            vaultCode: await compile('Vault'),
            orderCode: await compile('Order'),
            commission: 10,
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
        printTransactionFees(resultUser1FromJettonWalletMint.transactions)

        fromJettonWallet = getJettonWalletWrapper(blockchain, resultUser1FromJettonWalletMint, fromJettonMinter.address)

        const resultCreateVaultFrom = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, fromJettonMinter.address, 1)

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

        const resultCreateVaultTo = await vaultFactory.sendCreateVault(deployer.getSender(), toNano(1), jettonWalletCodeCell, toJettonMinter.address, 1)

        toVault = getVaultWrapper(blockchain, resultCreateVaultTo, toJettonMinter.address)
        console.log(toVault.address)

    });

    it('should deploy vault', async () => {
        const deployResultVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano('1'), beginCell().endCell(), randomAddress(), 1);
    });

    it('should change owner', async () => {
        const oldOwner = await vaultFactory.getOwner();
        const changeOwnerResult = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano('0.05'), user1.address);
        const newOwner = await vaultFactory.getOwner();
        expect(oldOwner).not.toBe(newOwner);
    });

    it('should change commission', async () => {
        const oldCommission = await vaultFactory.getCommission();
        const changeCommissionResult = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano('0.05'), 15);
        const newCommission = await vaultFactory.getCommission();
        expect(oldCommission).not.toBe(newCommission);
    });

    it('should deploy order', async () => {
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
                toAmount: toAmount,
                toJettonMinter: toJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateOrder.transactions)
        const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)
        const orderData = await fromOrder.getData()

        console.log(orderData)

        expect(orderData.exchangeInfo.fromAmount).toBe(fromAmount)
        expect(orderData.exchangeInfo.toAmount).toBe(toAmount)
        expect(orderData.exchangeInfo.fromJettonMinter.toRawString()).toBe(fromJettonMinter.address.toRawString())
        expect(orderData.exchangeInfo.toJettonMinter.toRawString()).toBe(toJettonMinter.address.toRawString())
        expect(orderData.owner.toRawString()).toBe(user1.address.toRawString())
        expect(orderData.vault.toRawString()).toBe(fromVault.address.toRawString())
    });

    it('should match order', async () => {

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
                toAmount: toAmount,
                toJettonMinter: toJettonMinterAddress,
                forwardTonAmount: toNano(0.1)
            }
        )
        printTransactionFees(resultCreateOrder.transactions)
        const fromOrder = getOrderWrapper(blockchain, resultCreateOrder, fromVault.address)

        console.log(await fromOrder.getData())


        const toFromAmount = toAmount
        const fromToAmount = await toJettonWallet.getJettonBalance()
        const toFromJettonMinterAddress = fromJettonMinter.address
        
        const resultCreateToOrder = await toJettonWallet.sendCreateOrder(
            user2.getSender(),
            toNano(0.5),
            {
                jettonAmount: toFromAmount,
                vault: toVault.address,
                owner: user2.address,
                toAmount: fromToAmount,
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
                fromAmount: toNano(100),
                toAmount: toNano(50)
            }
        )

        printTransactionFees(resultMatchOrder.transactions)
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
                toAmount: toAmount,
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
