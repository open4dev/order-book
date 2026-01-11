import { Address, Cell, toNano } from '@ton/core';

// ==================== Gas Constants ====================

export const Gas = {
    // VaultFactory
    VAULT_FACTORY_DEPLOY: toNano('0.010526'),
    CREATE_VAULT: toNano('0.028714'), // 0.018176 + 0.000538 + 0.01

    // Vault
    VAULT_DEPLOY: toNano('0.05'),

    // Order creation (from jetton wallet)
    CREATE_ORDER_JETTON: toNano('0.172422'), // 0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278
    FORWARD_TON_AMOUNT: toNano('0.023122'), // 0.01 + 0.00206 + 0.007084 + 0.003278

    // Order creation (TON transfer)
    CREATE_ORDER_TON_GAS: toNano('0.027746'), // 0.01 + 0.00186 + 0.006886 + 0.009

    // Order operations
    MATCH_ORDER: toNano('1'),
    CLOSE_ORDER: toNano('0.15'),

    // Fee collector
    FEE_COLLECTOR_WITHDRAW: toNano('0.1'),
} as const;

// ==================== Default Fee Settings ====================

export const DefaultFees = {
    feeNum: 1,
    feeDenom: 1000,
    matcherFeeNum: 1,
    matcherFeeDenom: 1000,
} as const;

// ==================== Known Jetton Wallet Codes ====================

// Raw stateInit format for NOT, BUILD, USDT tokens
export const JettonWalletCodes = {
    // EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT
    NOT: Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395"),

    // EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD
    BUILD: Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395"),

    // USDT: 0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe
    USDT: Cell.fromHex("b5ee9c72010101010023000842028f452d7a4dfd74066b682365177259ed05734435be76b5fd4bd5d8af2b7c3d68"),

    // ANON: EQDv-yr41_CZ2urg2gfegVfa44PDPjIK9F-MilEDKDUIhlwZ
    ANON: Cell.fromHex("b5ee9c7201021101000323000114ff00f4a413f4bcf2c80b0102016202030202cc0405001ba0f605da89a1f401f481f481a8610201d40607020120080900c30831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc2000113e910c1c2ebcb853600201200a0b0083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa401f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80c0201200d0e009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5402f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600f1000d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed54"),
} as const;

// ==================== Known Jetton Minters (Mainnet) ====================

export const JettonMinters = {
    NOT: Address.parse("EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT"),
    BUILD: Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD"),
    USDT: Address.parse("0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe"),
    ANON: Address.parse("EQDv-yr41_CZ2urg2gfegVfa44PDPjIK9F-MilEDKDUIhlwZ"),
} as const;

// ==================== Helper Functions ====================

export function calculateCreateOrderGas(amount: bigint): bigint {
    return amount + Gas.CREATE_ORDER_TON_GAS;
}

export function getDefaultSlippage(): bigint {
    return toNano('0.02'); // 2%
}
