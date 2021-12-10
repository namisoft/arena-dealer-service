import {ChainConfig} from "./chain-config";
import {ABIs} from "./contracts";

export const ChainConfigAvaxMain: ChainConfig = {
    chainId: 43114,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    symbol: "AVAX",
    explorerUrl: "https://cchain.explorer.avax.network",
    contracts: {
        PenguinRandomizer: {
            address: "0x",
            abi: ABIs.PenguinRandomizer
        },
        Multicall: {
            address: "0x",
            abi: ABIs.Muticall
        }
    }
}