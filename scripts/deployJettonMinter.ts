import { toNano } from '@ton/core';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';

export async function run(provider: NetworkProvider) {
    const jettonMinterFrom = provider.open(
        JettonMinter.createFromConfig({
            admin: provider.sender().address!,
            wallet_code: jettonWalletCodeCell,
            jetton_content: {
                uri: 'from'
            }
        }, jettonMinterCodeCell)
    )

    await jettonMinterFrom.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jettonMinterFrom.address);

    const jettonMinterTo = provider.open(
        JettonMinter.createFromConfig({
            admin: provider.sender().address!,
            wallet_code: jettonWalletCodeCell,
            jetton_content: {
                uri: 'to'
            }
        }, jettonMinterCodeCell)
    )

    await jettonMinterTo.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jettonMinterTo.address);

    // run methods on `vaultFactory`
}
