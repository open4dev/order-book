import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';


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

// struct FeeInfo {
//     provider: address
//     feeNum: uint14
//     feeDenom: uint14
//     matcherFeeNum: uint14
//     matcherFeeDenom: uint14
// }


// struct Storage {
//     owner: address
//     vault: address
//     feeInfo: Cell<FeeInfo>?
//     exchangeInfo: Cell<ExchangeInfo>
//     createdAt: uint32
// }

export type JettonInfo = {
    jettonMinter: Address;
};

export type ExchangeInfo = {
    from: JettonInfo | null;
    to: JettonInfo | null;
    amount: bigint;
    priceRate: bigint;
    slippage: bigint;
};

export type FeeInfo = {
    provider: Address;
    feeNum: bigint;
    feeDenom: bigint;
    matcherFeeNum: bigint;
    matcherFeeDenom: bigint;
};

export type Storage = {
    owner: Address;
    vault: Address;
    feeInfo: FeeInfo | null;
    exchangeInfo: ExchangeInfo;
    createdAt: bigint;
};

export type OrderConfig = {
    owner: Address;
    vault: Address;
    feeInfo: FeeInfo | null;
    exchangeInfo: ExchangeInfo;
    createdAt: bigint;
};

export function orderConfigToCell(config: OrderConfig): Cell {
    const fromJettonInfoCell = config.exchangeInfo.from ? beginCell().storeAddress(config.exchangeInfo.from!.jettonMinter).endCell() : null;
    const toJettonInfoCell = config.exchangeInfo.to ? beginCell().storeAddress(config.exchangeInfo.to!.jettonMinter).endCell() : null;

    const exchangeInfoCell = beginCell()
        .storeMaybeRef(fromJettonInfoCell)
        .storeMaybeRef(toJettonInfoCell)
        .storeCoins(config.exchangeInfo.amount)
        .storeCoins(config.exchangeInfo.priceRate)
        .storeUint(config.exchangeInfo.slippage, 30)
        .endCell();

    const feeInfoCell = config.feeInfo ? beginCell()
        .storeAddress(config.feeInfo!.provider)
        .storeUint(config.feeInfo!.feeNum, 14)
        .storeUint(config.feeInfo!.feeDenom, 14)
        .storeUint(config.feeInfo!.matcherFeeNum, 14)
        .storeUint(config.feeInfo!.matcherFeeDenom, 14)
        .endCell() : null;
    


    return beginCell()
        .storeAddress(config.owner)
        .storeAddress(config.vault)
        .storeMaybeRef(feeInfoCell)
        .storeRef(exchangeInfoCell)
        .storeUint(config.createdAt, 32)
        .endCell();
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

    async sendInit(provider: ContractProvider, via: Sender, value: bigint, params: {
        amount: bigint,
        priceRate: bigint,
        slippage: bigint,
        feeInfo: FeeInfo,
    }) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x2d0e1e1b, 32)
            .storeCoins(params.amount)
            .storeCoins(params.priceRate)
            .storeUint(params.slippage, 30)
            .storeRef(beginCell()
                .storeAddress(params.feeInfo.provider)
                .storeUint(params.feeInfo.feeNum, 14)
                .storeUint(params.feeInfo.feeDenom, 14)
                .storeUint(params.feeInfo.matcherFeeNum, 14)
                .storeUint(params.feeInfo.matcherFeeDenom, 14)
            .endCell())
            .endCell(),
        });
    }

    async sendMatchOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        anotherVault: Address,
        anotherOrderOwner: Address,
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
            .storeUint(params.createdAt, 32)
            .storeCoins(params.amount)
            .endCell(),
        });
    }


    // Only for tests
    async sendInternalMatchOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        anotherVault: Address,
        anotherOrderOwner: Address,
        matcher: Address,
        feeInfo: {
            provider: Address,
            feeNum: number,
            feeDenom: number,
            matcherFeeNum: number,
            matcherFeeDenom: number,
        },
        matchExchangeInfo: {
            amount: bigint,
            priceRate: bigint,
            slippage: bigint,
        },
        createdAt: number,
    }) {
        // struct FeeInfo {
        //     provider: address
        //     feeNum: uint14
        //     feeDenom: uint14
        //     matcherFeeNum: uint14
        //     matcherFeeDenom: uint14
        // }
        // struct MatchExchangeInfo {
        //     amount: coins
        //     priceRate: coins
        //     slippage: uint30
        //     feeInfo: Cell<FeeInfo>
        // }
        // struct ( 0xdfe29f63 ) InternalMatchOrder {
        //     anotherVault: address
        //     anotherOrderOwner: address
        //     matcher: address
        //     matchExchangeInfo: Cell<MatchExchangeInfo>
        //     createdAt: uint32
        // }

        const feeInfoCell = beginCell()
            .storeAddress(params.feeInfo.provider)
            .storeUint(params.feeInfo.feeNum, 14)
            .storeUint(params.feeInfo.feeDenom, 14)
            .storeUint(params.feeInfo.matcherFeeNum, 14)
            .storeUint(params.feeInfo.matcherFeeDenom, 14)
        .endCell();
        
        const matchExchangeInfoCell = beginCell()
            .storeCoins(params.matchExchangeInfo.amount)
            .storeCoins(params.matchExchangeInfo.priceRate)
            .storeUint(params.matchExchangeInfo.slippage, 30)
            .storeRef(feeInfoCell)
        .endCell();
        
        const bodyInternalMatchOrder = beginCell()
            .storeUint(0xdfe29f63, 32)
            .storeAddress(params.anotherVault)
            .storeAddress(params.anotherOrderOwner)
            .storeAddress(params.matcher)
            .storeRef(matchExchangeInfoCell)
            .storeUint(params.createdAt, 32)
        .endCell();
        
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyInternalMatchOrder,
        });
    }

    // Only for tests
    async sendSuccessMatch(provider: ContractProvider, via: Sender, value: bigint, params: {
        anotherVault: Address,
        anotherOrderOwner: Address,
        anotherOrderCreatedAt: number,
        matcher: Address,
        feeInfo: {
            provider: Address,
            feeNum: number,
            feeDenom: number,
            matcherFeeNum: number,
            matcherFeeDenom: number,
        },
        matchExchangeInfo: {
            startAmount: bigint,
            amount: bigint,
        },
    }) {
        // struct FeeInfo {
        //     provider: address
        //     feeNum: uint14
        //     feeDenom: uint14
        //     matcherFeeNum: uint14
        //     matcherFeeDenom: uint14
        // }
        
        // struct ( 0x55feb42a ) SuccessMatch {
        //     anotherVault: address
        //     anotherOrderOwner: address
        //     anotherOrderCreatedAt: uint32
        //     matcher: address
        //     feeInfo: Cell<FeeInfo>
        //     matchExchangeInfo: Cell<SuccessInfo>
        // }

        // struct SuccessInfo {
        //     startAmount: coins
        //     amount: coins
        // }

        const feeInfoCell = beginCell()
            .storeAddress(params.feeInfo.provider)
            .storeUint(params.feeInfo.feeNum, 14)
            .storeUint(params.feeInfo.feeDenom, 14)
            .storeUint(params.feeInfo.matcherFeeNum, 14)
            .storeUint(params.feeInfo.matcherFeeDenom, 14)
        .endCell();
        
        const successInfoCell = beginCell()
            .storeCoins(params.matchExchangeInfo.startAmount)
            .storeCoins(params.matchExchangeInfo.amount)
        .endCell();
        
        const bodySuccessMatch = beginCell()
            .storeUint(0x55feb42a, 32)
            .storeAddress(params.anotherVault)
            .storeAddress(params.anotherOrderOwner)
            .storeUint(params.anotherOrderCreatedAt, 32)
            .storeAddress(params.matcher)
            .storeRef(feeInfoCell)
            .storeRef(successInfoCell)
        .endCell();
        
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodySuccessMatch,
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
