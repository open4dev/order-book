// Message sending utilities
import "op_codes.tolk"
import "generate_addresses.tolk"

// Simple message without bounce
fun sendSimpleMessage(dest: address, value: coins, body: cell, sendMode: int) {
    var msg = createMessage({
        bounce: BounceMode.NoBounce,
        dest: dest,
        value: value,
        body: body
    });
    msg.send(sendMode);
}

// Simple message to AutoDeployAddress (for contract creation)
fun sendSimpleMessageToAutoDeploy(dest: AutoDeployAddress, value: coins, body: cell, sendMode: int) {
    var msg = createMessage({
        bounce: BounceMode.NoBounce,
        dest: dest,
        value: value,
        body: body
    });
    msg.send(sendMode);
}

// Message with rich bounce (for recoverable operations)
fun sendBouncedMessage(dest: address, value: coins, body: cell, sendMode: int) {
    var msg = createMessage({
        bounce: BounceMode.RichBounce,
        dest: dest,
        value: value,
        body: body
    });
    msg.send(sendMode);
}

// Jetton transfer helper
fun sendJettonTransfer(
    queryId: uint64,
    fromJettonWallet: AutoDeployAddress,
    jettonAmount: coins,
    to: address,
    responseDestination: address,
    value: coins,
    sendMode: int
) {
    var msgSendTokens = createMessage({
        bounce: BounceMode.NoBounce,
        dest: fromJettonWallet,
        value: value,
        body: beginCell()
            .storeUint(OP_CODE_JETTON_TRANSFER, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(to)
            .storeAddress(responseDestination)
            .storeUint(0, 2)
            .storeCoins(0)
            .storeUint(0, 1)
    });
    msgSendTokens.send(sendMode);
}

// Send fee to fee collector
fun sendFeeToCollector(
    vault: address,
    recipient: address,
    amount: coins,
    feeCollectorCode: cell,
    value: coins,
    sendMode: int
) {
    var feeCollector: AutoDeployAddress = generateFeeCollector(vault, recipient, feeCollectorCode);
    var msg = createMessage({
        bounce: BounceMode.NoBounce,
        dest: feeCollector,
        value: value,
        body: beginCell()
            .storeUint(OP_CODE_ADD_FEE, 32)
            .storeCoins(amount)
        .endCell()
    });
    msg.send(sendMode);
}

// Send fee to provider (uses same fee collector contract)
fun sendFeeToProvider(
    vault: address,
    provider: address,
    amount: coins,
    feeCollectorCode: cell,
    value: coins,
    sendMode: int
) {
    sendFeeToCollector(vault, provider, amount, feeCollectorCode, value, sendMode);
}