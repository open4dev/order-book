import { toNano } from '@ton/core';
import { MatcherFeeCollector } from '../wrappers/MatcherFeeCollector';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const matcherFeeCollector = provider.open(MatcherFeeCollector.createFromConfig({}, await compile('MatcherFeeCollector')));

    await matcherFeeCollector.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(matcherFeeCollector.address);

    // run methods on `matcherFeeCollector`
}
