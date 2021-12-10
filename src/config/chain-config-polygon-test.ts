import {ChainConfig} from "./chain-config";
import {ABIs} from "./contracts";

export const ChainConfigPolygonTest: ChainConfig = {
    chainId: 80001,
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    symbol: "MATIC",
    explorerUrl: "https://mumbai.polygonscan.com",
    contracts: {
        CoinFlip: {
            address: "0x15936383Ac9CC0a5CA551A6332894ca52b975E2e",
            tracker: "0x02FAe4E72c8f00093289883dacF9F9889Ff18146",
            abi: ABIs.CoinFlipGame
        },
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