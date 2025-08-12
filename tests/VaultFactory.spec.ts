import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { randomAddress } from '@ton/test-utils';
import { JettonMinter, jettonMinterCodeCell, JettonMinterConfig, JettonMinterContent } from '../wrappers/JettonMinter';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';

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
    let toJettonMinter: SandboxContract<JettonMinter>
    let toJettonWallet: SandboxContract<JettonWallet>

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


    });

    it('should deploy vault', async () => {
        const deployResultVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano('1'), beginCell().endCell(), randomAddress(), 1);
        printTransactionFees(deployResultVault.transactions);
    });

    it('should change owner', async () => {
        const oldOwner = await vaultFactory.getOwner();
        const changeOwnerResult = await vaultFactory.sendChangeOwner(deployer.getSender(), toNano('0.05'), user1.address);
        printTransactionFees(changeOwnerResult.transactions);
        const newOwner = await vaultFactory.getOwner();
        expect(oldOwner).not.toBe(newOwner);
    });

    it('should change commission', async () => {
        const oldCommission = await vaultFactory.getCommission();
        const changeCommissionResult = await vaultFactory.sendChangeCommission(deployer.getSender(), toNano('0.05'), 15);
        printTransactionFees(changeCommissionResult.transactions);
        const newCommission = await vaultFactory.getCommission();
        expect(oldCommission).not.toBe(newCommission);
    });

    // it('should deploy order')
});
