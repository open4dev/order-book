import { NetworkProvider, compile } from '@ton/blueprint';
import { VaultFactory } from '../wrappers/VaultFactory';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromConfig({
        vaultCode: await compile('Vault'),
        orderCode: await compile('Order'),
        feeCollectorCode: await compile('FeeCollector'),
    }, await compile('VaultFactory')));

    await vaultFactory.sendDeploy(provider.sender(), Gas.VAULT_FACTORY_DEPLOY);
    await provider.waitForDeploy(vaultFactory.address);

    console.log('VaultFactory deployed at:', vaultFactory.address.toString());
}
