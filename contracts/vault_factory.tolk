const MAX_COMMISSION = 20;


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

@inline
fun Storage.parse(c: cell): Storage {
    return Storage.fromCell(c);
}



fun Storage.changeOwner(mutate self, newOwner: address): void {
    self.owner = newOwner;
    return contract.setData(self.serialize());
}

fun Storage.changeComission(mutate self, newComission: int): void {
    self.commission = newComission;
    return contract.setData(self.serialize());
}


struct ( 0x64e90480 ) CreateVault { // "CreateVault"c
    test: uint32,
}

struct ( 0xb6cf7f0f ) ChangeOwner { // "ChangeOwner"c
    newOwner: address,
}

struct ( 0x4e86ed8b ) ChangeCommission { // "ChangeCommission"c
    newCommission: uint14,
}

struct ( 0x81e36595 ) InitVaultFactory { // "InitVaultFactory"c
}

type AllowedMessage = CreateVault | ChangeOwner | ChangeCommission | InitVaultFactory

fun Storage.load() {
    return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun onInternalMessage(in: InMessage) {
    var storage = Storage.parse(contract.getData());

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        CreateVault => {
            var (vaultAddress, vaultInitData) = prepareInitVault(storage.orderCode);
            var reply = createMessage({
                bounce: false,
                dest: vaultAddress,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0, 32)
                    .storeUint(0, 128)
                    .storeRef(vaultInitData)
                .endCell()
            });
            reply.send(SEND_MODE_REGULAR);
            return;
        }
        ChangeOwner => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            val newOwner = msg.newOwner;
            storage.changeOwner(newOwner);
        }
        ChangeCommission => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            val newCommission = msg.newCommission;
            assert(newCommission >= 0 && newCommission <= 20) throw 422; // Check if the commission is valid
            storage.changeComission(newCommission);
        }
        InitVaultFactory => {
            return;
        }
    }
}


fun prepareInitVault(
    orderCode: cell,
): (address, cell) {
    val contractData = beginCell()
        .storeAddress(contract.getAddress())
        .storeUint(random.uint256(), 256)
        .storeUint(0, 128)
        .storeRef(orderCode)
    .endCell();

    var vaultInitData = beginCell()
        .storeUint(0, 2)
        .storeRef(orderCode)
        .storeRef(contractData)
        .storeUint(0, 1)
    .endCell();

    var vaultAddress = 
    beginCell()
        .storeUint(4, 3)
        .storeInt(BASECHAIN, 8)
        .storeUint(vaultInitData.hash(), 256)
    .endCell().beginParse().loadAddress();

    return (vaultAddress, vaultInitData);
}


get fun getOwner(): address {
    var storage = Storage.parse(contract.getData());
    return storage.owner;
}

get fun getCommission(): uint14 {
    var storage = Storage.parse(contract.getData());
    return storage.commission;
}