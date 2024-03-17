var shell = require('shelljs');
var chalk = require("chalk");
const EventEmitter = require('events');

const { PlatformDaemon , Container } = require('./platformDaemon');

//Debug function for getting overall system state and packing it into a JSON object
function getSystemState(manager) {
    let state = {};
    state.daemons = {};
    //Check if we have any daemons
    if(manager.daemons.size > 0){
        //Iterate over daemons
        manager.daemons.forEach((daemon,processID) => {
            state.daemons[processID] = {};
            state.daemons[processID].cpu = daemon.containerStack.getMaxCPU().toFixed(2);
            state.daemons[processID].memory = daemon.containerStack.getMaxMemory().toFixed(2);
            state.daemons[processID].uptime = daemon.uptime;
            state.daemons[processID].overload = daemon.getOverload();
            //Overload uptime
            if(daemon.getOverload()){
                state.daemons[processID].overloadUptime = daemon.getOverloadUptime();
            }
            //Check containerStack of each daemon
            state.daemons[processID].containerStack = {};
            daemon.containerStack.stack.forEach((container) => {
                state.daemons[processID].containerStack[container.containerID] = {};
                state.daemons[processID].containerStack[container.containerID].containerID = container.containerID;
                state.daemons[processID].containerStack[container.containerID].cpu = container.cpu;
                state.daemons[processID].containerStack[container.containerID].memory = container.memory;
                state.daemons[processID].containerStack[container.containerID].model = container.model;
            });
        });
    
    }
    //Include queue
    state.messageQueue = manager.messageQueue;


    //Check resource monitor
    state.resourceMonitor = {};
    state.resourceMonitor.blocksPerTier = manager.resourceMonitor.blocksPerTier;
    state.resourceMonitor.overloadDeallocationQueue = manager.resourceMonitor.overloadDeallocationQueue;
    state.resourceMonitor.availablePorts = manager.resourceMonitor.availablePorts;
    state.resourceMonitor.portMap = manager.resourceMonitor.portMap;
    //Get usage
    state.resourceMonitor.usage = manager.resourceMonitor.displayUsageJSON();
    return state;
}



class PlatformDaemonManager {
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier,name = "Prometheus") {
        this.name = name
        this.daemons = new Map();
        this.messageQueue = [];
        this.messageHistory = [];
        this.maxCPU = maxCPU;
        this.maxMemory = maxMemory;
        this.interval = null;
        // Initialize resource monitor with blocks and ports range
        this.database = new DatabaseSystem();
        this.resourceMonitor = new PlatformResourceMonitor(blocksPerTier, portsAllowed,this.database);
        //Listen for deallocation events
        this.resourceMonitor.on('overloadDeallocated', (processID,blocks) => {
            //We deallocate the blocks from the process
            this.setProcessResources(processID, this.resourceMonitor.usage.get(processID).guaranteed + this.resourceMonitor.usage.get(processID).overload - blocks);
            //We remove the process from the deallocation queue
            this.resourceMonitor.overloadDeallocationQueue = this.resourceMonitor.overloadDeallocationQueue.filter(id => id !== processID);
        });
        // Compute resources per block
        this.blockCPU = (maxCPU / this.resourceMonitor.blocks).toFixed(2);
        this.blockMemory = (maxMemory / this.resourceMonitor.blocks).toFixed(2);
    }
    


    //Needed for continuous monitoring of the queue asynchronously, allowing for reshuffles.
    startMonitoring(intervalTime) {
        if (!this.interval) {
          this.interval = setInterval(() => {
            if (this.messageQueue.length!=0) {
                //MAKE SURE TO DQ MESSAGE IF WE ACT ON IT
                
                let message = this.messageQueue[0];//Peek
                
                //Check message type, do stuff
                //System Message Stuff Here...

                //Allocation Requests Here...

                //Start Container Request Here...
                if(message.type === "OVERLOAD"){
                    //Allocate overload blocks
                    try{
                        this.allocateOverloadBlocks(message.body.processID);
                        //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof OverloadResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                            this.messageHistory.push(message);
                        } else{
                            console.log(e.message);
                        }
                    }
                }
                if(message.type === "START"){
                    try{
                        this.spawnNewDaemon(message.body);
                         //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof GuaranteeResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                        } else{
                            console.log(e.message);
                            this.messageQueue.shift();
                            message.status = "FAILED";
                            this.messageHistory.push(message);
                        }
                    } 
                    
                }
                //message queue length
                console.log(chalk.blue(`[${this.name}] Message queue length: ${this.messageQueue.length}`));
            }
          }, intervalTime);
        }
    }

    /**
     * You're probably wondering what this function does. It adds a message to the queue. 
     * Hilarious, right? But it's not just any message. It's a message that will be processed by the system.
     * Oh what's that? Do you need me to be more descriptive? Fine.
     * This function adds a message to the queue. The message is then processed by the system.
     * @param {Object} message
     * @returns {String} The unique ID of the message
     * 
     * This function will automatically sort the queue by priority when it adds a message.
     */
    addMessageToQueue(message) {
        //Add unique ID to message, make sure it is somehow unique.
        message.id = Math.random().toString(36).substr(2, 9) 
        message.status = "QUEUED";
        this.messageQueue.push(message);
        // Sort the queue first by tier and then by priority within each tier
        this.messageQueue.sort((a, b) => {
            if (a.tier === b.tier) {
                return a.priority - b.priority;
            }
            return a.tier - b.tier;
        });
        return message.id;
    }

    //Fetch message status from either the queue or the history
    fetchMessageStatus(id) {
        let message = this.messageQueue.find((message) => message.id === id);
        if (message) {
            //Find place in line
            let place = this.messageQueue.indexOf(message);
            return {status: message.status,place: place};
        }
        message = this.messageHistory.find((message) => message.id === id);
        if (message) {
            return message.status;
        }
        return "Message not found";
    }
   
    /**
     * @param {PlatformDaemon} process
     */
    initializeContainer(processID,container) {
      // Logic to start a process on a daemon
      if (this.daemons.get(processID)) {
          this.daemons.get(processID).initializeContainer(container);
      } else {
          throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
      }
    }

    //Health check on a container in a process
    async healthCheck(processID, containerID) {
        if (this.daemons.get(processID)) {
            let ret;
            await this.daemons.get(processID).checkContainerHealth(containerID).then(data => {
                ret = data;                
            }); 
            return ret;
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID} for health check`);
        }
    }

    /**
     * NOT TO BE CALLED DIRECTLY
     * Any requests to spawn a new daemon should be made through the message queue.
     * For more information, see addMessageToQueue
     * @param {Object} parameters
     */
    spawnNewDaemon(parameters) {
        //Try allocations. If we fail, we deallocate and throw an error
        if (this.daemons.get(parameters.processID)) {
            throw new AlreadyRegisteredError(chalk.red(`Daemon with process ID ${parameters.processID} is already registered`));
        }
        
        let ports = [];
        try{
            ports = this.resourceMonitor.allocateProcess(parameters);
        } catch(e){
            throw e;
        }
        //Allocations succeed, move on.
        //Create new daemon with the guarantee blocks asssigned to it based on its tier
        const daemon = new PlatformDaemon(ports, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockCPU, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockMemory, parameters.processID, parameters.uptime, 3);
        daemon.startMonitoring(parameters.interval);
        this.#registerDaemon(parameters.processID, daemon);

        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[${this.name}] Daemon child ${parameters.processID} died with status ${code}`));
            //Print daemons
            
            console.log(chalk.gray(`[${this.name}] Daemons: ${Array.from(this.daemons.keys())}`));
            this.#unregisterDaemon(parameters.processID);
            this.resourceMonitor.processExitCleanup(parameters.processID);
          });
        //TODO:Overload callback function
        daemon.on('overload-exit', () => {
            console.log(chalk.blue(`[${this.name}] Daemon child ${parameters.processID} has exited overload mode. Awaiting resource reassignment.`));
            this.resourceMonitor.overloadDeallocationQueue.push(parameters.processID);
          });
    }

    killProcessDaemon(processID) {
        if (this.daemons.get(processID)) {
            this.daemons.get(processID).shutdown();
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
    }

    //Set Process Resources, take in processID and blocks, and set the process's resources
    setProcessResources(processID, blocks) {
        if (this.daemons.get(processID)) {
            //Convert blocks to cpu and memory
            let cpu = blocks * this.blockCPU;
            let memory = blocks * this.blockMemory;
            this.daemons.get(processID).setResourceLimits(cpu, memory);
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
    }

    //Try to allocate overload blocks to a process
    allocateOverloadBlocks(processID) {
        if (this.daemons.get(processID)) {
            //Try allocate, catch and pass through error if failed
            try{
                //Allocate overload blocks
                this.resourceMonitor.allocateBlocks(false, processID);
                //Set resources
                this.setProcessResources(processID, this.resourceMonitor.usage.get(processID).guaranteed + this.resourceMonitor.usage.get(processID).overload);
                //Enable overload in process so its internal timer begins
                this.daemons.get(processID).enableOverload();
            } catch(e){
                throw e;
            }
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
    }
   

    //Kill container in daemon
    async killContainer(processID,containerID) {
        if (this.daemons.get(processID)) {
            return await this.daemons.get(processID).killContainer(containerID);
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
    }

    //Forward API calls to container
    async forward(processID, containerID, body) {
      // Logic to reroute API calls to specific processes
      
      if (this.daemons.get(processID)) {
          // This function assumes an API routing system is in place
          // The system should be set up to handle API endpoint redirection
          let ret = "";
          await this.daemons.get(processID).forward({processID:processID, containerID:containerID, body:body},'127.0.0.1').then(data => {
                
                ret =  data;
            });
            return ret;
      } else {
          throw new DaemonNotFoundError(`No daemon found with process ID ${processID} for rerouting API calls`);
      }
    }

    //Register and unregister daemons
    #registerDaemon(processID, daemon) {
      if (!this.daemons[processID]) {
          this.daemons.set(processID, daemon);
          console.log(chalk.green(`[${this.name}] Daemon registered with process ID ${processID}`));
      } else {
          throw new AlreadyRegisteredError(`[${this.name}] Daemon with process ID ${processID} is already registered`);
      }
    }

    #unregisterDaemon(processID) {
      if (this.daemons.get(processID)) {
          this.daemons.delete(processID);
          console.log(`Daemon unregistered with process ID ${processID}`);
      } else {
          throw new DaemonNotFoundError(`No daemon found with process ID ${processID} for unregistering`);
      }
    }

    
}

//Class for tracking compute blocks and their usage. This class should be used to track how many compute blocks are being used by each user, and how many are available.
class PlatformResourceMonitor extends EventEmitter {
    name
    constructor(blocksPerTier, portsRange, database,name) {
        super();
        this.name = name;
        this.blocksPerTier = blocksPerTier;
        this.blocks = blocksPerTier.reduce((a, b) => a + b, 0);
        //After a process has finished its overload period, we place it on the deallocation queue. This happens via event emitters. The process will signal that its overload period finished. Analogous to a garbage collector of sorts.
        this.overloadDeallocationQueue = []; //Contains ProcessIDs
        this.usage = new Map(); // Tracks used blocks by processID
        this.database = database; // Reference to the DatabaseSystem
        
        // Manage ports
        this.availablePorts = new Set();
        for (let port = 5000; port < 5000 + portsRange; port++) {
            this.availablePorts.add(port);
        }
        this.portMap = new Map();
    }
    
    //Displays the current usage of blocks and ports by process, visually by tier. Get tiers and show usage.
    displayUsage() {
        const tiers = this.database.getTierIDs();
        tiers.forEach(tier => {
            const users = Array.from(this.usage).filter((id) => {
                this.database.getUserTier(id) === tier;
            });
            console.log(chalk.cyan(`Tier ${tier} usage:`));
            users.forEach((id) => {
                console.log(chalk.blue(`Process ID: ${id}, Blocks: ${this.usage.get(id).guaranteed + this.usage.get(id).overload}`));
                //ports
                if (this.portMap.has(id)) {
                    console.log(chalk.blue(`Ports: ${this.portMap.get(id)}`));
                }
            });
            
        });
    }

    //display Usage but return everything as a JSON object
    displayUsageJSON() {
        console.log(JSON.stringify(Array.from(this.usage)))
        return Array.from(this.usage);
    }

    allocateProcess(parameters) {
        let ports = [];
        try{
            ports = this.allocatePorts(parameters.ports, parameters.processID);
            this.allocateBlocks(true, parameters.processID);
        } catch(e){
            //If we fail to allocate, we deallocate the ports and throw an error
            try{
                this.removeProcessFromPortMap(parameters.processID);
            } catch{
                console.log(chalk.red("Error deallocating ports"));
            }
            throw e;
        }
        console.log(chalk.green(`[${this.name} Resource Monitor] Process ID ${parameters.processID} allocated ${parameters.ports} ports and ${this.database.getTierResources(this.database.getUserTier(parameters.processID)).guarantee} blocks`));
        return ports;
    }

    //Remove user from usage map and deallocation queue, and deallocate ports. This is done when a process is finished.
    processExitCleanup(processID) {
        if (this.usage.has(processID)) {
            const { guaranteed, overload } = this.usage.get(processID);
            this.usage.delete(processID);
            this.removeProcessFromPortMap(processID);
            this.overloadDeallocationQueue = this.overloadDeallocationQueue.filter(id => id !== processID);
            return { guaranteed, overload };
        }
        throw new DaemonNotFoundError(`Process ID ${processID} not found in block usage tracking.`);
    }

    //PORT LOGIC
    allocatePorts(N, processID) {
        if (this.portMap.size + N > this.availablePorts.size) {
            throw new ResourceAllocationError(chalk.red("Not enough free ports available"));
        }
        const allocatedPorts = Array.from(this.availablePorts).slice(0, N);
        allocatedPorts.forEach(port => this.availablePorts.delete(port));
        this.portMap.set(processID, allocatedPorts);
        return allocatedPorts;
    }
    removeProcessFromPortMap(processID) {
        if (this.portMap.has(processID)) {
            const allocatedPorts = this.portMap.get(processID);
            allocatedPorts.forEach(port => this.availablePorts.add(port));
            this.portMap.delete(processID);
        } else {
            throw new DaemonNotFoundError(`Process ID ${processID} not found in port mapping.`);
        }
    }

    /**
     * If we set isSpawn to true, we are allocating blocks for a new process. If false, we are allocating blocks for overload.
     */
    allocateBlocks(isSpawn = false, processID) {
        const userTierInfo = this.database.getTierResources(this.database.getUserTier(processID));
        if (!userTierInfo) {
            throw new ResourceNotFoundError(`User tier information for process ID ${processID} not found.`);
        }

        // For spawning, allocate all G blocks. Successful spawn will return processID.
        if (isSpawn) {
            let blocksToAllocate = userTierInfo.guarantee;
            // Check if sufficient blocks are available in user tier
            
            //Calculate blocks used by same tier users
            let sameTierUsers = Array.from(this.usage)
            .filter(([key, _]) => 
                this.database.getUserTier(processID) === this.database.getUserTier(key)
            )
            .map(([key, _]) => key);
            let blocksUsedBySameTier = 0;
            sameTierUsers.forEach((id) => {
                blocksUsedBySameTier += this.usage.get(id).guaranteed;
                blocksUsedBySameTier += this.usage.get(id).overload;
            });
            //console.log(`Total blocks in this tier: ${this.blocksPerTier[this.database.getUserTier(processID)-1]}. Blocks being used by same tier users: ${blocksUsedBySameTier}. Blocks to allocate: ${blocksToAllocate}. Blocks available: ${this.blocksPerTier[this.database.getUserTier(processID)-1] - blocksUsedBySameTier}. We need more blocks than available: ${blocksToAllocate > this.blocksPerTier[this.database.getUserTier(processID)-1] - blocksUsedBySameTier}`);
            //If we do not have enough resources, we allocate overload blocks
            if (this.blocksPerTier[this.database.getUserTier(processID)-1] - blocksUsedBySameTier < blocksToAllocate) {
                let sameTierUsersInOverload = this.overloadDeallocationQueue.filter((id) => 
                    this.database.getUserTier(processID) === this.database.getUserTier(id)
                )
                if(sameTierUsersInOverload.length == 0){
                    throw new GuaranteeResourceAllocationError(`Not enough blocks available to spawn process ID ${processID}`);
                } else {
                    
                    //We keep deallocating overload blocks until we have enough to spawn the process
                    while(sameTierUsersInOverload.length > 0 && blocksToAllocate > 0){
                        blocksToAllocate = this.deallocateOverloadBlocks(sameTierUsersInOverload[0],blocksToAllocate);
                        sameTierUsersInOverload.shift();
                    }
                    //If we could not deallocate enough blocks, we throw an error
                    if(blocksToAllocate > 0){
                        throw new GuaranteeResourceAllocationError(`Not enough blocks available to spawn process ID ${processID}`);
                    } else {
                        this.usage.set(processID, { guaranteed: userTierInfo.guarantee, overload: 0 });
                        return processID;
                    }
                }
            } else{
                this.usage.set(processID, { guaranteed: blocksToAllocate, overload: 0 });
                console.log(this.usage);
                return processID;
            }  
        } else { //For Overload. Successful allocation will return processID.
            let blocksToAllocate = userTierInfo.overload;
            // Check if sufficient blocks are available in user tier or below
            //Calculate blocks used by same tier users or lower tier users by calling getTierIDs, filter by tiers lower than user tier.
            let sameOrLowerUsers = Array.from(this.usage)
            .filter(([key, _]) => {
                this.database.getUserTier(processID) >= this.database.getUserTier(key);
            })
            .map(([key, _]) => key);
            //Calculate blocks used by users whose tiers are in usableTiers
            let blocksUsedByUsableTiers = 0;
            sameOrLowerUsers.forEach((id) => {
                blocksUsedByUsableTiers += this.usage.get(id).guaranteed;
                blocksUsedByUsableTiers += this.usage.get(id).overload;
            });
            //Do we have enough?
            if (this.blocks - blocksUsedByUsableTiers < blocksToAllocate) {
                let sameOrLowerUsersInOverload = this.overloadDeallocationQueue.filter((id) => {
                    this.database.getUserTier(processID) >= this.database.getUserTier(id);
                });
                if(sameOrLowerUsersInOverload.length == 0){
                    throw new OverloadResourceAllocationError(`Not enough blocks available to allocate overload for process ID ${processID}`);
                } else {
                    //We keep deallocating overload blocks until we have enough to allocate all of the overload blocks
                    while(sameOrLowerUsersInOverload.length > 0 && blocksToAllocate > 0){
                        blocksToAllocate = this.deallocateOverloadBlocks(sameOrLowerUsersInOverload[0],blocksToAllocate);
                        sameOrLowerUsersInOverload.shift();
                        console.log(sameOrLowerUsersInOverload);
                    }
                    //If we could not deallocate enough blocks, we throw an error
                    if(blocksToAllocate > 0){
                        throw new OverloadResourceAllocationError(`Not enough blocks available to allocate overload for process ID ${processID}`);
                    } else {
                        this.usage.get(processID).overload += userTierInfo.overload;
                        return processID;
                    }  
                }
            } else{
                this.usage.get(processID).overload += userTierInfo.overload;
                return processID;
            }   
            
        }

    }

    //Used for when we are tight on resources
    deallocateOverloadBlocks(processID,blocks) {
        if (!this.usage.has(processID)) {
            throw new DaemonNotFoundError(`Process ID ${processID} not found in block usage tracking.`);
        }
        let removedBlocks = blocks - this.usage.get(processID).overload;
        this.usage.get(processID).overload = 0;
        blocks -= removedBlocks;
        
        //Emit event to deallocate blocks
        this.emit('overloadDeallocated', processID,removedBlocks);
        return blocks;
    }

    calculateTotalUsedBlocks() {
        let totalUsed = 0;
        this.usage.forEach(({ guaranteed, overload }) => {
            totalUsed += guaranteed + overload;
        });
        return totalUsed;
    }
}

//Class to mock a database, for testing purposes. Holds information about how many compute blocks are allowed for each subscription tier's user. There are 3 tiers:
//1. 20 Guarantee, 10 overload, 30 seconds of overload time
//2. 10 Guarantee, 5 overload 10 seconds of overload time
//3. 5 Guarantee, No overload, no overload time
//This class should hold the tiers in one map with the information, and users in another map with a parameter for their tiers
class DatabaseSystem {
    constructor() {
        this.tiers = new Map();
        this.users = new Map();
        //Add tiers and users
        this.addTier(1, 20, 10, 30);
        this.addTier(2, 10, 5, 10);
        this.addTier(3, 5, 0, 0);
        this.addUser("user0", 1);
        this.addUser("user1", 1);
        this.addUser("user2", 2);
        this.addUser("user3", 2);
        this.addUser("user4", 2);
        this.addUser("user5", 3);
        this.addUser("user6", 3);
        this.addUser("user7", 3);
        this.addUser("user8", 3);
        this.addUser("user9", 3);
    }

    addTier(tier, guarantee, overload, time) {
        this.tiers.set(tier, { guarantee, overload, time });
    }

    addUser(username, tier) {
        this.users.set(username, tier);
    }

    getUserTier(username) {
        return this.users.get(username);
    }

    getTierResources(tier) {
        return this.tiers.get(tier);
    }

    getTierIDs() {
        return Array.from(this.tiers.keys());
    }

}

//ERRORS because proper error coding makes this so much easier
class AlreadyRegisteredError extends Error {
    constructor(message) {
        super(message);
        this.name = "AlreadyRegisteredError";
    }
}
class DaemonNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "DaemonNotFoundError";
    }
}
class ResourceNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "DaemonNotFoundError";
    }
}
class ResourceAllocationError extends Error {
    constructor(message) {
      super(message);
      this.name = "ResourceAllocationError";
    }
  }

class GuaranteeResourceAllocationError extends ResourceAllocationError {
    constructor(message) {
        super(message);
        this.name = "GuaranteeResourceAllocationError";
    }
}

class OverloadResourceAllocationError extends ResourceAllocationError {
    constructor(message) {
        super(message);
        this.name = "OverloadResourceAllocationError";
    }
}

module.exports = { PlatformDaemonManager , getSystemState, DaemonNotFoundError, DatabaseSystem};

  
  

