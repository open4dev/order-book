import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultFactoryConfig = {
    owner: Address;
    vaultCode: Cell;
    orderCode: Cell;
    matcherFeeCollectorCode: Cell;
    comissionInfo: {
        comission_num: number;
        comission_denom: number;
    };
    comissionInfoMatcher: {
        comission_num: number;
        comission_denom: number;
    };
};

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
    return beginCell()
    .storeAddress(config.owner)
    .storeRef(
        beginCell()
        .storeRef(config.vaultCode)
        .storeRef(config.orderCode)
        .storeRef(config.matcherFeeCollectorCode)
        .endCell()
    )
    .storeRef(
        beginCell()
        .storeUint(config.comissionInfo.comission_num, 14)
        .storeUint(config.comissionInfo.comission_denom, 14)
        .endCell()
    )
    .storeRef(
        beginCell()
        .storeUint(config.comissionInfoMatcher.comission_num, 14)
        .storeUint(config.comissionInfoMatcher.comission_denom, 14)
        .endCell()
    )
    .endCell();
}

export class VaultFactory implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new VaultFactory(address);
    }

    static createFromConfig(config: VaultFactoryConfig, code: Cell, workchain = 0) {
        const data = vaultFactoryConfigToCell(config);
        const init = { code, data };
        return new VaultFactory(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x81e36595, 32)
            .endCell(),
        });
    }

    async sendCreateVault(provider: ContractProvider, via: Sender, value: bigint, jettonWalletCode: Cell | null, jettonMaster: Address | null) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x64e90480, 32)
            .storeMaybeRef(jettonWalletCode ? jettonWalletCode : null)
            .storeMaybeRef(jettonMaster ? beginCell().storeAddress(jettonMaster).endCell() : null)
            .endCell(),
        });
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, value: bigint, newOwner: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0xb6cf7f0f, 32)
            .storeAddress(newOwner)
            .endCell(),
        });
    }

    async sendChangeCommission(provider: ContractProvider, via: Sender, value: bigint, newCommission: {
        comission_num: number;
        comission_denom: number;
    }) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x4e86ed8b, 32)
            .storeRef(
                beginCell()
                .storeUint(newCommission.comission_num, 14)
                .storeUint(newCommission.comission_denom, 14)
                .endCell()
            )
            .endCell(),
        });
    }

    async sendWithDraw(provider: ContractProvider, via: Sender, value: bigint, vaultAddress: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0xec9a92f6, 32)
            .storeAddress(vaultAddress)
            .endCell(),
        });
    }

    async getOwner(provider: ContractProvider) {
        const { stack } = await provider.get('getOwner', []);
        return stack.readAddress();
    }

    async getCommission(provider: ContractProvider) {
        const { stack } = await provider.get('getCommission', []);
        return {
            comission_num: stack.readNumber(),
            comission_denom: stack.readNumber(),
        };
    }
}
