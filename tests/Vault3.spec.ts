import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault3 } from '../wrappers/Vault3';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { GAS_STORAGE, GAS_VAULT_INIT } from './Helper';


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

        const deployResult = await vault3.sendDeploy(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);

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

    it("VaultJettonTransfer (Vault3) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
    });

    it("VaultJettonTransfer (Vault3) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER);
    });

    it("VaultJettonTransfer (Vault3) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("VaultJettonTransfer (Vault3) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("CloseOrder (Vault3) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;
    });

    it("CloseOrder (Vault3) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER);
    });

    it("CloseOrder (Vault3) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("CloseOrder (Vault3) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("JettonTransferNotification (Vault3) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE) throw ERR_INSUFFICIENT_GAS;
    });

    it("JettonTransferNotification (Vault3) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE);
    });

    it("JettonTransferNotification (Vault3) -> Failed with forward_payload == null", async () => {
        // TODO: Add test logic for assert(msg.forward_payload != null) throw ERR_FORWARD_PAYLOAD_REQUIRED;
    });

    it("JettonTransferNotification (Vault3) -> Success with forward_payload", async () => {
        // TODO: Add positive test logic for assert(msg.forward_payload != null);
    });

    it("JettonTransferNotification (Vault3) -> Failed with invalid jetton wallet", async () => {
        // TODO: Add test logic for assert(generatedJettonWalletAddress == in.senderAddress) throw ERR_INVALID_JETTON_WALLET;
    });

    it("JettonTransferNotification (Vault3) -> Success with valid jetton wallet", async () => {
        // TODO: Add positive test logic for assert(generatedJettonWalletAddress == in.senderAddress);
    });

    it("InitVault (Vault3) -> Failed with invalid sender (not from vault factory)", async () => {
        // TODO: Add test logic for assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
    });

    it("InitVault (Vault3) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(in.senderAddress == storage.vault_factory);
    });

    it("InitVault (Vault3) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_VAULT_INIT) throw ERR_INSUFFICIENT_GAS;
    });

    it("InitVault (Vault3) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_VAULT_INIT);
    });

    it("WithDraw (Vault3) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw ERR_INSUFFICIENT_GAS;
    });

    it("WithDraw (Vault3) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW);
    });

    it("WithDraw (Vault3) -> Failed with invalid sender (not from fee collector)", async () => {
        // TODO: Add test logic for assert(feeCollectorAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("WithDraw (Vault3) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(feeCollectorAddress == in.senderAddress);
    });
});
