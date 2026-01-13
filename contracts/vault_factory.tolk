import "utils/fees.tolk"
import "utils/errors.tolk"
import "utils/op_codes.tolk"
import "utils/types.tolk"
import "utils/messages.tolk"

struct Storage {
    vaultCode: cell
    orderCode: cell
    feeCollectorCode: cell
}

struct ( 0x64e90480 ) CreateVault { // "CreateVault"c
    randomHash: uint256,
    jettonWalletCode: cell?
    fromJetton: Cell<JettonInfo>?
}

struct ( 0x81e36595 ) InitVaultFactory { // "InitVaultFactory"c

}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun prepareInitVault(
    randomHash: uint256,
    orderCode: cell,
    vaultCode: cell,
    feeCollectorCode: cell,
    jettonWalletCode: cell?,
    fromJetton: cell?,
): AutoDeployAddress {

    var codesInfo = beginCell()
        .storeMaybeRef(jettonWalletCode)
        .storeRef(orderCode)
        .storeRef(feeCollectorCode)
    .endCell();

    var contractData = beginCell()
        .storeAddress(contract.getAddress())
        .storeRef(codesInfo)
        .storeMaybeRef(fromJetton)
        .storeUint(randomHash, 256)
        .storeCoins(0)
    .endCell();

    var autoDeployAddress = AutoDeployAddress{ 
        stateInit: {
            code: vaultCode,
            data: contractData
        }};

    return autoDeployAddress;
}

type AllowedMessage = CreateVault | InitVaultFactory

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());
    
    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        CreateVault => {
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            var autoDeployAddress = prepareInitVault(msg.randomHash, storage.orderCode, storage.vaultCode, storage.feeCollectorCode, msg.jettonWalletCode, msg.fromJetton);
            
            var body = beginCell()
                .storeUint(OP_CODE_VAULT_INIT, 32)
                .storeAddress(in.senderAddress)
            .endCell();
            sendSimpleMessageToAutoDeploy(autoDeployAddress, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
        }
        InitVaultFactory => {
            assert(in.valueCoins >= GAS_VAULT_FACTORY_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            val body = generateBodyWithComment("Vault Factory Initialized");
            sendSimpleMessage(in.senderAddress, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
        }
    }
}

get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());

    return (storage.vaultCode, storage.orderCode, storage.feeCollectorCode);
}
