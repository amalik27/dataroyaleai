//Import athenaDaemon
const AthenaDaemon = require("./athenaDaemon");
const { Container } = require("./platformDaemon");
const chalk = require('chalk');

let daemon = new AthenaDaemon([5000],5,20000,'testDAemon',10000);
daemon.startMonitoring(500);

process.on('SIGINT', () => {
    console.log(chalk.red("[Prometheus] Shutdown signal recieved, performing cleanup."));   
    daemon.shutdown();
    // Exit with status code 0 (success)
    process.exit(0);
  });

//Create a .csv file containing a sine wave with a little noise applied.
filePath = "./TestDatasets/noisy_sine.csv";
function bodyMapper(row, columnNameX, columnNameY) {
    return {
        angle: row[columnNameX],
        y: row[columnNameY]
    };
}
async function checkUntilHealthy(daemon, containerTag, retryInterval = 10000,attempts = 5, fn) {
    if(attempts){
        try {
            const status = await daemon.checkContainerHealth(containerTag);
            if (status.status=="healthy") {
                console.log('Container is healthy.');
                fn();
            } else {
                console.log('Container is not healthy yet. Retrying...');
                setTimeout(() => checkUntilHealthy(daemon,containerTag, retryInterval,attempts-=1, fn), retryInterval, );
            }
        } catch (error) {
            console.error('Error checking container health:', error);
            setTimeout(() => checkUntilHealthy(daemon,containerTag, retryInterval,attempts-=1, fn));
        }
    } else{
        console.log('Error checking container health:'); 
    }
}

daemon.initializeContainer(new Container(5,20000,'123','Euclid'));
checkUntilHealthy(daemon,'123',10000,6,()=>daemon.evaluateModel(filePath,'123',bodyMapper,'X','Y'));
