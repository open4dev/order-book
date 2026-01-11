import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("0:0c746c197c9c9ba0eb0a81b903a783dd13e7f597dca8c46300207495821b78b1")));
    await order.sendCloseOrder(provider.sender(), toNano(0.15));
}
