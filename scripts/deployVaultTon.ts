import { toNano } from '@ton/core';
import { VaultTon } from '../wrappers/VaultTon';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vaultTon = provider.open(VaultTon.createFromConfig({}, await compile('VaultTon')));

    await vaultTon.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vaultTon.address);

    // run methods on `vaultTon`
}
