// Fee calculation utilities
import "types.tolk"

struct FeeResult {
    transferAmount: coins
    providerFee: coins
    matcherFee: coins
}

fun calculateFees(amount: coins, feeInfo: FeeInfo): FeeResult {
    var providerFee: coins = 0;
    var matcherFee: coins = 0;

    if ((feeInfo.feeNum > 0) && (feeInfo.feeDenom > 0)) {
        providerFee = mulDivFloor(amount, feeInfo.feeNum, feeInfo.feeDenom);
    }
    if ((feeInfo.matcherFeeNum > 0) && (feeInfo.matcherFeeDenom > 0)) {
        matcherFee = mulDivFloor(amount, feeInfo.matcherFeeNum, feeInfo.matcherFeeDenom);
    }

    return FeeResult {
        transferAmount: amount - providerFee - matcherFee,
        providerFee: providerFee,
        matcherFee: matcherFee
    };
}

fun addFeesToRate(rate: coins, feeInfo: FeeInfo): coins {
    return rate
        + mulDivFloor(rate, feeInfo.feeNum, feeInfo.feeDenom)
        + mulDivFloor(rate, feeInfo.matcherFeeNum, feeInfo.matcherFeeDenom);
}