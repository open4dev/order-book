import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultFactoryConfig = {
    vaultCode: Cell;
    orderCode: Cell;
    feeCollectorCode: Cell;
};

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
    return beginCell()
        .storeRef(config.vaultCode)
        .storeRef(config.orderCode)
        .storeRef(config.feeCollectorCode)
    .endCell()
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

    async getOwner(provider: ContractProvider) {
        const { stack } = await provider.get('getOwner', []);
        return stack.readAddress();
    }

    async getCommission(provider: ContractProvider) {
        const { stack } = await provider.get('getCommission', []);
        return {
            comission_num: stack.readNumber(),
            comission_denom: stack.readNumber(),
            comission_num_matcher: stack.readNumber(),
            comission_denom_matcher: stack.readNumber(),
        };
    }
}
