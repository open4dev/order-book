import "utils/fees"

struct CodesInfo {
    vaultCode: cell
    orderCode: cell
    feeCollectorCode: cell
}

struct Storage {
    owner: address,
    codesInfo: Cell<CodesInfo>,
}

@inline_ref
fun Storage.serialize(self): cell {
    return self.toCell();
}



fun Storage.changeOwner(mutate self, newOwner: address): void {
    self.owner = newOwner;
    return contract.setData(self.serialize());
}


struct JettonInfo {
    jettonMinter: address
}

struct ( 0x64e90480 ) CreateVault { // "CreateVault"c
    jettonWalletCode: cell?
    fromJetton: Cell<JettonInfo>?
}

struct ( 0xb6cf7f0f ) ChangeOwner { // "ChangeOwner"c
    newOwner: address,
}

struct ( 0x81e36595 ) InitVaultFactory { // "InitVaultFactory"c

}

type AllowedMessage = CreateVault | ChangeOwner | InitVaultFactory

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());


    
    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        CreateVault => {
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_VAULT_INIT + GAS_STORAGE) throw 422;

            reserveToncoinsOnBalance(0, 4);

            var codesInfo = storage.codesInfo.load();
            var autoDeployAddress = prepareInitVault(codesInfo.orderCode, codesInfo.vaultCode, codesInfo.feeCollectorCode, msg.jettonWalletCode, msg.fromJetton);
            
            var reply = createMessage({
                bounce: false,
                dest: autoDeployAddress,
                value: 0,
                body: beginCell()
                    .storeUint(0x2717c4a2, 32)
                .endCell()
            });
            reply.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            return;
        }
        ChangeOwner => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CHANGE_OWNER) throw 422;
            val newOwner = msg.newOwner;
            storage.owner = newOwner;
            storage.save();
        }
        InitVaultFactory => {
            assert(in.valueCoins >= GAS_STORAGE) throw 422;
            return;
        }
    }
}

fun prepareInitVault(
    orderCode: cell,
    vaultCode: cell,
    feeCollectorCode: cell,
    jettonWalletCode: cell?,
    fromJetton: cell?,
): AutoDeployAddress {

    val codesInfo = beginCell().storeMaybeRef(jettonWalletCode).storeRef(orderCode).storeRef(feeCollectorCode).endCell();

    val contractData = beginCell()
        .storeAddress(contract.getAddress())
        .storeRef(codesInfo)
        .storeMaybeRef(fromJetton)
        .storeUint(random.uint256(), 256)
        .storeCoins(0)
    .endCell();

    var autoDeployAddress = AutoDeployAddress{ 
        stateInit: {
            code: vaultCode,
            data: contractData
        }};

    return autoDeployAddress;
}


get fun getOwner(): address {
    var storage = lazy Storage.fromCell(contract.getData());
    return storage.owner;
}
