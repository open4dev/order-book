import { Address, toNano } from '@ton/core';
import { MatcherFeeCollector } from '../wrappers/MatcherFeeCollector';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const matcherFeeCollector = provider.open(MatcherFeeCollector.createFromAddress(Address.parse("0QBk9cKfG7jEm9lxUxvC-0tZPqeDbCAuZ6sx1lI6lqAfK0aL")));

    await matcherFeeCollector.sendWithDraw(provider.sender(), toNano('0.1'));

    // run methods on `matcherFeeCollector`
}
