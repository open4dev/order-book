import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type OrderConfig = {};

export function orderConfigToCell(config: OrderConfig): Cell {
    return beginCell().endCell();
}

export type OrderData = {
    owner: Address;
    vault: Address;
    exchangeInfo: ExchangeInfo;
}

export type ExchangeInfo = {
    fromJettonMinter: Address;
    toJettonMinter: Address;
    fromAmount: bigint;
    toAmount: bigint;
}

export class Order implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Order(address);
    }

    static createFromConfig(config: OrderConfig, code: Cell, workchain = 0) {
        const data = orderConfigToCell(config);
        const init = { code, data };
        return new Order(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        let res = await provider.get('getData', []);
        var owner = res.stack.readAddress();
        var vault = res.stack.readAddress();
        var exchangeInfoCell = res.stack.readCell().asSlice();
        var exchangeInfo = {
            fromJettonMinter: exchangeInfoCell.loadAddress(),
            toJettonMinter: exchangeInfoCell.loadAddress(),
            fromAmount: exchangeInfoCell.loadCoins(),
            toAmount: exchangeInfoCell.loadCoins(),
        };
        var result = {
            owner: owner,
            vault: vault,
            exchangeInfo: exchangeInfo,
        };
        return result;
    }
}
