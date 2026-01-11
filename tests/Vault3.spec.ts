import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault3 } from '../wrappers/Vault3';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';


// it is NOT jetton wallet code
// jetton master: EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT
const jettonWalletCodeOfVault2 = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395")

describe('Vault3', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;


    beforeAll(async () => {
        code = await compile('Vault3');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vault3: SandboxContract<Vault3>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;
    let mockJettonMinter: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');
        mockJettonMinter = await blockchain.treasury('mockJettonMinter');

        vault3 = blockchain.openContract(Vault3.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                jettonWalletCode: jettonWalletCodeOfVault2,
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            fromJetton: {
                jettonMinter: mockJettonMinter.address,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));

        const deployResult = await vault3.sendDeploy(mockVaultFactory.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
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
