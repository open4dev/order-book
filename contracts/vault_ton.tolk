import "utils/generate_addresses.tolk"
import "utils/fees.tolk"
import "utils/errors.tolk"
import "utils/op_codes.tolk"
import "utils/types.tolk"
import "utils/messages.tolk"
import "utils/fee_calc.tolk"

struct CodesInfo {
    jettonWalletCode: cell?
    orderCode: cell
    feeCollectorCode: cell
}

struct Storage {
    vault_factory: address
    codesInfo: Cell<CodesInfo>
    fromJetton: cell?
    randomHash: uint256
    amount: coins
}

struct ToJettonInfo {
    jettonMinter: address
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    addresses: Cell<TransferAddresses>
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
    feeInfo: Cell<FeeInfo>
}

struct ( 0x2717c4a2 ) InitVault {
    creator: address
}

struct ( 0xcbcd047e ) TonTransfer {
    amount: coins,
    toJetton: Cell<ToJettonInfo>
    priceRate: coins
    slippage: uint30
    feeInfo: Cell<FeeInfo>
    createdAt: uint32
}

struct (0xee83652a) WithDraw {
    feeAddress: address
    amount: coins
}

struct ( 0xa597947e ) CloseOrder {
    orderOwner: address
    toJetton: Cell<ToJettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun Storage.sendCreateOrder(mutate self, toJetton: cell, owner: address, amount: coins, priceRate: coins, slippage: uint30, feeInfo: Cell<FeeInfo>, value: coins, createdAt: uint32, sendMode: int) {
    var order: AutoDeployAddress = generateOrder(
        contract.getAddress(),
        owner,
        null,
        toJetton,
        self.codesInfo.load().orderCode,
        createdAt
    );

    var body = beginCell()
        .storeUint(OP_CODE_INIT_ORDER, 32)
        .storeCoins(amount)
        .storeCoins(priceRate)
        .storeUint(slippage, 30)
        .storeRef(feeInfo)
    .endCell();

    sendSimpleMessageToAutoDeploy(order, value, body, sendMode);
}

type AllowedMessage = VaultJettonTransfer | InitVault | TonTransfer | WithDraw | CloseOrder

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        VaultJettonTransfer => {
            val feeInfo = msg.feeInfo.load();
            val fees = calculateFees(msg.amountTransfer, feeInfo);
            reserveToncoinsOnBalance(storage.amount - fees.transferAmount + GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            val codesInfo = storage.codesInfo.load();
            var addresses = msg.addresses.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                addresses.orderOwner,
                null,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            var bodyRevertToMatcher = beginCell()
                .storeUint(OP_CODE_WITHDRAW_REVERT, 32)
            .endCell();

            var bodySwap = beginCell()
                .storeUint(OP_CODE_SWAP, 32)
            .endCell();

            
            if (fees.matcherFee > 0) {
                sendFeeToCollector(contract.getAddress(), addresses.matcher, fees.matcherFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
            }
            if (fees.providerFee > 0) {
                sendFeeToProvider(contract.getAddress(), feeInfo.provider, fees.providerFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
            }
            
            sendSimpleMessage(addresses.counterparty, fees.transferAmount, bodySwap, SEND_MODE_PAY_FEES_SEPARATELY);
            sendSimpleMessage(addresses.matcher, 0, bodyRevertToMatcher, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount -= fees.transferAmount;
            storage.save();
        }
        CloseOrder => {
            reserveToncoinsOnBalance(storage.amount - msg.amountTransfer + GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            val codesInfo = storage.codesInfo.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                msg.orderOwner,
                null,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            var body = beginCell().storeUint(OP_CODE_SWAP, 32).endCell();
            sendSimpleMessage(msg.orderOwner, msg.amountTransfer, body, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount -= msg.amountTransfer;
            storage.save();
        }
        TonTransfer => {
            assert(in.valueCoins >= msg.amount + GAS_VAULT_TON_TRANSFER) throw ERR_INSUFFICIENT_GAS;
            reserveToncoinsOnBalance(storage.amount + msg.amount + GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            storage.sendCreateOrder(msg.toJetton, in.senderAddress, msg.amount, msg.priceRate, msg.slippage, msg.feeInfo, 0, msg.createdAt, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount += msg.amount;
            storage.save();
        }
        InitVault => {
            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
            val body = generateBodyWithComment("Vault Initialized");
            sendSimpleMessage(msg.creator, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
        }
        WithDraw => {
            reserveToncoinsOnBalance(storage.amount - msg.amount + GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            val codesInfo = storage.codesInfo.load();
            var feeCollector = generateFeeCollector(contract.getAddress(), msg.feeAddress, codesInfo.feeCollectorCode);
            assert(feeCollector.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            val body = beginCell()
                .storeUint(OP_CODE_VAULT_WITHDRAW_TON, 32)
            .endCell();
            sendSimpleMessage(msg.feeAddress, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount -= msg.amount;
            storage.save();
        }
    }
}

get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());

    return (storage.randomHash, storage.vault_factory, storage.amount)
}

get fun getCodes() {
    var storage = lazy Storage.fromCell(contract.getData());
    val codesInfo = storage.codesInfo.load();

    return (codesInfo.orderCode, codesInfo.feeCollectorCode)
}
