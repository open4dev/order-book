import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { GAS_FEE_COLLECTOR_WITHDRAW } from '../tests/Helper';

/**
 * Script to build FeeCollector address from vault + owner and withdraw fees.
 *
 * Usage: npx blueprint run withdrawFeeCollector
 *
 * You will be prompted for:
 *   1. Vault address (the vault that accumulates fees)
 *   2. Owner address (the matcher/provider who can withdraw)
 *
 * The script will:
 *   - Compute the FeeCollector contract address from init data
 *   - Show its on-chain data and accumulated fees
 *   - Send a withdraw transaction
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    // 1. Collect input data
    const vaultAddressStr = await ui.input('Enter Vault address:');
    // const ownerAddressStr = await ui.input('Enter Owner (matcher/provider) address:');
    const ownerAddressStr = provider.sender().address!.toString();

    const vault = Address.parse(vaultAddressStr);
    const owner = Address.parse(ownerAddressStr);

    // 2. Compile FeeCollector code and compute address
    const feeCollectorCode = await compile('FeeCollector');

    const feeCollector = provider.open(
        FeeCollector.createFromConfig(
            { vault, owner, amount: 0n },
            feeCollectorCode,
        ),
    );

    console.log('');
    console.log('FeeCollector address:', feeCollector.address.toString());

    // 3. Read on-chain data
    try {
        const data = await feeCollector.getData();
        console.log('Vault:', data.vault.toString());
        console.log('Owner:', data.owner.toString());
        console.log('Accumulated fees:', data.amount.toString(), 'nanoTON');

        if (data.amount === 0n) {
            console.log('No fees to withdraw.');
            return;
        }
    } catch (e) {
        console.log('Could not read FeeCollector data (contract may not be deployed yet).');
        console.log('Proceeding with withdraw anyway...');
    }

    // 4. Withdraw
    console.log('');
    console.log('Sending withdraw transaction...');

    await feeCollector.sendWithDraw(
        provider.sender(),
        GAS_FEE_COLLECTOR_WITHDRAW,
    );

    console.log('Withdraw transaction sent!');
}
