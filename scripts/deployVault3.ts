import { toNano } from '@ton/core';
import { Vault3 } from '../wrappers/Vault3';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vault3 = provider.open(Vault3.createFromConfig({}, await compile('Vault3')));

    await vault3.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vault3.address);

    // run methods on `vault3`
}
