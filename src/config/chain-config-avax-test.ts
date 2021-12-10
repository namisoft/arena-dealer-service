import {ChainConfig} from "./chain-config";
import {ABIs} from "./contracts";

export const ChainConfigAvaxTest: ChainConfig = {
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    symbol: "AVAX",
    explorerUrl: "https://cchain.explorer.avax-test.network",
    contracts: {
        CoinFlip: {
            address: "0x8c2e8E9124a8Ef37209D62143655F9501a7426CE",
            tracker: "0x14bf1D1926EAc721d1694dc2ff0ebCDC7c902513",
            abi: ABIs.CoinFlipGame
        },
        PenguinRandomizer: {
            address: "0x023A6146119DF61E60893821Eba4082812FfA9fE",
            abi: ABIs.PenguinRandomizer
        },
        Multicall: {
            address: "0x1536F4f9D78cAfB9dB4C3261CFeAa73eAAC40428",
            abi: ABIs.Muticall
        }
    }
}