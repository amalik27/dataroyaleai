var shell = require('shelljs');
var chalk = require("chalk");
var http = require('http');
const portsAllowed = 101; // Define max number of ports from STARTING_PORT 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu
const STARTING_PORT = 5000;
//TODO: Create new function using `docker container ls --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}" -a` to return true or false if a given port is taken.


/**
 * We operate under the assumption that the Docker Container is ideal and absolutely cannot go beyond the resource limits given(which to be fair it seems to be able to do)
 */


class PrometheusDaemon{

  constructor(portsAllowed, maxCPU = .05, maxMemory = 300, processID){
    this.ports = new Array(portsAllowed);
    this.containerQueue = new ContainerQueue()
    this.containerStack = new ContainerStack(maxCPU,maxMemory)
    this.interval = null
    this.processID = processID;

    console.log(chalk.green("[Prometheus] Initialized Daemon. Prometheus is watching for updates..."));
  }

  ///Passes by value, NOT reference
  getRunningContainers(){
    return this.containerStack.stack.slice(0);//used to change reference
  }

  startMonitoring(intervalTime) {
    if (!this.interval) {
      this.interval = setInterval(() => {
        if (!this.containerQueue.isEmpty()) {

          //Call HW-Limit-Aware-Start-System
          const container = this.containerQueue.dequeue();
          try{
            this.containerStack.push(container);
            this.initializeContainers(container.containerID, container.memory, container.cpu);
          }catch(e){
            //console.log(chalk.yellow(`[Prometheus] Reached hardware limit when attempting to initialize ${container.toString()} from queue...`));
            this.containerQueue.queue.push(container);//NOTE: PUSH BECAUSE WE WANT IT TO REMAIN #1
          }
          
        }
      }, intervalTime);
    }
  }

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log(chalk.gray("[Prometheus] Prometheus has stopped watching for updates..."));
  }
    /**
   * Function to add a number to the ports using linear probing 
   */ 
  addToHashSet(containerID) {
    /// Function to calculate the hash value for a given number

    let index = containerID % portsAllowed;
    
    // Check if the slot is empty, if not, probe linearly until an empty slot is found
    while (this.ports[index] !== undefined) {
      console.log(this.ports[index]);
      index = (index + 1) % portsAllowed;
    }

    // Insert the number into the empty slot
    this.ports[index] = containerID;
    return index;
  }

  getPortByID(containerID){
    let hash = parseInt(containerID) % portsAllowed; // Simple hash function
    let port = hash; // Calculate port number based on hash
    // Check if port is already in use (you would implement the checkPortAvailability function)
    while (this.ports[port]!=containerID) {
      hash = (hash + 1) % portsAllowed;
      port = STARTING_PORT + hash;
    }
    return STARTING_PORT+port; 
  }

  /**
   * 
   * @param {Array<number>} userIDs 
   * @param {number} maxMemory -1 means 500mb memory max.
   * @param {number} [cpus=defaultCPU] determines how much processing power we give it. Numbers <4 are safe. Beyond that it COULD slow down your machine.(no promises)
   * @returns {number} id 
   */
  initializeContainers(containerID, maxMemory, cpus, silent = true){
    console.log(chalk.green(`[Prometheus] Starting Containers... memory cap ${maxMemory}m  with cpu availability ${cpus}.`));
    shell.exec(`docker build -t ${containerID} ./dockercontainer`, {silent: silent})
    let port = STARTING_PORT + this.addToHashSet(parseInt(containerID),portsAllowed);//We only use ports from STARTING_PORT to STARTING_PORT + 100
    shell.exec(`docker run -d --memory=${maxMemory}m --cpus=${cpus} -p ${port}:STARTING_PORT ${containerID}`, {silent: silent}) 
    console.log(`${containerID} is listening on port ${port} with memory cap ${maxMemory}m  with cpu availability ${cpus}. `);
    console.log(`Remaining Resources - CPU: ${(this.containerStack.maxCPU - this.containerStack.currentCPU).toFixed(2)}, Memory: ${(this.containerStack.maxMemory - this.containerStack.currentMemory).toFixed(2)} MB`);
  }

  /**
   * 
   * @param {Array<number>} containers Array of container IDs we generate
   */
  killContainers(containers, silent = true){
    console.log(chalk.red("[Prometheus] Killing Containers..."));
    containers.forEach((container) => {
        let containerTag = container.containerID//I know this is terrible basically our system has its own ID format which is technically docker's tag format. Don't yell at me ok.
        let containerID = shell.exec(`docker ps | grep ${containerTag} | cut -f 1 -d ' '`, {silent: silent});
        if (containerID.code !== 0) {
            console.log(chalk.red(`Error finding running container for ID: ${containerID}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        let containerStopped = shell.exec(`docker stop ${containerID}`, {silent: silent});
        if (containerStopped.code !== 0) {
            console.log(chalk.red(`Error stopping container ${containerID} | exit code: ${containerStopped.code}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        let containerRemoved = shell.exec(`docker container rm ${containerID}`, {silent: silent});
        if (containerRemoved.code !== 0) {
            console.log(chalk.red(`Error removing container ${containerID}| exit code: ${containerRemoved.code}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        let imageRemoved = shell.exec(`docker rmi ${containerTag}:latest -f`, {silent: silent});
        if (imageRemoved.code !== 0) {
            console.log(chalk.red(`Error removing image ${containerTag}:latest| exit code: ${imageRemoved.code}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        // If all operations are successful
        console.log(chalk.grey(`${containerID} was successfully stopped, removed, and image deleted.`));
    })
  }

  /**
   * @param {JSON} req is the JSON data of the request as we recieve it.
   * @param {String} address is the address we are considering sending this to. To improve modularity, I added an address field. Hypothetically in future implementations, one could have these daemons running on one machine with the containers on another.
   */
  async forward(req, address = '127.0.0.1') {
    // Wrap the request in a promise to handle it asynchronously
    return new Promise((resolve, reject) => {
      // Extract the container ID from the request.
      const containerID = req.containerID;
      const port = this.getPortByID(containerID); // Assumes containerID is an integer.

      const options = {
        hostname: address,
        port: port,
        path: '/',
        method: 'GET',
      };

      const forwardReq = http.request(options, (res) => {
        let data = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk; // Append data chunk to data variable
        });
        res.on('end', () => {
          // Resolve the promise with the received data
          resolve(data);
        });
      });

      forwardReq.on('error', (e) => {
        // Reject the promise on request error
        reject(`problem with request: ${e.message}`);
      });

      // End the request
      forwardReq.end();
    });
  }

}
class ContainerStack {
  constructor(maxCPU, maxMemory) {
    this.stack = [];
    this.maxCPU = maxCPU;
    this.maxMemory = maxMemory;
    this.currentCPU = 0;
    this.currentMemory = 0;
  }

  push(container) {
    // Check if pushing this container exceeds CPU or memory limits. Only add if so.
    if (this.currentCPU + container.cpu <= this.maxCPU && this.currentMemory + container.memory <= this.maxMemory) {
      this.stack.push(container);
      this.currentCPU += container.cpu;
      this.currentMemory += container.memory;
    } else {
      throw new Error(`Push failed. Exceeds CPU or memory limits. Container: ${container.toString()} `);
    }
  }

  ///For debugging.
  printAvail = () => console.log(`[Container Stack] Availability is now ${(this.maxCPU - this.currentCPU).toPrecision(4)} CPU and ${(this.maxMemory - this.currentMemory).toPrecision(4)} RAM`);

  remove(containerID) {
    const indexToRemove = this.stack.findIndex((item) => item.containerID === containerID);

    if (indexToRemove !== -1) {
      const { parameters } = this.stack.splice(indexToRemove, 1)[0];
      this.currentCPU -= parameters.cpu;
      this.currentMemory -= parameters.memory;
    } else {
      console.log(`Container with ID '${containerID}' not found.`);
    }
  }

  isEmpty() {
    return this.stack.length === 0;
  }
}
class ContainerQueue {
  constructor() {
    this.queue = [];
    //this.itemMap = new Map(); // Map to store unique IDs and their items
  }

  /**
   * 
   * @param {number} priority 
   * @param {number} containerID 
   */
  enqueue(parameters,priority=1, containerID) {
    if (this.queue.find(container=>{
        container.containerID ==containerID
    }) == undefined) {
      this.queue.push(new Container(parameters.cpus, parameters.memory,containerID,priority));
      this.queue.sort((a, b) => a.priority - b.priority);
      //this.itemMap.set(containerID, parameters);
    } else{
      console.log(chalk.gray("[Failure] Duplicate ContainerID When Enqueueing " + containerID.toString()))
    }
  }

  dequeue() {
    if (!this.isEmpty()) {
      let container  = this.queue.shift();
      //const parameters = this.itemMap.get(containerID);
      //this.itemMap.delete(containerID);
      return container;
    }
    return null;
  }

  /**
   * 
   * @param {number} containerID 
   */
  remove(containerID) {
    if (this.itemMap.has(containerID)) {
      const indexToRemove = this.queue.findIndex((item) => item.containerID === containerID);
      if (indexToRemove !== -1) {
        this.queue.splice(indexToRemove, 1);
        //this.itemMap.delete(containerID);
      }
    }
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}
///Keeps things clean
class Container{
  constructor(cpu, memory, containerID,priority){
    this.cpu = cpu;
    this.memory = memory;
    this.containerID = containerID;
    this.priority = priority;
    this.toString = () => `{containerID: ${containerID},cpu: ${cpu}, memory: ${memory}, priority: ${priority}}`
  }
}

module.exports = { Container, PrometheusDaemon}