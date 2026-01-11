// Shared type definitions used across contracts

struct JettonInfo {
    jettonMinter: address
}

struct FeeInfo {
    provider: address
    feeNum: uint14
    feeDenom: uint14
    matcherFeeNum: uint14
    matcherFeeDenom: uint14
}

struct TransferAddresses {
    orderOwner: address
    matcher: address
    counterparty: address
}
