import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import {
    OrderConfig,
    OrderFeeInfo,
    MatchOrderParams,
    InitOrderParams,
    orderConfigToCell,
    buildInitOrderBody,
    buildMatchOrderBody,
    buildCloseOrderBody,
} from './common';

// Re-export types for backwards compatibility
export { JettonInfo, ExchangeInfo, OrderFeeInfo as FeeInfo, OrderConfig } from './common';

// Legacy type alias
export type Storage = OrderConfig;

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

    async sendInit(provider: ContractProvider, via: Sender, value: bigint, params: InitOrderParams) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildInitOrderBody(params),
        });
    }

    async sendMatchOrder(provider: ContractProvider, via: Sender, value: bigint, params: MatchOrderParams) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildMatchOrderBody(params),
        });
    }

    async sendCloseOrder(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildCloseOrderBody(),
        });
    }

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

        return {
            owner: owner,
            vault: vault,
            exchangeInfo: exchangeInfo,
            createdAt: res.stack.readNumber(),
        };
    }
}
