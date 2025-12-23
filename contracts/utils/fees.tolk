const GAS_STORAGE = ton("0.01")
const GAS_MIN_ORDER_STORAGE = ton("0.003")

const GAS_ORDER_FULL_MATCH = ton("1") // 1

const GAS_JETTON_WALLET_TRANSFER = ton("0.05") // 0.004957

const GAS_VAULT_FACTORY_CREATE_VAULT = ton("0.018176")        // max 0.018076 + 0.0001
const GAS_VAULT_FACTORY_INIT = ton("0.000526")                // max 0.000426 + 0.0001

const GAS_VAULT_JETTON_TRANSFER = ton("0.00883")             // max 0.00873 + 0.0001
const GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE = ton("0.003078")       // max 0.002978 + 0.0001
const GAS_VAULT_INIT = ton("0.000538")                       // max 0.000438 + 0.0001
const GAS_VAULT_TON_TRANSFER = ton("0.006886") // max 0.01159 + 0.0001

const GAS_VAULT_WITHDRAW = ton("0.004154")                   // max 0.004054 + 0.0001

const GAS_ORDER_CLOSE_ORDER = ton("0.002668")                 // max 0.002568 + 0.0001
const GAS_ORDER_INIT = ton("0.00186")                         // max 0.00176 + 0.0001
const GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE = ton("0.006884")  //      0.006784 + 0.0001

const GAS_FEE_COLLECTOR_WITHDRAW = ton("0.001695")            // max 0.001595 + 0.0001
const GAS_FEE_COLLECTOR_ADD_FEE = ton("0.000953")            // max 0.000753 + 0.0001
