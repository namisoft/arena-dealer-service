import {ServiceRunner} from "./ServiceRunner";
import {singleton} from "tsyringe";
import {DealerService} from "./DealerService";

@singleton()
export class RunnerDev implements ServiceRunner {
    constructor(private dealerService: DealerService) {
    }

    run() {
        // Using hard-coded private key
        const privateKey = "*****";
        this.dealerService.setWorkingBot(privateKey, 1000000);

        this.dealerService.runCommitWorker();
        this.dealerService.runRevealWorker();
        this.dealerService.scanRandomizerEvents();
    }

    stop() {
    }
}