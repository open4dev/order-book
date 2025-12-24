import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("EQCmgaar7_b-njX3Pxv7cpuXEZWtJwjiow5Z0GR2uKiSDivc")));

    await order.sendCloseOrder(provider.sender(), toNano(0.002668 + 0.00883 + 0.05));

}
