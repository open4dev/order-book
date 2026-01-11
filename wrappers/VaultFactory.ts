import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import {
    VaultFactoryConfig,
    vaultFactoryConfigToCell,
    buildInitVaultFactoryBody,
    buildCreateVaultBody,
    Opcodes,
} from './common';

// Re-export types for backwards compatibility
export { VaultFactoryConfig } from './common';

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
            body: buildInitVaultFactoryBody(),
        });
    }

    async sendCreateVault(provider: ContractProvider, via: Sender, value: bigint, jettonWalletCode: Cell | null, jettonMaster: Address | null) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildCreateVaultBody(jettonWalletCode, jettonMaster),
        });
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, value: bigint, newOwner: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.ChangeOwner, 32)
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
