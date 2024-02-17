var shell = require('shelljs');
var chalk = require("chalk");
const rl = require('readline-sync');
const EventEmitter = require('events');


//Program-level constants
const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu
const _ = undefined;

//TESTING

//TODO: Create new function using `docker container ls --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}" -a` to return true or false if a given port is taken.


let containerIDs = ["7295434","34554466","6857458"]

class PrometheusDaemon{
  

  constructor(portsAllowed, maxCPU = .05, maxMemory = 300){
    this.ports = new Array(portsAllowed);
    this.containerQueue = new ContainerQueue()
    this.containerStack = new ContainerStack(maxCPU,maxMemory)
    this.interval = null
    

    console.log(chalk.green("[Prometheus] Initialized Daemon. Prometheus is watching for updates..."));
  }

  startMonitoring(intervalTime) {
    if (!this.interval) {
      this.interval = setInterval(() => {
        if (!this.containerQueue.isEmpty()) {
          //Call HW-Limit-Aware-Start-System
          let container = this.containerQueue.dequeue();//TODO: Pass in anonymous function to handle the queue and dequeue based on success of function via try catch error handling.
          //this.#initializeContainers([containerID]);
          try{
            this.containerStack.push(container.containerID,container.parameters);
          }catch(e){
            console.log(chalk.yellow(`[Prometheus] Reached hardware limit when attempting to initialize new container ${container.toString()} on queue...`));
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
  addToHashSet(number,portsAllowed) {
    /// Function to calculate the hash value for a given number

    let index = number % portsAllowed;
    
    // Check if the slot is empty, if not, probe linearly until an empty slot is found
    while (this.ports[index] !== undefined) {
      console.log(ports[index]);
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
  initializeContainers(userIDs, maxMemory = defaultMemory, cpus = defaultCPU, silent = true){
    console.log(chalk.green("[Prometheus] Starting Containers..."));
    userIDs.forEach((user)=>{
      shell.exec(`docker build -t ${user} ./dockercontainer`, {silent: silent})
    })
    userIDs.forEach((user)=>{ 
        let port = 5000 + this.addToHashSet(parseInt(user),portsAllowed);//We only use ports from 5000-5100
        shell.exec(`docker run -d --memory=${maxMemory}m --cpus=${cpus} -p ${port}:5000 ${user}`, {silent: silent}) 
        console.log(`${user} is listening on port ${port} with memory cap ${maxMemory}m  with cpu availability ${cpus}`)
    })
  }

  /**
   * 
   * @param {Array<number>} containers Array of container IDs we generate
   */
  killContainers(containers, silent = true){
    console.log(chalk.red("[Prometheus] Killing Containers..."));
    containers.forEach((user)=>{
        let containerID = shell.exec(`docker ps | grep ${user} | cut -f 1 -d ' ' `, {silent: silent})
        //console.log(containerID);
        //Operations
        var containerStopped = shell.exec(`docker stop ${containerID}`, {silent: silent}); 
        var containerRemoved = shell.exec(`docker container rm ${containerID}`, {silent: silent}); 
        var imageRemoved = shell.exec(`docker rmi ${user} -f`, {silent: silent});
        var sucess = true;
        // console.log(containerStopped);
        // console.log(containerRemoved);
        // console.log(imageRemoved);
        //Console Feedback
        if(sucess){
          console.log(chalk.grey(`${user} was killed`));
        } else{  
          console.log(chalk.red(`Error - ${user} failed following operations: ${containerStopped ? '' : 'STOP_CONTAINER '} ${containerRemoved ? '' : 'REMOVE_CONTAINER '} ${imageRemoved ? '' : 'REMOVE_IMAGE '}`));

        }
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

  push(containerID, parameters) {
    const { cpu, memory } = parameters;

    // Check if pushing this container exceeds CPU or memory limits
    if (this.currentCPU + cpu <= this.maxCPU && this.currentMemory + memory <= this.maxMemory) {
      this.stack.push({ containerID, parameters });
      this.currentCPU += cpu;
      this.currentMemory += memory;
    } else {
      throw new Error("Push failed. Exceeds CPU or memory limits.");
    }
  }

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
    this.itemMap = new Map(); // Map to store unique IDs and their items
  }

  /**
   * 
   * @param {number} priority 
   * @param {number} containerID 
   */
  enqueue(parameters,priority=1, containerID) {
    console.log(`Enqueue: ${containerID}}`)
    if (!this.itemMap.has(containerID)) {
      this.queue.push({containerID: containerID, priority: priority});
      this.queue.sort((a, b) => a.priority - b.priority);
      this.itemMap.set(containerID, parameters);
    }
  }

  dequeue() {
    if (!this.isEmpty()) {
      const containerID  = this.queue.shift().containerID;
      const parameters = this.itemMap.get(containerID);
      this.itemMap.delete(containerID);

      console.log(`Dequeue: ${containerID}`)
      return {containerID:containerID,parameters:parameters, toString: () => console.log(`{containerID:${containerID}, parameters: ${parameters} }`)};
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

daemon = new PrometheusDaemon()
daemon.startMonitoring(500)
containerIDs.forEach((id)=>{
  console.log(chalk.gray("Enqueuing " + id.toString()))
  daemon.containerQueue.enqueue({cpus:.2, memory:100, toString: ()=>console.log(`{cpu: ${this.cpu}, memory: ${this.memory}}`)},1,id)
})


process.on('SIGINT', () => {
  console.log(chalk.red("[Prometheus] Shutdown signal recieved, performing cleanup."));
  
  daemon.stopMonitoring();
  daemon.killContainers(containerIDs);
  process.exit(0); // Exit with status code 0 (success)
});