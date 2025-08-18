fun generateOrderAddress(
    vault: address,
    orderOwner: address,
    fromJettonMinter: address,
    toJettonMinter: address,
    fromAmount: coins,
    toAmount: coins,
    orderCode: cell
) {
    var orderInitDataExchangeInfo: cell = beginCell()
        .storeAddress(fromJettonMinter)
        .storeAddress(toJettonMinter)
        .storeCoins(fromAmount)
        .storeCoins(toAmount)
    .endCell();
    
    var orderInitData = beginCell()
        .storeAddress(orderOwner)
        .storeAddress(vault)
        .storeRef(orderInitDataExchangeInfo)
    .endCell();

    var orderStateInitCell = beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(orderCode)
        .storeMaybeRef(orderInitData)
        .storeUint(0, 1)
    .endCell();

    var orderAddress = beginCell()
        .storeUint(4, 3)
        .storeInt(BASECHAIN, 8)
        .storeUint(orderStateInitCell.hash(), 256)
    .endCell()
    .beginParse()
    .loadAddress();

    return orderAddress;
}