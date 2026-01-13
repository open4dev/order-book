import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type CodesInfo = {
    orderCode: Cell;
    feeCollectorCode: Cell;
}

export type JettonInfo = {
    jettonMinter: Address;
}

export type VaultTonConfig = {
    vaultFactory: Address;
    codesInfo: CodesInfo;
    randomHash: bigint;
    amount: bigint;
};


export function vaultTonConfigToCell(config: VaultTonConfig): Cell {
    return beginCell()
        .storeAddress(config.vaultFactory)
        .storeRef(
            beginCell()
                .storeMaybeRef(null)
                .storeRef(config.codesInfo.orderCode)
                .storeRef(config.codesInfo.feeCollectorCode)
            .endCell()
            )
        .storeMaybeRef(null)
        .storeUint(config.randomHash, 256)
        .storeCoins(config.amount)
        .endCell();
}

export class VaultTon implements Contract {
    abi: ContractABI = { name: 'VaultTon' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new VaultTon(address);
    }

    static createFromConfig(config: VaultTonConfig, code: Cell, workchain = 0) {
        const data = vaultTonConfigToCell(config);
        const init = { code, data };
        return new VaultTon(contractAddress(workchain, init), init);
    }

    async sendCreateOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        amount: bigint,
        priceRate: bigint,
        slippage: bigint, // uint30
        toJettonMinter: Address,
        providerFee: Address,
        feeNum: number, // uint14
        feeDenom: number, // uint14
        matcherFeeNum: number, // uint14
        matcherFeeDenom: number, // uint14
        createdAt: number,
    }) {
        // struct ( 0xcbcd047e ) TonTransfer {
        //     amount: coins,
        //     toJetton: Cell<ToJettonInfo>
        //     slippage: uint30
        // }
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0xcbcd047e, 32)
            .storeCoins(params.amount)
            .storeRef(
                beginCell()
                    .storeAddress(params.toJettonMinter)
                .endCell()
            )
            .storeCoins(params.priceRate)
            .storeUint(params.slippage, 30)
            .storeRef(
                beginCell()
                    .storeAddress(params.providerFee)
                    .storeUint(params.feeNum, 14)
                    .storeUint(params.feeDenom, 14)
                    .storeUint(params.matcherFeeNum, 14)
                    .storeUint(params.matcherFeeDenom, 14)
                .endCell()
            )
            .storeUint(params.createdAt, 32)
            .endCell(),
        });
    }

    async sendInitVault(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x2717c4a2, 32)
            .storeAddress(via.address!)
            .endCell(),
        });
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            randomHash_hex: stack.readBigNumber().toString(16),
            vaultFactory: stack.readAddress(),
            amount: stack.readBigNumber(),
        };
    }

    async getCodes(provider: ContractProvider) {
        const { stack } = await provider.get('getCodes', []);
        return {
            orderCode: stack.readCell(),
            feeCollectorCode: stack.readCell(),
        };
    }
}
