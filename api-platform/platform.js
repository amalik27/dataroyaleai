var shell = require('shelljs');
var chalk = require("chalk");
var Prometheus = require('./daemon');
///USED FOR TESTING.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
//Program-level constants
const _ = undefined;


//Create new daemon
let daemon = new Prometheus.PrometheusDaemon([5000,5021,5030,5049],.5,500,"user123",10);
//Define shutdown sequence
process.on('SIGINT', () => {
  console.log(chalk.red("[Prometheus] Shutdown signal recieved, performing cleanup."));
  
  daemon.stopMonitoring();
  daemon.killContainers(daemon.getRunningContainers());
  // Exit with status code 0 (success)
  process.exit(0);
});


//Testing constants
const containers = [{containerID:"7295434", model: "Pythagoras"},{containerID:"34554466",model:"Archimedes"},{containerID:"6857458",model:"Archimedes"}]

//Cause it to start watching for updates
daemon.startMonitoring(500)

//Enqueue testing containers
containers.forEach((container)=>{
  console.log(chalk.gray("Enqueuing " + container.containerID.toString()))
  daemon.containerQueue.enqueue({cpus:.2, memory:100},1,container.containerID,container.model)
});


//Similar to test cases, can be converted into such.
//Test calling Pythagoras model using container ID
sleep(3000).then(()=>{
  req = { containerID: '7295434', body:{ a: 3, b: 4,}};
  console.log(chalk.yellow(`[Client] Requesting: ${JSON.stringify(req)}`))
  daemon.forward(req)
  .then(data => {
    console.log(chalk.yellow(`[Client] Result: ${data}`))
  })
  .catch(error => {
    console.error(error); // Handle any errors
  });
})

//Test calling Archimedes model using container ID
sleep(6000).then(()=>{
  req = { containerID: '34554466', body:{ r: 3, g: 4, v:5}};
  console.log(chalk.yellow(`[Client] Requesting: ${JSON.stringify(req)}`))
  daemon.forward(req)
  .then(data => {
    console.log(chalk.yellow(`[Client] Result: ${data}`))
  })
  .catch(error => {
    console.error(error); // Handle any errors
  });
})
