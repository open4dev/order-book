import { toNano } from '@ton/core';
import { Vault2 } from '../wrappers/Vault2';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vault2 = provider.open(Vault2.createFromConfig({}, await compile('Vault2')));

    await vault2.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(vault2.address);

    // run methods on `vault2`
}
