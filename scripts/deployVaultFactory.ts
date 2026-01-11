import { toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromConfig({
        vaultCode: await compile('Vault'),
        orderCode: await compile('Order'),
        feeCollectorCode: await compile('FeeCollector'),
    }, await compile('VaultFactory')));

    await vaultFactory.sendDeploy(provider.sender(), toNano(0.000526 + 0.01));

    await provider.waitForDeploy(vaultFactory.address);

    // run methods on `vaultFactory`
}
