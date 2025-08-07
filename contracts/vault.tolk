

struct Storage {
    factory: address,
    randomHash: uint256,
    amount: uint128,
    orderCode: cell,

}

struct ( 0x1) CreateOrder {

}

struct ( 0x2) VaultJettonTransfer {

}

struct ( 0x3) JettonTransferNotification {

}

struct ( 0x4) CloseOrder {

}

type AllowedMessage = CreateOrder | VaultJettonTransfer | JettonTransferNotification | CloseOrder

fun Storage.load() {
    return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}



fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {

}
