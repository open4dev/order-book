import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("EQA-DuarS2dFzRM7khypkfyUI8S5QojouNX28HE3LgovO-rp")));

    await order.sendMatchOrder(
        provider.sender(),
        toNano(1),
        {
            anotherVault: Address.parse("EQA8yOYAcTFc_PlaZqgVl8T0E3_493hzSgD2GXgQEj4bS_In"),
            anotherOrderOwner: provider.sender().address!,
            anotherOrder: Address.parse("EQArPkIA1kK33t8uszgZPFG4qVD4uLxlFbPqRSivTu3Spuj9"),
            createdAt: Number(0x69511c95),
            amount: toNano(0.025),
        }
    )
}
