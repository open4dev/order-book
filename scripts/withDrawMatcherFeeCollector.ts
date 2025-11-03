import { Address, toNano } from '@ton/core';
import { MatcherFeeCollector } from '../wrappers/MatcherFeeCollector';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const matcherFeeCollector = provider.open(MatcherFeeCollector.createFromAddress(Address.parse("EQCRrFhBT6QaOsMVq5dnXyH5uDCAYRi6Mdk9W1Kss7jGeULO")));

    await matcherFeeCollector.sendWithDraw(provider.sender(), toNano('0.1'));

    // run methods on `matcherFeeCollector`
}
