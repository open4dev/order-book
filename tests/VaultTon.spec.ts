import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { VaultTon } from '../wrappers/VaultTon';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { GAS_STORAGE, GAS_VAULT_INIT } from './Helper';

describe('VaultTon', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('VaultTon');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<VaultTon>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        vaultTon = blockchain.openContract(VaultTon.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await vaultTon.sendDeploy(deployer.getSender(), GAS_STORAGE + GAS_VAULT_INIT);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultTon.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vaultTon are ready to use
    });

    it("VaultJettonTransfer (VaultTon) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
    });

    it("VaultJettonTransfer (VaultTon) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER);
    });

    it("VaultJettonTransfer (VaultTon) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("VaultJettonTransfer (VaultTon) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("CloseOrder (VaultTon) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;
    });

    it("CloseOrder (VaultTon) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER);
    });

    it("CloseOrder (VaultTon) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("CloseOrder (VaultTon) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("TonTransfer -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= msg.amount + GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER) throw ERR_INSUFFICIENT_GAS;
    });

    it("TonTransfer -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= msg.amount + GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER);
    });

    it("InitVault (VaultTon) -> Failed with invalid sender (not from vault factory)", async () => {
        // TODO: Add test logic for assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
    });

    it("InitVault (VaultTon) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(in.senderAddress == storage.vault_factory);
    });

    it("InitVault (VaultTon) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
    });

    it("InitVault (VaultTon) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_INIT + GAS_STORAGE);
    });

    it("WithDraw (VaultTon) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw ERR_INSUFFICIENT_GAS;
    });

    it("WithDraw (VaultTon) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW);
    });

    it("WithDraw (VaultTon) -> Failed with invalid sender (not from fee collector)", async () => {
        // TODO: Add test logic for assert(feeCollectorAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("WithDraw (VaultTon) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(feeCollectorAddress == in.senderAddress);
    });
});
