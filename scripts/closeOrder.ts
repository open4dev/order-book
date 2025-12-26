import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("EQB0PhayEA4shaKYCqWI-WzQn4RXCOI_EI2nYIcMSJDDF3k5")));
    await order.sendCloseOrder(provider.sender(), toNano(0.15));
}
