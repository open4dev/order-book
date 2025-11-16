import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault3 } from '../wrappers/Vault3';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Vault3', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Vault3');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vault3: SandboxContract<Vault3>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        vault3 = blockchain.openContract(Vault3.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await vault3.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vault3.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vault3 are ready to use
    });
});
