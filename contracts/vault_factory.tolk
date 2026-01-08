import "utils/fees"
import "utils/errors.tolk"
import "utils/op_codes.tolk"

struct Storage {
    vaultCode: cell
    orderCode: cell
    feeCollectorCode: cell
}


struct JettonInfo {
    jettonMinter: address
}

struct ( 0x64e90480 ) CreateVault { // "CreateVault"c
    jettonWalletCode: cell?
    fromJetton: Cell<JettonInfo>?
}

struct ( 0x81e36595 ) InitVaultFactory { // "InitVaultFactory"c

}

type AllowedMessage = CreateVault | InitVaultFactory

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());
    
    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        CreateVault => {
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_VAULT_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            var autoDeployAddress = prepareInitVault(storage.orderCode, storage.vaultCode, storage.feeCollectorCode, msg.jettonWalletCode, msg.fromJetton);
            
            var reply = createMessage({
                bounce: BounceMode.NoBounce,
                dest: autoDeployAddress,
                value: 0,
                body: beginCell()
                    .storeUint(OP_CODE_VAULT_INIT, 32)
                .endCell()
            });
            reply.send(SEND_MODE_CARRY_ALL_BALANCE);
            return;
        }
        InitVaultFactory => {
            assert(in.valueCoins >= GAS_VAULT_FACTORY_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
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


get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());

    return (storage.vaultCode, storage.orderCode, storage.feeCollectorCode);
}