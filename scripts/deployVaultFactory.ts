import { toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromConfig({
        owner: provider.sender().address!,
        vaultCode: await compile('Vault'),
        orderCode: await compile('Order'),
        matcherFeeCollectorCode: await compile('MatcherFeeCollector'),
        comissionInfo: {
            comission_num: 2,
            comission_denom: 100,
        },
        comissionInfoMatcher: {
            comission_num: 1,
            comission_denom: 100,
        },
    }, await compile('VaultFactory')));

    await vaultFactory.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vaultFactory.address);

    // run methods on `vaultFactory`
}
