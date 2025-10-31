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
        amount: bigint,
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
            .storeUint(params.createdAt, 32)
            .storeCoins(params.amount)
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

        // struct JettonInfo {
        //     jettonMinter: address
        // }

        // struct ExchangeInfo {
        //     from: Cell<JettonInfo>?
        //     to: Cell<JettonInfo>?
        //     amount: coins
        //     priceRate: coins
        //     slippage: uint30
        // }

    async getData(provider: ContractProvider) {
        let res = await provider.get('getData', []);
        var owner = res.stack.readAddress();
        var vault = res.stack.readAddress();
        var exchangeInfoCell = res.stack.readCell().asSlice();

        var fromJettonAddress = null;

        var fromJetton = exchangeInfoCell.loadMaybeRef();
        if (fromJetton != null) {
            fromJettonAddress = fromJetton.beginParse().loadAddress();
        }

        var toJettonAddress = null;

        var toJetton = exchangeInfoCell.loadMaybeRef();
        if (toJetton != null) {
            toJettonAddress = toJetton.beginParse().loadAddress();
        }

        var exchangeInfo = {
            fromJettonMinter: fromJettonAddress,
            toJettonMinter: toJettonAddress,
            amount: exchangeInfoCell.loadCoins(),
            priceRate: exchangeInfoCell.loadCoins(),
            slippage: exchangeInfoCell.loadUint(30),
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
