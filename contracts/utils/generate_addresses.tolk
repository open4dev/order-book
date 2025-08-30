fun generateOrder(
    vault: address,
    orderOwner: address,
    fromJettonMinter: address,
    toJettonMinter: address,
    orderCode: cell,
    createdAt: uint32
) {
    var orderInitDataExchangeInfo: cell = beginCell()
        .storeAddress(fromJettonMinter)
        .storeAddress(toJettonMinter)
        .storeCoins(0) // amount
        .storeCoins(0) // priceRate
    .endCell();
    
    var orderInitData = beginCell()
        // .storeBool(false)
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