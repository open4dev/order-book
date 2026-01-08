import "utils/fees"
import "utils/errors.tolk"
import "utils/op_codes.tolk"

struct Storage {
    vault: address
    owner: address
    amount: coins
}

fun Storage.save(mutate self) {
    contract.setData(self.toCell())
}

struct (0xec9a92f6) WithDraw {}

struct (0xfc7532f4) AddFee {
    amount: coins
}

type AllowedMessage = WithDraw | AddFee


fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        WithDraw => {
            assert(in.valueCoins >= GAS_FEE_COLLECTOR_WITHDRAW + GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
            assert(in.senderAddress == storage.owner) throw ERR_INVALID_SENDER; // Check if the sender is the owner

            var msg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: storage.vault,
                value: 0,
                body: beginCell()
                    .storeUint(OP_CODE_VAULT_WITHDRAW, 32)
                    .storeAddress(storage.owner)
                    .storeCoins(storage.amount)
                .endCell()
            });

            msg.send(SEND_MODE_CARRY_ALL_BALANCE);

            storage.amount = 0;
            storage.save();
            return;
        }
        AddFee => {
            assert(in.valueCoins >= GAS_FEE_COLLECTOR_ADD_FEE) throw ERR_INSUFFICIENT_GAS;
            assert(in.senderAddress == storage.vault) throw ERR_INVALID_SENDER; // Check if the sender is the owner
            storage.amount += msg.amount;
            storage.save();
            return;
        }
    }
}

get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());
    return (storage.vault, storage.owner, storage.amount);
}