import { Address, toNano } from '@ton/core';
import { createJettonOnChainContent, JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';



// jetton wallet from testnet kQDHBfkLcgDyPT7F_ejOc5GjNNt3qX_dNsOg404UVwxZ0J9S
// jetton minter from testnet kQC17piG0E7U00zd8DoC_u4wCsEAiJzxJc1kz6PtlUf0YWDM
// order 0QAZFpHH7fmjWPdgnLsX2PGBSPFbnJE-ujs1htiBNwpWY4LZ
// vault kQA5C8E3Pu2ch2wI0iat8B3OfEO_ETgH1hRBKwFKoJcLXmfW
// jetton wallet to testnet 0QBHvuxVuTNw1yFoEVbtuNk-nxT096NBDIIB8-pI6G8p23B4
// jetton minter to testnet 0QDdNZ--mIi-6zMbT-DpqsDz_XVWkI34aMVa2-N-lU0g8CuQ
// order 0QBPnygbphSxJZzSeUjXy9ZPtZMzyu0VioGl9b2bXBVOAsdn
// vault 0QD3SWWhawsaDK93ibWY_4KkXEbzMkEWiHNNT4hMkyjz5lhO

export async function run(provider: NetworkProvider) {
    const jettonContent = await createJettonOnChainContent({
        name: 'To Jetton',
        symbol: 'TO',
        decimals: 9,
        description: 'To Jetton For Testing Orders'
    })

    const jettonMinterFrom = provider.open(JettonMinter.createFromConfig({
        admin: provider.sender().address!,
        wallet_code: jettonWalletCodeCell,
        jetton_content: jettonContent
    }, jettonMinterCodeCell))

    await jettonMinterFrom.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jettonMinterFrom.address);

    // run methods on `jettonMinterFrom`

    await jettonMinterFrom.sendMint(provider.sender(), provider.sender().address!, toNano(1000000000), null, null, null, undefined, undefined);
}
