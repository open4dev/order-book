import { Address, toNano } from '@ton/core';
import { JettonMinter, jettonMinterCodeCell } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';

export async function run(provider: NetworkProvider) {
    // const jettonMinterFrom = provider.open(
    //     JettonMinter.createFromAddress(Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"))
    // )

    // await jettonMinterFrom.sendMint(provider.sender(), Address.parse("0QAvYfgU56WI3g46GQ3U8LnIT3tCXNG_hTVF6ehQf5KVhWmg"), toNano(1000000000),
    // null, null, null, undefined, undefined);

    const jettonMinterTo = provider.open(
        JettonMinter.createFromAddress(Address.parse("kQDegHRHZdro9SYipDnQ41pji9HSJteoYBRS8lfpMzHGUjhg"))
    )

    await jettonMinterTo.sendMint(provider.sender(), Address.parse("0QAvYfgU56WI3g46GQ3U8LnIT3tCXNG_hTVF6ehQf5KVhWmg"), toNano(1000000000),
    null, null, null, undefined, undefined);

    // run methods on `vaultFactory`
}
