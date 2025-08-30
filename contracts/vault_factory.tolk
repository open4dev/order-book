const MAX_COMMISSION = 20;

struct ComissionInfo {
    comission_num: uint14
    comission_denom: uint14
}

struct VaultComissionInfo {
    comissionNum: uint14
    comissionDenom: uint14
    feeAmount: coins
}


struct Storage {
    owner: address,
    vaultCode1: cell,
    vaultCode2: cell,
    orderCode: cell,
    comissionInfo: Cell<ComissionInfo>
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

fun Storage.changeComission(mutate self, newComissionInfo: ComissionInfo): void {
    self.comissionInfo = newComissionInfo.toCell();
    return contract.setData(self.serialize());
}


struct ( 0x64e90480 ) CreateVault { // "CreateVault"c
    jettonWalletCode: cell
    version: uint1
    jettonMaster: address
}

struct ( 0xb6cf7f0f ) ChangeOwner { // "ChangeOwner"c
    newOwner: address,
}

struct ( 0x4e86ed8b ) ChangeCommission { // "ChangeCommission"c
    newCommissionInfo: Cell<ComissionInfo>
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
            var vaultCode = msg.version == 0 ? storage.vaultCode1 : storage.vaultCode2;
            var autoDeployAddress = prepareInitVault(storage.orderCode, vaultCode, msg.jettonWalletCode, msg.jettonMaster);
            

            var comissionInfo = storage.comissionInfo!.load();
            var vaultComissionInfo = VaultComissionInfo {
                comissionNum: comissionInfo.comission_num,
                comissionDenom: comissionInfo.comission_denom,
                feeAmount: 0
            };

            var reply = createMessage({
                bounce: false,
                dest: autoDeployAddress,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0x2717c4a2, 32)
                    .storeRef(vaultComissionInfo.toCell())
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
            val newCommission = msg.newCommissionInfo.load();
            storage.changeComission(newCommission);
        }
        InitVaultFactory => {
            return;
        }
    }
}


fun prepareInitVault(
    orderCode: cell,
    vaultCode: cell,
    jettonWalletCode: cell,
    jettonMaster: address,
): AutoDeployAddress {
    val contractData = beginCell()
        .storeAddress(contract.getAddress())
        .storeRef(jettonWalletCode)
        .storeAddress(jettonMaster)
        .storeUint(random.uint256(), 256)
        .storeUint(0, 128)
        .storeRef(orderCode)
        .storeMaybeRef(null)
    .endCell();

    var autoDeployAddress = AutoDeployAddress{ 
        stateInit: {
            code: vaultCode,
            data: contractData
        }};

    return autoDeployAddress;
}


get fun getOwner(): address {
    var storage = Storage.parse(contract.getData());
    return storage.owner;
}

get fun getCommission(): (uint14, uint14) {
    var storage = Storage.parse(contract.getData());
    var comissionInfo = storage.comissionInfo.load();
    return (comissionInfo.comission_num, comissionInfo.comission_denom);
}