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
        const toAmount = toNano(50)
        const toJettonMinterAddress = toJettonMinter.address
        const forwardPayload = beginCell().storeCoins(toAmount).storeAddress(toJettonMinterAddress).endCell()

        const resultCreateOrder = await toJettonWallet.sendTransfer(user2.getSender(), toNano(0.5), await toJettonWallet.getJettonBalance(), toVault.address, user2.address, null, toNano(0.1), forwardPayload)
        printTransactionFees(resultCreateOrder.transactions)
        const toOrder = getOrderWrapper(blockchain, resultCreateOrder, toVault.address)

        console.log(user2.address)
        console.log(toJettonMinter.address)
        console.log(await toJettonWallet.getWalletData())
        console.log(await toOrder.getData())

        console.log(toJettonMinter.address)
        console.log(fromJettonMinter.address)
        // TODO: fix similar jetton minter addressed in order

    });
});
