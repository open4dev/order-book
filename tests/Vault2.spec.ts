import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault2 } from '../wrappers/Vault2';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Vault2', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Vault2');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vault2: SandboxContract<Vault2>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        vault2 = blockchain.openContract(Vault2.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await vault2.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vault2.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vault2 are ready to use
    });
});
