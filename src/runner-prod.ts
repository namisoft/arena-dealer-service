import {ServiceRunner} from "./ServiceRunner";
import {singleton} from "tsyringe";

@singleton()
export class RunnerProd implements ServiceRunner{
    run(){

    }

    stop(){

    }
}