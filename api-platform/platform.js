var shell = require('shelljs');
var chalk = require("chalk");
var Prometheus = require('./daemon');

///USED FOR TESTING.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//Program-level constants
const _ = undefined;

//Testing constants
const containerIDs = ["7295434","34554466","6857458"]



let daemon = new Prometheus.PrometheusDaemon(_,.5,500,"user123");
process.on('SIGINT', () => {
  console.log(chalk.red("[Prometheus] Shutdown signal recieved, performing cleanup."));
  
  daemon.stopMonitoring();
  daemon.killContainers(daemon.getRunningContainers());
  // Exit with status code 0 (success)
});



daemon.startMonitoring(500)
containerIDs.forEach((id)=>{
  console.log(chalk.gray("Enqueuing " + id.toString()))
  daemon.containerQueue.enqueue({cpus:.2, memory:100},1,id)
});

req = { containerID: '7295434', body:{ a: 3, b: 4,}};

sleep(5000).then(()=>{
  console.log(chalk.yellow(`[Client] Requesting: ${JSON.stringify(req)}`))
  daemon.forward(req)
  .then(data => {
    console.log(chalk.yellow(`Result: ${data}`))
  })
  .catch(error => {
    console.error(error); // Handle any errors
  });
})


