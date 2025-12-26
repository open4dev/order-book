import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';


export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("EQB0PhayEA4shaKYCqWI-WzQn4RXCOI_EI2nYIcMSJDDF3k5")));

    await order.sendMatchOrder(
        provider.sender(),
        toNano(1),
        {
            anotherVault: Address.parse("EQBikBaA97NugW6Cnmxnkl3cIKMAo2cHmkm1e5-3t5XtKb6Z"),
            anotherOrderOwner: provider.sender().address!,
            anotherOrder: Address.parse("EQCZaz_qbjYWmBnt0T0CwO-pVLkPb-zMwiQPBaJ5KPYMCfhW"),
            createdAt: Number(0x694e64ce),
            amount: toNano(1),
        }
    )
}
