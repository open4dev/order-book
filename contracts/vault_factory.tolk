import "utils/fees"

const MAX_COMMISSION = 20;
const MAX_COMMISSION_MATCHER = 5;


struct ComissionInfo {
    comission_num: uint14
    comission_denom: uint14
}

struct VaultComissionInfo {
    comissionNum: uint14
    comissionDenom: uint14
    feeAmount: coins
}

struct CodesInfo {
    vaultCode: cell
    orderCode: cell
    matcherFeeCollectorCode: cell
}

struct Storage {
    owner: address,
    codesInfo: Cell<CodesInfo>,
    comissionInfo: Cell<ComissionInfo>
    comissionInfoMatcher: Cell<ComissionInfo>
    
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

struct ( 0x4e86ed8b ) ChangeCommission { // "ChangeCommission"c
    newCommissionInfo: Cell<ComissionInfo>
}

struct ( 0xdb3ac0d8 ) ChangeCommissionMatcher { // "ChangeCommissionMatcher"c
    newCommissionInfo: Cell<ComissionInfo>
}

struct ( 0x81e36595 ) InitVaultFactory { // "InitVaultFactory"c
}

struct ( 0xec9a92f6 ) WithDraw {
    vaultAddress: address
}

type AllowedMessage = CreateVault | ChangeOwner | ChangeCommission | ChangeCommissionMatcher | InitVaultFactory | WithDraw

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
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CREATE_VAULT + GAS_VAULT_INIT + GAS_STORAGE) throw 422;

            var comissionInfo = storage.comissionInfo.load();
            assert(mulDivRound(comissionInfo.comission_num, 100, comissionInfo.comission_denom) <= MAX_COMMISSION) throw 422;
            var comissionInfoMatcher = storage.comissionInfoMatcher.load();
            assert(mulDivRound(comissionInfoMatcher.comission_num, 100, comissionInfoMatcher.comission_denom) <= MAX_COMMISSION_MATCHER) throw 422;

            var codesInfo = storage.codesInfo.load();
            var autoDeployAddress = prepareInitVault(codesInfo.orderCode, codesInfo.vaultCode, codesInfo.matcherFeeCollectorCode, msg.jettonWalletCode, msg.fromJetton);
            

            var vaultComissionInfo = VaultComissionInfo {
                comissionNum: comissionInfo.comission_num,
                comissionDenom: comissionInfo.comission_denom,
                feeAmount: 0
            };

            var reply = createMessage({
                bounce: false,
                dest: autoDeployAddress,
                value: GAS_VAULT_INIT + GAS_STORAGE,
                body: beginCell()
                    .storeUint(0x2717c4a2, 32)
                    .storeRef(vaultComissionInfo.toCell())
                    .storeRef(storage.comissionInfoMatcher)
                .endCell()
                
            });
            reply.send(SEND_MODE_PAY_FEES_SEPARATELY);
            return;
        }
        ChangeOwner => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CHANGE_OWNER) throw 422;
            val newOwner = msg.newOwner;
            storage.owner = newOwner;
            storage.save();
        }
        ChangeCommission => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CHANGE_COMMISSION) throw 422;
            val newCommission = msg.newCommissionInfo.load();
            assert(mulDivRound(newCommission.comission_num, 100, newCommission.comission_denom) <= MAX_COMMISSION) throw 422;
            storage.comissionInfo = newCommission.toCell();
            storage.save();
        }
        ChangeCommissionMatcher => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_VAULT_FACTORY_CHANGE_COMMISSION) throw 422;
            val newCommission = msg.newCommissionInfo.load();
            assert(mulDivRound(newCommission.comission_num, 100, newCommission.comission_denom) <= MAX_COMMISSION_MATCHER) throw 422;
            storage.comissionInfoMatcher = newCommission.toCell();
            storage.save();
        }
        InitVaultFactory => {
            assert(in.valueCoins >= GAS_STORAGE) throw 422;
            return;
        }
        WithDraw => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_VAULT_FACTORY_WITHDRAW + GAS_VAULT_WITHDRAW + GAS_JETTON_WALLET_TRANSFER) throw 422;
            sendWithDraw(msg.vaultAddress, storage.owner);
            return;
        }
    }
}

fun sendWithDraw(vaultAddress: address, owner: address): void {
    var msgWithDraw = createMessage({
        bounce: false,
        dest: vaultAddress,
        value: GAS_VAULT_WITHDRAW + GAS_JETTON_WALLET_TRANSFER,
        body: beginCell()
            .storeUint(0xec9a92f6, 32)
            .storeAddress(owner)
            .endCell()
    });
    msgWithDraw.send(SEND_MODE_PAY_FEES_SEPARATELY);
}


fun prepareInitVault(
    orderCode: cell,
    vaultCode: cell,
    matcherFeeCollectorCode: cell,
    jettonWalletCode: cell?,
    fromJetton: cell?,
): AutoDeployAddress {

    val codesInfo = beginCell().storeMaybeRef(jettonWalletCode).storeRef(orderCode).storeRef(matcherFeeCollectorCode).endCell();

    val contractData = beginCell()
        .storeAddress(contract.getAddress())
        .storeRef(codesInfo)
        .storeMaybeRef(fromJetton)
        .storeUint(random.uint256(), 256)
        .storeUint(0, 128)
        .storeMaybeRef(null)
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