import {ChainConfig} from "./chain-config";
import {ABIs} from "./contracts";

export const ChainConfigPolygonTest: ChainConfig = {
    chainId: 80001,
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    symbol: "MATIC",
    explorerUrl: "https://mumbai.polygonscan.com",
    contracts: {
        PenguinRandomizer: {
            address: "0xEc2F7347221eeFFE55561D50651638fCEFFee083",
            abi: ABIs.PenguinRandomizer
        },
        Multicall: {
            address: "0x9b26610dCf636C5E8094724ae7B0BB069491BeF7",
            abi: ABIs.Muticall
        }
    }
}