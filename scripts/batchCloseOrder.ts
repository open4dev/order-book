import { Address, beginCell, internal, SendMode } from '@ton/core';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { GAS_ORDER_CLOSE_ORDER } from '../tests/Helper';

/**
 * Batch close multiple Orders via WalletV5R1.
 *
 * Usage: npx ts-node scripts/batchCloseOrder.ts
 *
 * Environment variables (or edit constants below):
 *   MNEMONIC  — 24-word mnemonic of the wallet
 *   ENDPOINT  — TON API endpoint (default: mainnet toncenter)
 *
 * Edit ORDER_ADDRESSES array with all order addresses you want to close.
 * Max 255 actions per single external message (WalletV5R1 limit), script uses 200 as safe limit.
 */

// ==================== CONFIGURATION ====================

const MNEMONIC = process.env.MNEMONIC || '';

const ENDPOINT = process.env.ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
const API_KEY = process.env.API_KEY || '';

const MAX_MESSAGES_PER_BATCH = 200;

// Paste order addresses here
const ORDER_ADDRESSES: string[] = [
];

// ==================== MAIN ====================

async function main() {
    if (!MNEMONIC) {
        console.error('Error: MNEMONIC is required. Set it via env variable or edit the script.');
        process.exit(1);
    }
    if (ORDER_ADDRESSES.length === 0) {
        console.error('Error: ORDER_ADDRESSES is empty. Add order addresses to the array.');
        process.exit(1);
    }
    if (ORDER_ADDRESSES.length > MAX_MESSAGES_PER_BATCH) {
        console.error(`Error: Too many addresses (${ORDER_ADDRESSES.length}). Max ${MAX_MESSAGES_PER_BATCH} per batch.`);
        process.exit(1);
    }

    const mnemonicWords = MNEMONIC.trim().split(/\s+/);
    if (mnemonicWords.length !== 24) {
        console.error(`Error: Expected 24 mnemonic words, got ${mnemonicWords.length}`);
        process.exit(1);
    }

    const keyPair = await mnemonicToPrivateKey(mnemonicWords);

    // Create WalletV5R1
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    console.log('Wallet V5R1 address:', wallet.address.toString());

    // Connect to TON
    const client = new TonClient({
        endpoint: ENDPOINT,
        apiKey: API_KEY || undefined,
    });

    // Check wallet state
    const walletContract = client.open(wallet);
    const walletState = await client.getContractState(wallet.address);
    console.log('Wallet state:', walletState.state);

    if (walletState.state !== 'active') {
        console.error('ERROR: Wallet is not deployed. Deploy it first.');
        process.exit(1);
    }

    if (walletState.balance !== undefined) {
        console.log('Wallet balance:', Number(walletState.balance) / 1e9, 'TON');
    }

    // Get current seqno
    const seqno = await walletContract.getSeqno();
    console.log('Wallet seqno:', seqno);
    console.log('');

    // Build close order body: opcode 0x52e80bac
    const closeOrderBody = beginCell().storeUint(0x52e80bac, 32).endCell();

    const messages: ReturnType<typeof internal>[] = [];

    console.log(`Preparing ${ORDER_ADDRESSES.length} order(s) for closing...`);
    console.log('');

    for (const orderAddrStr of ORDER_ADDRESSES) {
        const orderAddr = Address.parse(orderAddrStr);

        // Check if contract is active
        try {
            const state = await client.getContractState(orderAddr);
            console.log(`Order: ${orderAddr.toString()}`);
            console.log(`  State: ${state.state}`);

            if (state.state !== 'active') {
                console.log('  → Skipped (not active)');
                console.log('');
                continue;
            }
        } catch (e: any) {
            console.log(`Order: ${orderAddr.toString()}`);
            console.log(`  → Could not read state: ${e.message}`);
            console.log('  → Skipped');
            console.log('');
            continue;
        }

        messages.push(
            internal({
                to: orderAddr,
                value: GAS_ORDER_CLOSE_ORDER,
                body: closeOrderBody,
                bounce: true,
            }),
        );
    }

    if (messages.length === 0) {
        console.log('No active orders to close. Exiting.');
        return;
    }

    console.log('='.repeat(50));
    console.log(`Total orders to close: ${messages.length}`);
    console.log(`Gas per close: ${Number(GAS_ORDER_CLOSE_ORDER) / 1e9} TON`);
    console.log(`Total gas needed: ${Number(GAS_ORDER_CLOSE_ORDER * BigInt(messages.length)) / 1e9} TON`);
    console.log('='.repeat(50));
    console.log('');

    // Send batch via sendTransfer
    console.log('Sending batch close order transaction...');

    await walletContract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        timeout: Math.floor(Date.now() / 1000) + 120,
    });

    console.log('Batch close order transaction sent!');
    console.log(`Sent ${messages.length} close message(s) in a single external message.`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
