import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Vault2 } from '../wrappers/Vault2';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { GAS_STORAGE, GAS_VAULT_INIT } from './Helper';


// it is anon jetton wallet code
// jetton master: EQDv-yr41_CZ2urg2gfegVfa44PDPjIK9F-MilEDKDUIhlwZ
const jettonWalletCodeOfVault2 = Cell.fromHex("b5ee9c7201021101000323000114ff00f4a413f4bcf2c80b0102016202030202cc0405001ba0f605da89a1f401f481f481a8610201d40607020120080900c30831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc2000113e910c1c2ebcb853600201200a0b0083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa401f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80c0201200d0e009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5402f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600f1000d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed54")

describe('Vault2', () => {
    let code: Cell;
    let orderCode: Cell;
    let feeCollectorCode: Cell;

    beforeAll(async () => {
        code = await compile('Vault2');
        orderCode = await compile('Order');
        feeCollectorCode = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vault2: SandboxContract<Vault2>;
    let mockJettonMinter: SandboxContract<TreasuryContract>;
    let mockVaultFactory: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        mockJettonMinter = await blockchain.treasury('mockJettonMinter');
        mockVaultFactory = await blockchain.treasury('mockVaultFactory');

        vault2 = blockchain.openContract(Vault2.createFromConfig({
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


        const deployResult = await vault2.sendDeploy(mockVaultFactory.getSender(), GAS_STORAGE + GAS_VAULT_INIT);

        expect(deployResult.transactions).toHaveTransaction({
            from: mockVaultFactory.address,
            to: vault2.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and vault2 are ready to use
    });

    it("VaultJettonTransfer (Vault2) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
    });

    it("VaultJettonTransfer (Vault2) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER);
    });

    it("VaultJettonTransfer (Vault2) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("VaultJettonTransfer (Vault2) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("CloseOrder (Vault2) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;
    });

    it("CloseOrder (Vault2) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER);
    });

    it("CloseOrder (Vault2) -> Failed with invalid sender (not from generated order)", async () => {
        // TODO: Add test logic for assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("CloseOrder (Vault2) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(generatedOrderAddress == in.senderAddress);
    });

    it("JettonTransferNotification (Vault2) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE) throw ERR_INSUFFICIENT_GAS;
    });

    it("JettonTransferNotification (Vault2) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE);
    });

    it("JettonTransferNotification (Vault2) -> Failed with forward_payload == null", async () => {
        // TODO: Add test logic for assert(msg.forward_payload != null) throw ERR_FORWARD_PAYLOAD_REQUIRED;
    });

    it("JettonTransferNotification (Vault2) -> Success with forward_payload", async () => {
        // TODO: Add positive test logic for assert(msg.forward_payload != null);
    });

    it("JettonTransferNotification (Vault2) -> Failed with invalid jetton wallet", async () => {
        // TODO: Add test logic for assert(generatedJettonWalletAddress == in.senderAddress) throw ERR_INVALID_JETTON_WALLET;
    });

    it("JettonTransferNotification (Vault2) -> Success with valid jetton wallet", async () => {
        // TODO: Add positive test logic for assert(generatedJettonWalletAddress == in.senderAddress);
    });

    it("InitVault (Vault2) -> Failed with invalid sender (not from vault factory)", async () => {
        // TODO: Add test logic for assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
    });

    it("InitVault (Vault2) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(in.senderAddress == storage.vault_factory);
    });

    it("InitVault (Vault2) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_VAULT_INIT) throw ERR_INSUFFICIENT_GAS;
    });

    it("InitVault (Vault2) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_STORAGE + GAS_VAULT_INIT);
    });

    it("WithDraw (Vault2) -> Failed with not enough gas", async () => {
        // TODO: Add test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw ERR_INSUFFICIENT_GAS;
    });

    it("WithDraw (Vault2) -> Success with enough gas", async () => {
        // TODO: Add positive test logic for assert(in.valueCoins >= GAS_VAULT_WITHDRAW);
    });

    it("WithDraw (Vault2) -> Failed with invalid sender (not from fee collector)", async () => {
        // TODO: Add test logic for assert(feeCollectorAddress == in.senderAddress) throw ERR_INVALID_SENDER;
    });

    it("WithDraw (Vault2) -> Success with valid sender", async () => {
        // TODO: Add positive test logic for assert(feeCollectorAddress == in.senderAddress);
    });
});
