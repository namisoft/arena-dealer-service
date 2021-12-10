import {autoInjectable, container, inject, singleton} from "tsyringe";
import {AppConfig} from "./config/app-config";
import Web3 from "web3";
import {BaseResult} from "./common/base-result";
import {sleep} from "./common/utils";
import {SequentialTaskQueue} from "sequential-task-queue";
import {randomBytes} from "crypto";
import {DealerBot} from "./DealerBot";
import {SecretDataStorage} from "./SecretDataStorage";
import {PenguinRandomizerEventData} from "./contracts/PenguinRandomizer";
import {ChainConfig} from "./config/chain-config";

@singleton()
@autoInjectable()
export class DealerService {
    private readonly _secretDataStorage: SecretDataStorage
    private _dealerBot?: DealerBot;
    private readonly _web3: Web3;
    private _checkForCommitSecretsTimer: NodeJS.Timer;
    private _scanSecretHashAssignedEventsTimer: NodeJS.Timer;
    private _checkForRevealSecretTimer: NodeJS.Timer;

    private readonly _commitSecretsTaskQueue = new SequentialTaskQueue();
    private readonly _scanWaitingHashesTaskQueue = new SequentialTaskQueue();
    private readonly _revealSecretTaskQueue = new SequentialTaskQueue();

    private readonly _processingSecrets = new Map<string, number>();

    constructor(@inject("ChainConfig") private chainConfig: ChainConfig) {
        this._web3 = container.resolve("Web3");
        this._secretDataStorage = new SecretDataStorage(chainConfig.contracts.PenguinRandomizer.address);
    }

    setWorkingBot(privateKey: string, defaultGasLimit: number) {
        this._dealerBot = new DealerBot(privateKey, defaultGasLimit);
    }

    runCommitWorker() {
        this._requireBotConfigured();
        console.log(`Starting secret commit worker with bot ${this._dealerBot.address}`);
        this._checkForCommitSecretsTimer = setInterval(
            () => {
                return this._commitSecretsTaskQueue.push(() => {
                    return this._commitSecretsRoutine().then().catch()
                })
            },
            AppConfig.CheckForCommitSecretsInterval
        );
    }

    runRevealWorker() {
        this._requireBotConfigured();
        console.log(`Starting secret reveal worker with bot ${this._dealerBot.address}`);
        this._checkForRevealSecretTimer = setInterval(
            () => {
                return this._revealSecretTaskQueue.push(() => {
                    return this._revealSecretRoutine().then().catch()
                })
            },
            AppConfig.RevealSecretInterval
        );
    }

    scanRandomizerEvents() {
        this._requireBotConfigured();

        // Scan SecretHashAssigned events
        this._scanSecretHashAssignedEventsTimer = setInterval(
            () => {
                return this._scanWaitingHashesTaskQueue.push(() => {
                    return this._scanWaitingHashesRoutine().then().catch()
                })
            },
            AppConfig.RandomizerEventsScanInterval
        );
    }

    private _requireBotConfigured() {
        if (!this._dealerBot) {
            throw new Error("Bot not configured!");
        }
    }

    private _commitSecretsRoutine = async () => {
        const controlState = await this._dealerBot.getControlState();

        if (controlState.totalUsableHashes >= AppConfig.HashesCommitAhead)
            return {data: 0};

        const secretAmountsToCommit = Math.max(
            AppConfig.HashesCommitAhead - controlState.totalUsableHashes,
            AppConfig.MinimalHashesPerCommit
        );

        // Generate secrets randomly
        const secrets = DealerService._generateSecrets(secretAmountsToCommit).map(v => {
            const hash = this._web3.utils.soliditySha3(this._web3.utils.toBN(v));
            return {value: v, hash: hash}
        });
        // Save secrets into cache in key/value form: keckak256(secret) => encrypt(secret)
        // TODO: encrypt secret before saving!
        const saveRet =
            await this._secretDataStorage
                .saveSubmittedSecrets(secrets)
                .then(_ => true)
                .catch(_ => false);

        if (!saveRet) {
            return {error: "SaveSecretsFailed"}
        }

        // Commit secrets; if failed --> revert saved secrets
        const hashes = secrets.map(v => v.hash);
        const rCommit = await this._dealerBot.commit(hashes);
        if (!rCommit) {
            // revert secret saving
            this._secretDataStorage.removeSecrets(hashes).then().catch();
            return {error: "CommitSecretsTxFailed"}
        }
        return {data: secretAmountsToCommit}
    }

    // Scan "SecretHashAssigned" of randomizer contract to save to storage
    private _scanWaitingHashesRoutine = () => {
        return this._scanEventRoutine<PenguinRandomizerEventData.SecretHashAssigned>(
            "SecretHashAssigned",
            (fromBlock, toBlock) => {
                return this._dealerBot.readSecretHashAssigned(fromBlock, toBlock)
            },
            async (eventsData) => {
                // filter events
                const relevantEvents = [];
                for (const evt of eventsData) {
                    // Check the existence of secret in storage
                    const isExistingSecret = await
                        this._secretDataStorage
                            .existsSecret(evt.secretHash)
                            .catch(_ => false);
                    if (!isExistingSecret) {
                        // secret not stored: ignore
                        continue;
                    }
                    // check secret hash state
                    const isRevealed = await this._dealerBot.isRevealedSecret(evt.secretHash);
                    if (!isRevealed) {
                        // only not revealed secret is accepted
                        relevantEvents.push(evt);
                    }
                }
                if (relevantEvents.length > 0) {
                    console.log(`Relevant secrets found: ${JSON.stringify(relevantEvents)}`);
                }
                return this
                    ._saveFoundWaitingHashes(relevantEvents)
                    .then(rs => {
                        return {data: rs.filter(r => !r.error).length}
                    })
                    .catch(err => {
                        return {error: err}
                    })
            }
        )
    }

    private _revealSecretRoutine = async () => {
        // Get latest block
        const latestBlock = await this._web3.eth.getBlockNumber();
        // Query the hashes that are candidates for revealing
        const revealableSecrets = await this._secretDataStorage.getWaitingSecretsInRange({max: latestBlock - 2});
        if (revealableSecrets.length == 0) {
            return;
        }
        // find the first secret in the list to process
        let selectedSecret: { secretHash: string, secretIndex: number } | undefined = undefined;
        const alreadyRevealedSecrets: { secretHash: string, secretIndex: number }[] = [];
        for (let i = 0; i < revealableSecrets.length; i++) {
            if (!this._processingSecrets.has(revealableSecrets[i].secretHash)) {
                // check from smart contract: secret already revealed or not?
                const alreadyRevealed = await this._dealerBot.isRevealedSecret(revealableSecrets[i].secretHash);
                if (!alreadyRevealed) {
                    this._processingSecrets.set(revealableSecrets[i].secretHash, revealableSecrets[i].secretIndex);
                    selectedSecret = revealableSecrets[i];
                    break;
                } else {
                    // record already revealed secret btw !!!
                    alreadyRevealedSecrets.push(revealableSecrets[i]);
                }
            }
        }

        // Remove already-revealed secret with relaxing manner
        for (const secretInfo of alreadyRevealedSecrets) {
            this._secretDataStorage.removeWaitingSecret(secretInfo).catch();
        }

        if (!selectedSecret) {
            // all potential secrets already in processing
            return;
        }

        const releaseFromProcessingSecrets = () => this._processingSecrets.delete(selectedSecret.secretHash);

        console.log(`Try to reveal secret: ${JSON.stringify(selectedSecret)} ...`);

        // Query secret from storage
        const readSecret: { secret?: string, hasError: boolean } =
            await this._secretDataStorage
                .getSecret(selectedSecret.secretHash)
                .then(v => {
                    return {secret: v, hasError: false}
                })
                .catch(err => {
                    // error in reading data
                    console.error(`Reading secret  ${selectedSecret.secretHash} failed: ${err.toString()}`);
                    return {hasError: true}
                })
        if (readSecret.hasError) {
            // remove from in-memory processing games
            // (that means this TX will be selected to process on the next iteration)
            releaseFromProcessingSecrets();
            console.error(`Reveal secret ${selectedSecret.secretHash} failed: error in reading secret. Will try next time`);
            return;
        } else if (!readSecret.secret) {
            // no stored secret found: error
            //  1. remove secret hash info from waiting list
            await this._secretDataStorage.removeWaitingSecret(selectedSecret).catch();
            //  2. remove hash from in-memory processing secrets
            releaseFromProcessingSecrets();
            //  TODO: 3. add to error list
            console.error(`Reveal secret ${selectedSecret.secretHash} failed: secret not found`);
            return;
        }
        // TODO: decrypt secret
        const secretToReveal = readSecret.secret;

        // Try to send TX to reveal secret
        const rSendTx: { success: boolean, isTxSendingError?: boolean } =
            await this._dealerBot
                .reveal(selectedSecret.secretHash, secretToReveal)
                .then(r => {
                    return r.error ? {
                        success: false,
                        isTxSendingError: r.error.txSendingError
                    } : {success: true}
                })
                .catch(err => {
                    console.error(`Reveal secret ${selectedSecret.secretHash} exception in TX: ${err.toString()}`);
                    return {success: false}
                });
        if (rSendTx.success) {
            // remove from waiting list
            await this._secretDataStorage.removeWaitingSecret(selectedSecret).catch();
            // remove from in-memory processing secrets
            releaseFromProcessingSecrets();
            // TODO: add secret to processed list
            //console.log(`Reveal secret ${selectedSecret.secretHash} success!`);
        } else {
            if (rSendTx.isTxSendingError) {
                // remove from in-memory processing secrets
                // (that means this TX will be selected to process on the next iteration)
                releaseFromProcessingSecrets();
                console.error(`Reveal secret ${selectedSecret.secretHash} failed: error in sending TX. Will try next time`)
            } else {
                // this is the case of TX processing error
                //  1. remove from waiting list
                await this._secretDataStorage.removeWaitingSecret(selectedSecret).catch();
                //  2. remove bet from in-memory processing games
                releaseFromProcessingSecrets();
                //  TODO: 3. add to error list
                console.error(`Reveal secret ${selectedSecret.secretHash} failed: error in processing TX`)
            }
        }
    }

    private async _saveFoundWaitingHashes(eventsData: PenguinRandomizerEventData.SecretHashAssigned[]): Promise<BaseResult[]> {
        const promises: Promise<BaseResult>[] = [];
        for (const evtData of eventsData) {
            promises.push(
                this._secretDataStorage
                    .saveWaitingSecret(evtData)
                    .then(_ => {
                        return {data: true}
                    })
                    .catch(err => {
                        console.error(`Saving waiting hash ${evtData.secretHash} failed: ${err.toString()}`);
                        return {error: err.toString()}
                    })
            )
        }
        return Promise.all(promises)
    }

    private _scanEventRoutine = async <D>(
        event: string,
        readData: (fromBlock: number, toBlock: number) => Promise<BaseResult<D[], string>>,
        process: (eventsData: D[]) => Promise<BaseResult<any, string>>
    ) => {
        // Read last scanned block number
        let lastScannedBlock = await this._secretDataStorage.getLastScannedBlock(event);
        if (!lastScannedBlock) {
            lastScannedBlock = AppConfig.SystemDeployedBlock;
        }
        // Get latest block
        const latestBlock = await this._web3.eth.getBlockNumber();
        // Calculate from/to for scan
        const fromBlock = lastScannedBlock + 1;
        const toBlock = Math.min(fromBlock + AppConfig.MaxBlocksEachScan - 1, latestBlock);
        if (fromBlock > toBlock) {
            return;
        }
        // Read events data
        console.log(`Scan for events ${event} in block range ${fromBlock} -> ${toBlock}`);
        const readRet = await readData(fromBlock, toBlock);
        if (readRet.error) {
            console.error(`Read event ${event} failed: ${readRet.error}`);
            // Release lock
            //this._lockers.set(event, false);
            // Return without saving anything
            return;
        }
        // Process
        let tries = 1;
        let procRet: BaseResult<any, string>;
        do {
            procRet = await process(readRet.data);
            if (!procRet.error) {
                // console.log(`Process for event ${event} success with tries=${tries}`);
                break;
            } else {
                console.error(`Process for event ${event} failed: ${procRet.error} ,tries=${tries}`);
                tries += 1;
                // Sleep
                await sleep(AppConfig.SleepTimeUntilNextTry);
            }
        } while (tries <= AppConfig.ProcessTryTimes);

        if (!procRet.error) {
            // TODO:??

        } else {
            // TODO: save events data with error making for manually investigation later?
        }

        // Update scan info
        await this._updateScanInfo(event, toBlock);

        // Release lock
        //this._lockers.set(event, false);
    }

    private _updateScanInfo = async (event: string, latestScannedBlock: number): Promise<boolean> => {
        let tries = 1;
        do {
            const saveRet: BaseResult =
                await this._secretDataStorage
                    .setLastScannedBlock(event, latestScannedBlock)
                    .then(v => {
                        return {data: v}
                    })
                    .catch(e => {
                        return {error: e}
                    });
            if (saveRet.error) {
                // Failed: re-try
                console.error(`Save scan info for event ${event} failed: ${saveRet.error}, tries=${tries}`);
                tries += 1;
                // Sleep
                await sleep(AppConfig.SleepTimeUntilNextTry);
            } else {
                // Success: return
                console.log(`Save scan info for event ${event} success with tries=${tries}: ` +
                    `latestScannedBlock=${latestScannedBlock}`);
                return true;
            }
        } while (tries <= AppConfig.ProcessTryTimes);
        return false;
    }

    private static _generateSecrets(amount: number) {
        const secrets = [];
        for (let i = 0; i < amount; i++) {
            secrets.push(`0x${randomBytes(32).toString('hex')}`)
        }
        return secrets
    }
}