import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonMinter, jettonMinterCodeCell, createJettonOnChainContent } from '../wrappers/JettonMinter';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    const senderAddress = provider.sender().address!;

    // Create jetton content
    const jettonContent = await createJettonOnChainContent({
        name: 'Test Jetton',
        symbol: 'TEST',
        decimals: 9,
        description: 'Test Jetton for Order Book'
    });

    // Deploy minter
    const jettonMinter = provider.open(
        JettonMinter.createFromConfig({
            admin: senderAddress,
            wallet_code: jettonWalletCodeCell,
            jetton_content: jettonContent
        }, jettonMinterCodeCell)
    );

    await jettonMinter.sendDeploy(provider.sender(), Gas.VAULT_DEPLOY);
    await provider.waitForDeploy(jettonMinter.address);

    console.log('JettonMinter deployed at:', jettonMinter.address.toString());

    // Mint tokens
    const mintAmount = toNano(1_000_000_000); // 1 billion tokens
    await jettonMinter.sendMint(
        provider.sender(),
        senderAddress,
        mintAmount,
        null,
        null,
        null,
        undefined,
        undefined
    );

    console.log('Minted', mintAmount.toString(), 'tokens to', senderAddress.toString());
}
