import { Address, toNano } from '@ton/core';
import { NetworkProvider, compile } from '@ton/blueprint';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    // Note: FeeCollectors are typically created automatically by the Vault
    // when fees are accumulated. This script is for testing purposes only.

    const senderAddress = provider.sender().address!;

    // You need to specify a vault address this fee collector is associated with
    const vaultAddress = Address.parse("YOUR_VAULT_ADDRESS");

    const feeCollector = provider.open(
        FeeCollector.createFromConfig({
            vault: vaultAddress,
            owner: senderAddress,
            amount: toNano(0),
        }, await compile('FeeCollector'))
    );

    await feeCollector.sendDeploy(provider.sender(), Gas.VAULT_DEPLOY);
    await provider.waitForDeploy(feeCollector.address);

    console.log('FeeCollector deployed at:', feeCollector.address.toString());
}
