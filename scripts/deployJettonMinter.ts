import { NetworkProvider } from '@ton/blueprint';
import { JettonMinter, jettonMinterCodeCell, createJettonOnChainContent } from '../wrappers/JettonMinter';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    const jettonContent = await createJettonOnChainContent({
        name: 'Test Jetton',
        symbol: 'TEST',
        decimals: 9,
        description: 'Test Jetton for Order Book'
    });

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig({
            admin: provider.sender().address!,
            wallet_code: jettonWalletCodeCell,
            jetton_content: jettonContent
        }, jettonMinterCodeCell)
    );

    await jettonMinter.sendDeploy(provider.sender(), Gas.VAULT_DEPLOY);
    await provider.waitForDeploy(jettonMinter.address);

    console.log('JettonMinter deployed at:', jettonMinter.address.toString());
}
