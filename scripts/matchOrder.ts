import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Order } from '../wrappers/Order';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    // Your order address
    const orderAddress = Address.parse("YOUR_ORDER_ADDRESS");
    const order = provider.open(Order.createFromAddress(orderAddress));

    // Match with another order
    await order.sendMatchOrder(provider.sender(), Gas.MATCH_ORDER, {
        anotherVault: Address.parse("COUNTERPARTY_VAULT_ADDRESS"),
        anotherOrderOwner: Address.parse("COUNTERPARTY_ORDER_OWNER"),
        createdAt: 0, // createdAt timestamp of the counterparty order
        amount: toNano(1), // Amount to match
    });
}
