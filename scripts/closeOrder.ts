import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Order } from '../wrappers/Order';
import { Gas } from './config';

export async function run(provider: NetworkProvider) {
    const orderAddress = Address.parse("YOUR_ORDER_ADDRESS");
    const order = provider.open(Order.createFromAddress(orderAddress));

    await order.sendCloseOrder(provider.sender(), Gas.CLOSE_ORDER);
}
