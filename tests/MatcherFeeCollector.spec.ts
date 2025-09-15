import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { MatcherFeeCollector } from '../wrappers/MatcherFeeCollector';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('MatcherFeeCollector', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('MatcherFeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let matcherFeeCollector: SandboxContract<MatcherFeeCollector>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        matcherFeeCollector = blockchain.openContract(MatcherFeeCollector.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await matcherFeeCollector.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: matcherFeeCollector.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and matcherFeeCollector are ready to use
    });
});
