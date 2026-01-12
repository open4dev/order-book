import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { VaultTon } from '../wrappers/VaultTon';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { GAS_CREATE_ORDER_TON, GAS_STORAGE, GAS_VAULT_INIT } from './Helper';
import { randomAddress } from '@ton/test-utils';

describe('VaultTon', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('VaultTon');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vaultTon: SandboxContract<VaultTon>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');

        vaultTon = blockchain.openContract(VaultTon.createFromConfig({
            vaultFactory: mockVaultFactory.address,
            codesInfo: {
                orderCode: orderCode,
                feeCollectorCode: feeCollectorCode,
            },
            randomHash: BigInt(0),
            amount: BigInt(0),
        }, code));


        const deployResult = await vaultTon.sendInitVault(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);

        expect(deployResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
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
        const vaultJettonTransferResult = await vaultTon.sendCreateOrder(
            deployer.getSender(),
            toNano(100) + GAS_CREATE_ORDER_TON - toNano(0.0001),
            {
                amount: toNano(100),
                priceRate: toNano(2),
                slippage: toNano(0.05),
                toJettonMinter: randomAddress(0),
                providerFee: deployer.address,
                feeNum: 1,
                feeDenom: 1000,
                matcherFeeNum: 1,
                matcherFeeDenom: 1000,
                createdAt: Math.round(Number(new Date().getTime() / 1000)),
            }
        );
        printTransactionFees(vaultJettonTransferResult.transactions);


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
