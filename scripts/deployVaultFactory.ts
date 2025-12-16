import { toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromConfig({
        owner: provider.sender().address!,
        vaultCode: await compile('Vault3'),
        orderCode: await compile('Order'),
        feeCollectorCode: await compile('FeeCollector'),
        comissionInfo: {
            comission_num: 5,
            comission_denom: 1000,
        },
        comissionInfoMatcher: {
            comission_num: 1,
            comission_denom: 1000,
        },
    }, await compile('VaultFactory')));

    await vaultFactory.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vaultFactory.address);

    // run methods on `vaultFactory`
}
