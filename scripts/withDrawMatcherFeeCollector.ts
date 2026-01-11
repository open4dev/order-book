import { Address, toNano } from '@ton/core';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const feeCollector = provider.open(FeeCollector.createFromAddress(Address.parse("EQC3TjDRa6EKZk7KJcdsOK1512CTenBpxYdWY8bD5Tbd3dOY")));

    await feeCollector.sendWithDraw(provider.sender(), toNano('0.1'));

    // run methods on `feeCollector`
}
