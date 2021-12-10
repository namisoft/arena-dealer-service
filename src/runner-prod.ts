import {ServiceRunner} from "./ServiceRunner";
import {container, singleton} from "tsyringe";
import Web3 from "web3";
import {DealerService} from "./DealerService";

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs-extra');
const readline = require('readline');

@singleton()
export class RunnerProd implements ServiceRunner{
    constructor(private dealerService: DealerService) {
    }

    run(){
        // read json keystore file from commandline
        const jksFile = argv['jks'];
        if (!jksFile) {
            console.error("Unspecified keystore file");
            process.exit(1);
        }
        const keystore = fs.readJSONSync(jksFile);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.stdoutMuted = true;

        const self = this;

        // let user enter the password of keystore file
        rl.question('Keystore password: ', function(password) {
            rl.close();
            try {
                const web3: Web3 = container.resolve("Web3");
                const decryptedKey = web3.eth.accounts.decrypt(keystore, password);
                // start bot
                self.dealerService.setWorkingBot(decryptedKey.privateKey, 1000000);
                self.dealerService.runCommitWorker();
                self.dealerService.runRevealWorker();
                self.dealerService.scanRandomizerEvents();
            }catch (e){
                console.error(`\n${e.toString()}`);
                process.exit(1);
            }
        });

        rl._writeToOutput = function _writeToOutput(stringToWrite) {
            if (rl.stdoutMuted)
                rl.output.write("*");
            else
                rl.output.write(stringToWrite);
        };
    }

    stop(){

    }
}