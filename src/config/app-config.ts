export const AppConfig = {
    HttpPort: 3000,
    Redis: {
        url: "redis://34.136.134.171:6379",
        password: "*****",
        connect_timeout: 500
    },
    MaxBlocksEachScan: 100,              // The max numbers of block for each scan,
    ProcessTryTimes: 3,                 // Try times when proc failed
    SleepTimeUntilNextTry: 1000,        // Sleep time after failure until next try (in milliseconds)
    SystemDeployedBlock: 21607532,       // The block where system was deployed
    GameEventsScanInterval: 10,        // Scan interval for game events (in milliseconds)
    RandomizerEventsScanInterval: 10,        // Scan interval for randomizer contract events (in milliseconds)
    CheckForGameSetupInterval: 2000,     // Check interval for game setup (in milliseconds)
    CheckForCommitSecretsInterval: 2000,     // Check interval for secrets committing (in milliseconds)
    ResolveGameInterval: 500,          // Interval of game resolving routine
    RevealSecretInterval: 500,          // Interval of secret reveal routine
    BetsSetupAhead: 4,                 // The minimal number of bets that is required to setup ahead current bet
    HashesCommitAhead: 4,              // The minimal number of secret hashes  that is required to commit ahead,
    MinimalHashesPerCommit: 3,          // The minimal number of hashes each commit
}