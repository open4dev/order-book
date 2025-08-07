import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('VaultFactory', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('VaultFactory');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vaultFactory: SandboxContract<VaultFactory>;

    let user1: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');

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
    });

    it('should deploy vault', async () => {
        const deployResultVault = await vaultFactory.sendCreateVault(deployer.getSender(), toNano('1'));
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
});
