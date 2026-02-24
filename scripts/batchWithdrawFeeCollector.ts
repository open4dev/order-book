import { Address, beginCell, toNano, internal, SendMode } from '@ton/core';
import { compile } from '@ton/blueprint';
import { TonClient } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { HighloadWalletV3 } from '@tonkite/highload-wallet-v3';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { GAS_FEE_COLLECTOR_WITHDRAW } from '../tests/Helper';

/**
 * Batch withdraw from multiple FeeCollectors via Highload Wallet v3.
 *
 * Usage: npx ts-node scripts/batchWithdrawFeeCollector.ts
 *
 * Environment variables (or edit constants below):
 *   MNEMONIC  — 24-word mnemonic of the matcher's highload wallet
 *   ENDPOINT  — TON API endpoint (default: mainnet toncenter)
 *
 * Edit VAULT_ADDRESSES array with all vaults you want to withdraw from.
 * The script will:
 *   1. Derive keypair from mnemonic
 *   2. Compute FeeCollector address for each vault (owner = highload wallet)
 *   3. Read accumulated fees from each FeeCollector
 *   4. Build batch of withdraw messages
 *   5. Send single external message to highload wallet with all withdrawals
 */

// ==================== CONFIGURATION ====================

// const MNEMONIC = process.env.MNEMONIC || '';
const MNEMONIC = process.env.MNEMONIC || '';


const ENDPOINT = process.env.ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
// const API_KEY = process.env.API_KEY || '';
const API_KEY = process.env.API_KEY || '';


// List all vault addresses to withdraw fees from
const VAULT_ADDRESSES: string[] = [
];

// ==================== MAIN ====================

async function main() {
    // 1. Parse mnemonic
    if (!MNEMONIC) {
        console.error('Error: MNEMONIC is required. Set it via env variable or edit the script.');
        process.exit(1);
    }
    if (VAULT_ADDRESSES.length === 0) {
        console.error('Error: VAULT_ADDRESSES is empty. Add vault addresses to the array.');
        process.exit(1);
    }

    const mnemonicWords = MNEMONIC.trim().split(/\s+/);
    if (mnemonicWords.length !== 24) {
        console.error(`Error: Expected 24 mnemonic words, got ${mnemonicWords.length}`);
        process.exit(1);
    }

    const keyPair = await mnemonicToPrivateKey(mnemonicWords);

    // 2. Create highload wallet
    // SubwalletId must be 698983191 (DefaultSubwallet in tonutils-go) to match Go backend
    const sequence = HighloadWalletV3.newSequence();
    const wallet = new HighloadWalletV3(
        sequence,
        keyPair.publicKey,
        3600,
        698983191,
    );

    console.log('Highload Wallet address:', wallet.address.toString());

    // 3. Connect to TON
    const client = new TonClient({
        endpoint: ENDPOINT,
        apiKey: API_KEY || undefined,
    });

    // 4. Compile FeeCollector code
    const feeCollectorCode = await compile('FeeCollector');

    const owner = wallet.address;

    // 5. Check wallet state
    const walletState = await client.getContractState(wallet.address);
    console.log('Wallet state:', walletState.state);

    if (walletState.state !== 'active') {
        console.log('WARNING: Highload wallet is not deployed yet.');
        console.log('The first transaction will deploy it (stateInit will be included).');
    }

    if (walletState.balance !== undefined) {
        console.log('Wallet balance:', Number(walletState.balance) / 1e9, 'TON');
    }
    console.log('');

    // 6. Build messages for each vault
    const withdrawBody = beginCell().storeUint(0xec9a92f6, 32).endCell();

    type BatchMessage = { mode: SendMode; message: ReturnType<typeof internal> };
    const messages: BatchMessage[] = [];
    let totalFees = 0n;

    console.log(`Checking ${VAULT_ADDRESSES.length} vault(s)...`);
    console.log('');

    for (const vaultAddrStr of VAULT_ADDRESSES) {
        const vault = Address.parse(vaultAddrStr);

        const feeCollectorContract = FeeCollector.createFromConfig(
            { vault, owner, amount: 0n },
            feeCollectorCode,
        );

        const feeCollectorAddr = feeCollectorContract.address;

        // Read on-chain data
        try {
            const provider = client.provider(feeCollectorAddr);
            const fc = new FeeCollector(feeCollectorAddr);
            const data = await fc.getData(provider);

            console.log(`Vault: ${vault.toString()}`);
            console.log(`  FeeCollector: ${feeCollectorAddr.toString()}`);
            console.log(`  Accumulated:  ${data.amount.toString()} nanoTON (${Number(data.amount) / 1e9} TON)`);

            if (data.amount === 0n) {
                console.log('  → Skipped (no fees)');
                console.log('');
                continue;
            }

            totalFees += data.amount;
        } catch (e: any) {
            console.log(`Vault: ${vault.toString()}`);
            console.log(`  FeeCollector: ${feeCollectorAddr.toString()}`);
            console.log(`  → Could not read data (contract not deployed?): ${e.message}`);
            console.log('  → Skipped');
            console.log('');
            continue;
        }

        messages.push({
            mode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            message: internal({
                to: feeCollectorAddr,
                value: GAS_FEE_COLLECTOR_WITHDRAW,
                body: withdrawBody,
                bounce: true,
            }),
        });
    }

    if (messages.length === 0) {
        console.log('No FeeCollectors with fees to withdraw. Exiting.');
        return;
    }

    console.log('='.repeat(50));
    console.log(`Total FeeCollectors to withdraw: ${messages.length}`);
    console.log(`Total accumulated fees: ${totalFees.toString()} nanoTON (${Number(totalFees) / 1e9} TON)`);
    console.log(`Gas per withdraw: ${Number(GAS_FEE_COLLECTOR_WITHDRAW) / 1e9} TON`);
    console.log(`Total gas needed: ${Number(GAS_FEE_COLLECTOR_WITHDRAW * BigInt(messages.length)) / 1e9} TON`);
    console.log('='.repeat(50));
    console.log('');

    // 7. Send batch
    console.log('Sending batch withdraw transaction...');

    // Pass wallet.init so stateInit is included if wallet is not yet deployed
    const walletProvider = client.provider(wallet.address, wallet.init);

    await wallet.sendBatch(walletProvider, keyPair.secretKey, {
        messages,
        createdAt: Math.floor(Date.now() / 1000) - 60,
    });

    console.log('Batch withdraw transaction sent!');
    console.log(`Sent ${messages.length} withdraw message(s) in a single external message.`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
