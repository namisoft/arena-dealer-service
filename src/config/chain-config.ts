export interface ChainConfig {
    readonly chainId: number,
    readonly rpcUrl: string,
    readonly symbol: string,
    readonly explorerUrl: string,
    readonly contracts: {
        PenguinRandomizer: {
            readonly address: string,
            readonly abi: any[]
        }

        Multicall: {
            readonly address: string,
            readonly abi: any[]
        }
    }
}