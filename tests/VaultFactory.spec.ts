import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
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

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        vaultFactory = blockchain.openContract(VaultFactory.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await vaultFactory.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultFactory.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vaultFactory are ready to use
    });
});
