struct Storage {
    owner: address,
    vaultCode: cell,
    orderCode: cell,
    commission: uint14
}

@inline_ref
fun Storage.serialize(self): cell {
    return self.toCell();
}