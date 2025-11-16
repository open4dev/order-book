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

fun generateMatcherFeeCollector(vault: address, matcher: address, matcherFeeCollectorCode: cell): AutoDeployAddress {
    var matcherFeeCollectorData: cell = beginCell()
        .storeAddress(vault)
        .storeAddress(matcher)
        .storeCoins(0)
    .endCell();

    var matcherFeeCollector = AutoDeployAddress {
        stateInit: {
            code: matcherFeeCollectorCode,
            data: matcherFeeCollectorData
        }
    };

    return matcherFeeCollector;
}