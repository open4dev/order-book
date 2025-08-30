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
    amount: bigint;
    priceRate: bigint;
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

    async sendMatchOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        anotherVault: Address,
        anotherOrderOwner: Address,
        anotherOrder: Address,
        createdAt: number,
    }) {

        // anotherVault: address
        // anotherOrderOwner: address
        // anotherOrder: address
        // amount: coins

        // var matchExchangeInfo = beginCell()
        //     .storeCoins(params.amount)
        //     .storeCoins(params.priceRate)
        //     .endCell();

        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x47ff7e25, 32)
            .storeAddress(params.anotherVault)
            .storeAddress(params.anotherOrderOwner)
            .storeAddress(params.anotherOrder)
            // .storeRef(matchExchangeInfo)
            .storeUint(params.createdAt, 32)
            .endCell(),
        });
    }

    async sendCloseOrder(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x52e80bac, 32).endCell(),
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
            amount: exchangeInfoCell.loadCoins(),
            priceRate: exchangeInfoCell.loadCoins(),
        };
        var result = {
            owner: owner,
            vault: vault,
            exchangeInfo: exchangeInfo,
            createdAt: res.stack.readNumber(),
        };
        return result;
    }
}
