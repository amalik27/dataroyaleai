var shell = require('shelljs');
var chalk = require("chalk");

const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

//TODO: Create new function using `docker container ls --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}" -a` to return true or false if a given port is taken.


/**
 * We operate under the assumption that the Docker Container is ideal and absolutely cannot go beyond the resource limits given(which to be fair it seems to be able to do)
 */

//TODO: Finish implementing.
class PrometheusDaemonManager {
  constructor() {
    this.daemons = {};
    this.processQueue = [];
    this.cpuResourcePool = {
      G: new Set(), // Guaranteed CPU blocks
      O: new Set()  // Overload CPU blocks
    };
  }

  addProcessToQueue(process) {
    this.processQueue.push(process);
    this.processQueue.sort((a, b) => a.priority - b.priority);
    this.allocateResources();
  }

  registerDaemon(daemon) {
    this.daemons[daemon.processID] = daemon;
  }

  unregisterDaemon(processID) {
    const daemon = this.daemons[processID];
    if (daemon) {
      daemon.killContainers(daemon.getRunningContainers());
      delete this.daemons[processID];
    }
  }

  allocateResources() {
    while (this.processQueue.length > 0 && (this.cpuResourcePool.G.size > 0 || this.cpuResourcePool.O.size > 0)) {
      const process = this.processQueue.shift();
      if (this.cpuResourcePool.G.has(process.requestedBlock)) {
        this.cpuResourcePool.G.delete(process.requestedBlock);
      } else if (this.cpuResourcePool.O.has(process.requestedBlock)) {
        this.cpuResourcePool.O.delete(process.requestedBlock);
      } else {
        // No resources available, push the process back to the queue
        this.processQueue.unshift(process);
        break;
      }
      this.startProcess(process);
    }
  }

  startProcess(process) {
    const daemon = this.daemons[process.processID];
    if (daemon) {
      daemon.initializeContainers(process.containerID, process.maxMemory, process.cpus);
    }
  }

  // Assuming this function is called when a daemon completes a process
  releaseResources(processID, cpuBlock) {
    if (this.daemons[processID]) {
      // Determine if it was a G or O block and release accordingly
      // Placeholder for logic to determine block type
      const blockType = 'G'; // or 'O'
      this.cpuResourcePool[blockType].add(cpuBlock);
      this.allocateResources(); // Try to allocate resources again
    }
  }

  shutdownAllDaemons() {
    Object.values(this.daemons).forEach(daemon => daemon.stopMonitoring());
    this.daemons = {};
  }

  // Additional methods as necessary...
}







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
            this.initializeContainers(container.containerID, container.memory, container.cpus);
          }catch(e){
            //console.log(chalk.yellow(`[Prometheus] Reached hardware limit when attempting to initialize ${container.toString()} from queue...`));
            this.containerQueue.queue.push(container);
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
  addToHashSet(number) {
    /// Function to calculate the hash value for a given number

    let index = number % portsAllowed;
    
    // Check if the slot is empty, if not, probe linearly until an empty slot is found
    while (this.ports[index] !== undefined) {
      console.log(this.ports[index]);
      index = (index + 1) % portsAllowed;
    }

    // Insert the number into the empty slot
    this.ports[index] = number;
    return index;
  }

  /**
   * 
   * @param {Array<number>} userIDs 
   * @param {number} maxMemory -1 means 500mb memory max.
   * @param {number} [cpus=defaultCPU] determines how much processing power we give it. Numbers <4 are safe. Beyond that it COULD slow down your machine.(no promises)
   */
  initializeContainers(containerID, maxMemory = defaultMemory, cpus = defaultCPU, silent = true){
    console.log(chalk.green(`[Prometheus] Starting Containers... `));
    shell.exec(`docker build -t ${containerID} ./dockercontainer`, {silent: silent})
    let port = 5000 + this.addToHashSet(parseInt(containerID),portsAllowed);//We only use ports from 5000-5100
    shell.exec(`docker run -d --memory=${maxMemory}m --cpus=${cpus} -p ${port}:5000 ${containerID}`, {silent: silent}) 
    console.log(`${containerID} is listening on port ${port} with memory cap ${maxMemory}m  with cpu availability ${cpus}`)
  }

  /**
   * 
   * @param {Array<number>} containers Array of container IDs we generate
   */
  killContainers(containers, silent = true){
    console.log(chalk.red("[Prometheus] Killing Containers..."));
    containers.forEach((container) => {
        let containerID = container.containerID
        let dockerPsOutput = shell.exec(`docker ps | grep ${containerID} | cut -f 1 -d ' '`, {silent: silent});
        if (dockerPsOutput.code !== 0) {
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

        let imageRemoved = shell.exec(`docker rmi ${containerID} -f`, {silent: silent});
        if (imageRemoved.code !== 0) {
            console.log(chalk.red(`Error removing image ${containerID}| exit code: ${imageRemoved.code}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        // If all operations are successful
        console.log(chalk.grey(`${containerID} was successfully stopped, removed, and image deleted.`));
    })
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