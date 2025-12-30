import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("EQA-DuarS2dFzRM7khypkfyUI8S5QojouNX28HE3LgovO-rp")));
    await order.sendCloseOrder(provider.sender(), toNano(0.15));
}
