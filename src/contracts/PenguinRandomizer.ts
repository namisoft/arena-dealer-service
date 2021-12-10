import {Ownable} from "./Ownable";
import {SendOptions} from "../common/contract-base";
import {ChainConfig} from "../config/chain-config";
import {container} from "tsyringe";
import {MultiCall} from "./MultiCall";
import {to32BytesHex} from "../common/utils";

export class PenguinRandomizer extends Ownable {
    private static _instance?: PenguinRandomizer;

    static getInstance() {
        if (!PenguinRandomizer._instance) {
            const chainConfig: ChainConfig = container.resolve("ChainConfig");
            PenguinRandomizer._instance = new PenguinRandomizer(chainConfig.contracts.PenguinRandomizer);
        }
        return PenguinRandomizer._instance as PenguinRandomizer;
    }

    async controlState() {
        const muticall = MultiCall.getInstance();
        const abiRequestCounter = this.underlyingContract.methods["requestCounter"]().encodeABI();
        const abiTotalUsableHashes = this.underlyingContract.methods["totalUsableHashes"]().encodeABI();
        const input = [
            {target: this.contractInfo.address, callData: abiRequestCounter},
            {target: this.contractInfo.address, callData: abiTotalUsableHashes}
        ]
        const rCall = await muticall.aggregate(input);
        const requestCounter = Number(
            this.web3.eth.abi.decodeParameters(["uint256"], rCall.outputData[0])[0]
        );
        const totalUsableHashes = Number(
            this.web3.eth.abi.decodeParameters(["uint256"], rCall.outputData[1])[0]
        );
        return {
            requestCounter: requestCounter,
            totalUsableHashes: totalUsableHashes,
            block: Number(rCall.blockNumber)
        }
    }

    // get revealed secret of a hash; return 0 --> not revealed yet
    revealedSecrets(hash: string): Promise<string> {
        return this.underlyingContract.methods["revealedSecrets"](hash)
            .call({})
            .then(r => to32BytesHex(r[0]))
    }

    // each secret hash must be in hex string number form
    commit(secretHashes: string[], options?: SendOptions) {
        return this.sendTx("commit", [secretHashes], options)
    }

    // secret & secret hash must be in hex string number form
    reveal(hash: string, secret: string, options?: SendOptions) {
        return this.sendTx("reveal", [hash, secret], options)
    }


    readonly pastEvents = ((self: PenguinRandomizer) => {
        return {
            secretHashAssigned: (fromBlock: number, toBlock: number) =>
                new Promise<PenguinRandomizerEventData.SecretHashAssigned[]>((resolve, reject) => {
                    self.underlyingContract
                        .getPastEvents("SecretHashAssigned", {
                            fromBlock: fromBlock,
                            toBlock: toBlock
                        })
                        .then(events => {
                            const ret: PenguinRandomizerEventData.SecretHashAssigned[] = [];
                            for (const evt of events) {
                                const secretHash = to32BytesHex(evt.returnValues["secretHash"]);
                                const secretIndex = Number(evt.returnValues["secretIndex"]);
                                ret.push({secretHash: secretHash, secretIndex: secretIndex, block: evt.blockNumber})
                            }
                            resolve(ret);
                        })
                        .catch(err => {
                            reject(err);
                        })
                }),
        }
    })(this)
}

export namespace PenguinRandomizerEventData {
    export type SecretHashAssigned = { secretHash: string, secretIndex: number, block: number }
}