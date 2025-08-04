import { toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromConfig({}, await compile('VaultFactory')));

    await vaultFactory.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vaultFactory.address);

    // run methods on `vaultFactory`
}
