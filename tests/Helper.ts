import { Address, toNano } from "@ton/core";
import { Blockchain, SendMessageResult } from "@ton/sandbox";
import { flattenTransaction } from "@ton/test-utils";
import { JettonWallet } from "../wrappers/JettonWallet";
import { Vault } from "../wrappers/Vault";
import { VaultTon } from "../wrappers/VaultTon";
import { FeeCollector } from "../wrappers/MatcherFeeCollector";
import { Order } from "../wrappers/Order";
import { printTransactionFees } from "@ton/sandbox";






// Gas constants from fees.tolk
export const GAS_STORAGE = toNano("0.01");
export const GAS_MIN_ORDER_STORAGE = toNano("0.003");

export const GAS_ORDER_FULL_MATCH = toNano("1"); // 1

export const GAS_JETTON_WALLET_TRANSFER = toNano("0.05"); // 0.004957

export const GAS_VAULT_FACTORY_CREATE_VAULT = toNano("0.018176");        // max 0.018076 + 0.0001
export const GAS_VAULT_FACTORY_INIT = toNano("0.000526");                // max 0.000426 + 0.0001

export const GAS_VAULT_JETTON_TRANSFER = toNano("0.01883");             // max 0.00873 + 0.0001
export const GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE = toNano("0.003078");       // max 0.002978 + 0.0001
export const GAS_VAULT_INIT = toNano("0.000538");                       // max 0.000438 + 0.0001
export const GAS_VAULT_TON_TRANSFER = toNano("0.016886"); // max 0.01159 + 0.0001

export const GAS_VAULT_WITHDRAW = toNano("0.004154");                   // max 0.004054 + 0.0001

export const GAS_VAULT_CLOSE_ORDER = toNano("0.024676");                 // max 0.004576 + 0.0001
export const GAS_ORDER_CLOSE_ORDER = toNano("0.002403"); // max 0.002303 + 0.0001
export const GAS_ORDER_INIT = toNano("0.04");                         // max 0.00176 + 0.0001
export const GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE = toNano("0.006884");  //      0.006784 + 0.0001

export const GAS_FEE_COLLECTOR_WITHDRAW = toNano("0.001695");            // max 0.001595 + 0.0001
export const GAS_FEE_COLLECTOR_ADD_FEE = toNano("0.000953");            // max 0.000753 + 0.0001
// end of gas constants from fees.tolk

export const GAS_CREATE_ORDER_JETTON = GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE;
export const GAS_CREATE_ORDER_TON = GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER;





export function printBlockchainConfig(blockchain: Blockchain) {
    const config = blockchain.config;
    const configBase64 = blockchain.configBase64;
    console.log('\n=== Blockchain Config ===');
    console.log('Config (Base64):', configBase64);
    console.log('Config (Cell hash):', config.hash().toString('base64'));
    console.log('');
}


export const mapOpcode = (op: number): string | null => {
    switch (op) {
        case 0x178d4519:
            return 'JettonWalletInternalTransfer';
        case 0x2717c4a2:
            return 'VaultInit';
        case 0x2d0e1e1b:
            return 'OrderInit';
        case 0xfc7532f4:
            return 'FeeCollectorAddFee';
        case 0xec9a92f6:
            return 'FeeCollectorWithDraw';
        case 0x47ff7e25:
            return 'OrderMatchOrder';
        case 0xdfe29f63:
            return 'OrderInternalMatchOrder';
        case 0x52e80bac:
            return 'OrderCloseOrder';
        case 0x55feb42a:
            return 'OrderSuccessMatch';
        case 0x64e90480:
            return 'VaultFactoryCreateVault';
        case 0xb6cf7f0f:
            return 'VaultFactoryChangeOwner';
        case 0x81e36595:
            return 'VaultFactoryInit';
        case 0x12966c79:
            return 'VaultJettonTransfer';
        case 0xa597947e:
            return 'VaultCloseOrder';
        case 0x7362d09c:
            return 'VaultJettonTransferNotification';
        case 0xcbcd047e:
            return 'VaultTonTransfer';
        case 0xee83652a:
            return 'VaultWithDraw';
        case 0xecd3ad8e:
            return 'BounceRevertInternalMatchOrder';
        case 0xd53276db:
            return 'JettonWalletInternalTransferExcesses';
        case 0xf8a7ea5:
            return 'JettonWalletTransfer';
        default:
            return null;
    }
};


export function getJettonWalletWrapper(blockchain: Blockchain, trs: SendMessageResult, jettonMinter: Address)  {
    const jettonDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x178d4519;
    });
    const jettonWallet = blockchain.openContract(JettonWallet.createFromAddress(flattenTransaction(jettonDeployTrs!).to!));
    
    return jettonWallet;
}

export function getVaultWrapper(blockchain: Blockchain, trs: SendMessageResult)  {
    const vaultDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2717c4a2;
    });
    const vault = blockchain.openContract(Vault.createFromAddress(flattenTransaction(vaultDeployTrs!).to!));
    
    return vault;
}

export function getVaultTonWrapper(blockchain: Blockchain, trs: SendMessageResult)  {
    const vaultDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2717c4a2;
    });
    const vault = blockchain.openContract(VaultTon.createFromAddress(flattenTransaction(vaultDeployTrs!).to!));
    
    return vault;
}

export function getFeeCollectorWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const feeCollectorDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        // return (tx.op == 0xfc7532f4 && tx.from!.equals(vaultAddress));
        // return tx.from?.toRawString() == vaultAddress.toRawString();
        return (tx.op == 0xfc7532f4) && (tx.from?.equals(vaultAddress));
    });
    
    if (!feeCollectorDeployTrs) {
        throw new Error('FeeCollector deployment transaction not found');
    }
    
    const feeCollector = blockchain.openContract(FeeCollector.createFromAddress(flattenTransaction(feeCollectorDeployTrs).to!));
    
    return feeCollector;
}

export function getOrderWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const orderDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2d0e1e1b;
    });
    const order = blockchain.openContract(Order.createFromAddress(flattenTransaction(orderDeployTrs!).to!));
    
    return order;
}

export function printGasUsage(transactions: any[], opcodeMap?: (op: number) => string | null) {
    const lines: string[] = [];
    
    lines.push('\n=== Gas Usage Report ===\n');
    lines.push('┌─────────┬────────────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    lines.push('│ (index) │ Operation                             │ Gas Used     │ Gas Limit    │ Gas Fees     │ Exit Code    │');
    lines.push('├─────────┼────────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');
    
    transactions.forEach((tx, index) => {
        const flatTx = flattenTransaction(tx);
        const opName = opcodeMap ? (opcodeMap(flatTx.op || 0) || `0x${(flatTx.op || 0).toString(16)}`) : `0x${(flatTx.op || 0).toString(16)}`;
        
        // Extract gas information from transaction
        let gasUsed = 'N/A';
        let gasLimit = 'N/A';
        let gasFees = 'N/A';
        let exitCode = 'N/A';
        
        const txAny = tx as any;
        
        // Try direct access to computePhase
        if (txAny.computePhase) {
            const cp = txAny.computePhase;
            if (cp.skipped) {
                gasUsed = 'Skipped';
                exitCode = cp.skipReason?.toString() || 'N/A';
            } else if (cp.gasUsed !== undefined) {
                gasUsed = cp.gasUsed.toString();
                gasLimit = cp.gasLimit?.toString() || 'N/A';
                if (cp.gasFees) {
                    gasFees = `${(Number(cp.gasFees) / 1e9).toFixed(9)} TON`;
                }
                exitCode = cp.exitCode?.toString() || 'N/A';
            }
        }
        
        // Try alternative structure (if computePhase is nested differently)
        if (gasUsed === 'N/A' && txAny.description) {
            const desc = txAny.description;
            if (desc.computePhase) {
                const cp = desc.computePhase;
                if (cp.skipped) {
                    gasUsed = 'Skipped';
                    exitCode = cp.skipReason?.toString() || 'N/A';
                } else if (cp.gasUsed !== undefined) {
                    gasUsed = cp.gasUsed.toString();
                    gasLimit = cp.gasLimit?.toString() || 'N/A';
                    if (cp.gasFees) {
                        gasFees = `${(Number(cp.gasFees) / 1e9).toFixed(9)} TON`;
                    }
                    exitCode = cp.exitCode?.toString() || 'N/A';
                }
            }
        }
        
        const opNamePadded = opName.padEnd(40);
        const gasUsedPadded = gasUsed.padEnd(14);
        const gasLimitPadded = gasLimit.padEnd(14);
        const gasFeesPadded = gasFees.padEnd(14);
        const exitCodePadded = exitCode.padEnd(14);
        
        lines.push(`│ ${index.toString().padStart(7)} │ ${opNamePadded} │ ${gasUsedPadded} │ ${gasLimitPadded} │ ${gasFeesPadded} │ ${exitCodePadded} │`);
    });
    
    lines.push('└─────────┴────────────────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘');
    lines.push('');
    
    console.log(lines.join('\n'));
}
