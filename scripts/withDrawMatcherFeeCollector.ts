import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    const feeCollectorAddress = Address.parse("YOUR_FEE_COLLECTOR_ADDRESS");
    const feeCollector = provider.open(FeeCollector.createFromAddress(feeCollectorAddress));

    await feeCollector.sendWithDraw(provider.sender(), Gas.FEE_COLLECTOR_WITHDRAW);
}
