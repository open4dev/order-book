import { Address, beginCell, Cell } from '@ton/core';

// ==================== Opcodes ====================

export const Opcodes = {
    // Vault operations
    InitVault: 0x2717c4a2,
    TonTransfer: 0xcbcd047e,
    JettonTransferNotification: 0x7362d09c,
    VaultJettonTransfer: 0x12966c79,
    CloseOrderToVault: 0xa597947e,
    VaultWithDraw: 0xee83652a,

    // Order operations
    InitOrder: 0x2d0e1e1b,
    MatchOrder: 0x47ff7e25,
    InternalMatchOrder: 0xdfe29f63,
    SuccessMatch: 0x55feb42a,
    CloseOrder: 0x52e80bac,

    // VaultFactory operations
    CreateVault: 0x64e90480,
    InitVaultFactory: 0x81e36595,
    ChangeOwner: 0xb6cf7f0f,

    // FeeCollector operations
    AddFee: 0xfc7532f4,
    FeeCollectorWithDraw: 0xec9a92f6,

    // Jetton operations
    JettonTransfer: 0xf8a7ea5,
} as const;

// ==================== Shared Types ====================

export type JettonInfo = {
    jettonMinter: Address;
};

export type CodesInfo = {
    jettonWalletCode: Cell | undefined;
    orderCode: Cell;
    feeCollectorCode: Cell;
};

export type FeeInfo = {
    provider: Address;
    feeNum: number;
    feeDenom: number;
    matcherFeeNum: number;
    matcherFeeDenom: number;
};

export type VaultConfig = {
    vaultFactory: Address;
    codesInfo: CodesInfo;
    fromJetton: JettonInfo | undefined;
    randomHash: bigint;
    amount: bigint;
};

export type CreateOrderParams = {
    amount: bigint;
    priceRate: bigint;
    slippage: bigint;
    toJettonMinter: Address;
    providerFee: Address;
    feeNum: number;
    feeDenom: number;
    matcherFeeNum: number;
    matcherFeeDenom: number;
};

// ==================== Shared Cell Builders ====================

export function vaultConfigToCell(config: VaultConfig): Cell {
    return beginCell()
        .storeAddress(config.vaultFactory)
        .storeRef(
            beginCell()
                .storeMaybeRef(config.codesInfo.jettonWalletCode ?? undefined)
                .storeRef(config.codesInfo.orderCode)
                .storeRef(config.codesInfo.feeCollectorCode)
            .endCell()
        )
        .storeMaybeRef(config.fromJetton ? beginCell().storeAddress(config.fromJetton.jettonMinter).endCell() : undefined)
        .storeUint(config.randomHash, 256)
        .storeCoins(config.amount)
        .endCell();
}

export function buildTonTransferBody(params: CreateOrderParams): Cell {
    return beginCell()
        .storeUint(Opcodes.TonTransfer, 32)
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
        .endCell();
}

export function buildInitVaultBody(): Cell {
    return beginCell()
        .storeUint(Opcodes.InitVault, 32)
        .endCell();
}

export function buildFeeInfoCell(feeInfo: FeeInfo): Cell {
    return beginCell()
        .storeAddress(feeInfo.provider)
        .storeUint(feeInfo.feeNum, 14)
        .storeUint(feeInfo.feeDenom, 14)
        .storeUint(feeInfo.matcherFeeNum, 14)
        .storeUint(feeInfo.matcherFeeDenom, 14)
        .endCell();
}

// ==================== Order Types ====================

export type ExchangeInfo = {
    from: JettonInfo | null;
    to: JettonInfo | null;
    amount: bigint;
    priceRate: bigint;
    slippage: bigint;
};

export type OrderFeeInfo = {
    provider: Address;
    feeNum: bigint;
    feeDenom: bigint;
    matcherFeeNum: bigint;
    matcherFeeDenom: bigint;
};

export type OrderConfig = {
    owner: Address;
    vault: Address;
    feeInfo: OrderFeeInfo | null;
    exchangeInfo: ExchangeInfo;
    createdAt: bigint;
};

export type MatchOrderParams = {
    anotherVault: Address;
    anotherOrderOwner: Address;
    createdAt: number;
    amount: bigint;
};

export type InitOrderParams = {
    amount: bigint;
    priceRate: bigint;
    slippage: bigint;
    feeInfo: OrderFeeInfo;
};

// ==================== Order Cell Builders ====================

export function orderConfigToCell(config: OrderConfig): Cell {
    const fromJettonInfoCell = config.exchangeInfo.from
        ? beginCell().storeAddress(config.exchangeInfo.from.jettonMinter).endCell()
        : null;
    const toJettonInfoCell = config.exchangeInfo.to
        ? beginCell().storeAddress(config.exchangeInfo.to.jettonMinter).endCell()
        : null;

    const exchangeInfoCell = beginCell()
        .storeMaybeRef(fromJettonInfoCell)
        .storeMaybeRef(toJettonInfoCell)
        .storeCoins(config.exchangeInfo.amount)
        .storeCoins(config.exchangeInfo.priceRate)
        .storeUint(config.exchangeInfo.slippage, 30)
        .endCell();

    const feeInfoCell = config.feeInfo
        ? beginCell()
            .storeAddress(config.feeInfo.provider)
            .storeUint(config.feeInfo.feeNum, 14)
            .storeUint(config.feeInfo.feeDenom, 14)
            .storeUint(config.feeInfo.matcherFeeNum, 14)
            .storeUint(config.feeInfo.matcherFeeDenom, 14)
            .endCell()
        : null;

    return beginCell()
        .storeAddress(config.owner)
        .storeAddress(config.vault)
        .storeMaybeRef(feeInfoCell)
        .storeRef(exchangeInfoCell)
        .storeUint(config.createdAt, 32)
        .endCell();
}

export function buildInitOrderBody(params: InitOrderParams): Cell {
    return beginCell()
        .storeUint(Opcodes.InitOrder, 32)
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
        .endCell();
}

export function buildMatchOrderBody(params: MatchOrderParams): Cell {
    return beginCell()
        .storeUint(Opcodes.MatchOrder, 32)
        .storeAddress(params.anotherVault)
        .storeAddress(params.anotherOrderOwner)
        .storeUint(params.createdAt, 32)
        .storeCoins(params.amount)
        .endCell();
}

export function buildCloseOrderBody(): Cell {
    return beginCell()
        .storeUint(Opcodes.CloseOrder, 32)
        .endCell();
}

// ==================== VaultFactory Types ====================

export type VaultFactoryConfig = {
    vaultCode: Cell;
    orderCode: Cell;
    feeCollectorCode: Cell;
};

// ==================== VaultFactory Cell Builders ====================

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
    return beginCell()
        .storeRef(config.vaultCode)
        .storeRef(config.orderCode)
        .storeRef(config.feeCollectorCode)
        .endCell();
}

export function buildInitVaultFactoryBody(): Cell {
    return beginCell()
        .storeUint(Opcodes.InitVaultFactory, 32)
        .endCell();
}

export function buildCreateVaultBody(jettonWalletCode: Cell | null, jettonMaster: Address | null): Cell {
    return beginCell()
        .storeUint(Opcodes.CreateVault, 32)
        .storeMaybeRef(jettonWalletCode ? jettonWalletCode : null)
        .storeMaybeRef(jettonMaster ? beginCell().storeAddress(jettonMaster).endCell() : null)
        .endCell();
}
