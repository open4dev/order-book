import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultConfig = {};

export function vaultConfigToCell(config: VaultConfig): Cell {
    return beginCell().endCell();
}

export class Vault implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        const comissionInfo = beginCell().store
        
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x2717c4a2, 32)

            .endCell(),
        });
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
            .endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            amount: stack.readBigNumber(),
            jettonMaster: stack.readCellOpt(),
            randomHash_hex: stack.readBigNumber().toString(16),
            vaultFactory: stack.readAddress(),
        };
    }

    async getCodes(provider: ContractProvider) {
        const { stack } = await provider.get('getCodes', []);
        return {
            jettonWalletCode: stack.readCell(),
            orderCode: stack.readCell()
        };
    }
}
