var shell = require('shelljs');
var chalk = require("chalk");
const { stdin: input, stdout: output } = require('node:process');
const rl = require('readline-sync');

//Program-level constants
const portsAllowed = 101; // Define max number of ports from 5000
const ports = new Array(portsAllowed);
const defaultMemory = 50;//mb of memory.
const defaultCPU = .0001;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

//TESTING

let userIDs = ["7295434","34554466","6857458"]//Can be replaced with a command to search results of docker ps and filtering by pattern user*
var q1 =  rl.question('Start Containers? (Y/n) ')
if(q1.toLowerCase()==='y'){
  initializeContainers(userIDs);
} 
var q2 =  rl.question('Kill Containers? (Y/n) ')
if(q2.toLowerCase()==='y'){
  killContainers(userIDs);
} 





//REAL CODE

/**
 * Function to add a number to the ports using linear probing 
 */ 
function addToHashSet(number,portsAllowed) {
  /// Function to calculate the hash value for a given number

  let index = number % portsAllowed;
  
  // Check if the slot is empty, if not, probe linearly until an empty slot is found
  while (ports[index] !== undefined) {
    console.log(ports[index]);
    index = (index + 1) % portsAllowed;
  }

  // Insert the number into the empty slot
  ports[index] = number;
  return index;
}

/**
 * 
 * @param {Array<number>} userIDs 
 * @param {number} maxMemory -1 means 500mb memory max.
 * @param {number} [cpus=defaultCPU] determines how much processing power we give it. Numbers <4 are safe. Beyond that it COULD slow down your machine.(no promises)
 */
function initializeContainers(userIDs, maxMemory = defaultMemory, cpus = defaultCPU){
  console.log(chalk.green("[Prometheus] Starting Containers..."));
  userIDs.forEach((user)=>{
    shell.exec(`docker build -t ${user} ./dockercontainer`, {silent: true})
  })
  userIDs.forEach((user)=>{ 
      port = 5000 + addToHashSet(parseInt(user),portsAllowed);//We only use ports from 5000-5100
      shell.exec(`docker run -d --memory=${maxMemory}m --cpus=${cpus} -p ${port}:5000 ${user}`, {silent: true}) 
      console.log(`${user} is listening on port ${port} with memory cap ${maxMemory}m  with cpu availability ${cpus}`)
  })
}

/**
 * 
 * @param {Array<number>} containers Array of container IDs we generate
 */
function killContainers(containers){
  console.log(chalk.red("[Prometheus] Killing Containers..."));
  containers.forEach((user)=>{
      let containerID = shell.exec(`docker ps | grep ${user} | cut -f 1 -d ' ' `, {silent: true})

      //Operations
      var containerStopped = shell.exec(`docker stop ${containerID}`, {silent: true}) == containerID; 
      var containerRemoved = shell.exec(`docker container rm ${containerID}`, {silent: true}) == containerID; 
      var imageRemoved = shell.exec(`docker rmi ${user} -f`, {silent: true}) == containerID;
      var sucess = containerStopped && containerRemoved && imageRemoved;

      //Console Feedback
      if(sucess){
        console.log(chalk.grey(`${user} was killed`));
      } else{  
        console.log(chalk.red(`Error - ${user} failed following operations: ${containerStopped ? '' : 'STOP_CONTAINER '} ${containerRemoved ? '' : 'REMOVE_CONTAINER '} ${imageRemoved ? '' : 'REMOVE_IMAGE '}`));

      }
  })
}
console.log(chalk.red("[Prometheus] process.exit() reached while debugging"));
process.exit()