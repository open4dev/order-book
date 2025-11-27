import { Address, toNano } from '@ton/core';
import { MatcherFeeCollector } from '../wrappers/MatcherFeeCollector';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const matcherFeeCollector = provider.open(MatcherFeeCollector.createFromAddress(Address.parse("EQC3TjDRa6EKZk7KJcdsOK1512CTenBpxYdWY8bD5Tbd3dOY")));

    await matcherFeeCollector.sendWithDraw(provider.sender(), toNano('0.1'));

    // run methods on `matcherFeeCollector`
}
