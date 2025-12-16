fun generateOrder(
    vault: address,
    orderOwner: address,
    fromJetton: cell?,
    toJetton: cell?,
    orderCode: cell,
    createdAt: uint32
) {
    var orderInitDataExchangeInfo: cell = beginCell()
        .storeMaybeRef(fromJetton)
        .storeMaybeRef(toJetton)
        .storeCoins(0) // amount
        .storeCoins(0) // priceRate
        .storeUint(0, 30) // slippage
    .endCell();
    
    var orderInitData = beginCell()
        .storeAddress(orderOwner)
        .storeAddress(vault)
        .storeMaybeRef(null)
        .storeRef(orderInitDataExchangeInfo)
        .storeUint(createdAt, 32)
    .endCell();

    var order = AutoDeployAddress {
        stateInit: {
            code: orderCode,
            data: orderInitData
        }
    };

    return order;
}

fun generateFeeCollector(vault: address, matcher: address, feeCollectorCode: cell): AutoDeployAddress {
    var feeCollectorData: cell = beginCell()
        .storeAddress(vault)
        .storeAddress(matcher)
        .storeCoins(0)
    .endCell();

    var feeCollector = AutoDeployAddress {
        stateInit: {
            code: feeCollectorCode,
            data: feeCollectorData
        }
    };

    return feeCollector;
}