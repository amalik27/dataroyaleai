var shell = require('shelljs');
var chalk = require("chalk");
const EventEmitter = require('events');

const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

const { PrometheusDaemon } = require('./daemon');

class PrometheusDaemonManager {
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier = [10, 20, 50]) {
        this.daemons = new Map();
        this.messageQueue = [];
        this.maxCPU = maxCPU;
        this.maxMemory = maxMemory;
        this.interval = null;
        // Initialize resource monitor with blocks and ports range
        this.database = new DatabaseSystem();
        this.resourceMonitor = new PrometheusResourceMonitor(blocksPerTier, portsAllowed,this.database);
        // Compute resources per block
        this.blockCPU = maxCPU / this.resourceMonitor.blocks;
        this.blockMemory = maxMemory / this.resourceMonitor.blocks;
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
                if(message.type = "START"){
                    try{
                        this.#spawnNewDaemon(message.body);
                    } catch (e){
                        console.log(e);
                    }
                    this.messageQueue.shift() //Dequeue
                }
                //Display usage:
                this.resourceMonitor.displayUsage();
            }
          }, intervalTime);
        }
    }

    //Daemon functions
    #spawnNewDaemon(parameters) {
        //Try allocations. If we fail, we deallocate and throw an error.
        if (this.daemons[parameters.processID]) {
            throw new Error(chalk.red(`Daemon with process ID ${parameters.processID} is already registered`));
        }
        
        let ports = [];
        try{
            ports = this.resourceMonitor.allocateProcess(parameters);
        } catch(e){
            throw e;
        }
        //Allocations succeed, move on.
        const daemon = new PrometheusDaemon(ports, parameters.cpu, parameters.memory, parameters.processID, parameters.uptime);
        daemon.startMonitoring(parameters.interval);
        this.#registerDaemon(parameters.processID, daemon);

        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[Prometheus] Daemon child ${parameters.processID} died with status ${code}`));
            //TODO: Replace this line with a more thorough this.cleanUp() function that deals with all aspects of removing a process.
            this.daemons.delete(parameters.processID);
          });
        //TODO:Overload callback function
    }

    #killProcessDaemon(processID) {
        // Implement the logic to kill a specific process daemon
        const daemon = this.daemons.get(processID);
        if (daemon) {
            daemon.shutDown();
            this.#unregisterDaemon(processID);
        }
    }

    addMessageToQueue(message) {
        this.messageQueue.push(message);
        // Sort the queue first by tier and then by priority within each tier
        this.messageQueue.sort((a, b) => {
            if (a.tier === b.tier) {
                return a.priority - b.priority;
            }
            return a.tier - b.tier;
        });
    }

    /**
     * @param {PrometheusDaemon} process
     */
    initializeContainer(processID,container) {
      // Logic to start a process on a daemon
      const daemon = this.daemons.get(processID);
      if (daemon) {
          // Initialize containers with the required resources
          daemon.containerQueue.enqueue({cpus:container.cpus, memory:container.memory},container.priority,container.containerID,container.model);
      } else {
          throw new Error(`No daemon found with process ID ${processID}`);
      }
    }

    forward(processID, apiEndpoint) {
      // Logic to reroute API calls to specific processes
      const daemon = this.daemons[processID];
      if (daemon) {
          // This function assumes an API routing system is in place
          // The system should be set up to handle API endpoint redirection
          daemon.forward(processID, apiEndpoint);
          console.log(`API calls for process ${processID} are now being routed to ${apiEndpoint}`);
      } else {
          throw new Error(`No daemon found with process ID ${processID} for rerouting API calls`);
      }
    }

    #registerDaemon(processID, daemon) {
      if (!this.daemons[processID]) {
          this.daemons.set(processID, daemon);
          console.log(`Daemon registered with process ID ${processID}`);
      } else {
          throw new Error(`Daemon with process ID ${processID} is already registered`);
      }
    }

    #unregisterDaemon(processID) {
      if (this.daemons[processID]) {
          delete this.daemons[processID];
          console.log(`Daemon unregistered with process ID ${processID}`);
      } else {
          throw new Error(`No daemon found with process ID ${processID} for unregistering`);
      }
    }
}


//Class for tracking compute blocks and their usage. This class should be used to track how many compute blocks are being used by each user, and how many are available.
class PrometheusResourceMonitor extends EventEmitter {
    constructor(blocksPerTier = [60, 30, 10], portsRange, database) {
        super();
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
        console.log(chalk.green(`[Prometheus Resource Monitor] Process ID ${parameters.processID} allocated ${parameters.ports} ports and ${this.database.getTierResources(this.database.getUserTier(parameters.processID)).guarantee} blocks`));
        return ports;
    }

    //PORT LOGIC
    allocatePorts(N, processID) {
        if (this.portMap.size + N > this.availablePorts.size) {
            throw new Error(chalk.red("Not enough free ports available"));
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
            throw new Error(`Process ID ${processID} not found in port mapping.`);
        }
    }

    /**
     * If we set isSpawn to true, we are allocating blocks for a new process. If false, we are allocating blocks for overload.
     */
    allocateBlocks(isSpawn = false, processID) {
        const userTierInfo = this.database.getTierResources(this.database.getUserTier(processID));
        if (!userTierInfo) {
            throw new Error(`User tier information for process ID ${processID} not found.`);
        }

        // For spawning, allocate all G blocks. Successful spawn will return processID.
        if (isSpawn) {
            let blocksToAllocate = userTierInfo.guarantee;
            // Check if sufficient blocks are available in user tier
            
            //Calculate blocks used by same tier users
            let sameTierUsers = Array.from(this.usage).filter((id) => {
                this.database.getUserTier(processID) === this.database.getUserTier(id);
            });
            let blocksUsedBySameTier = 0;
            sameTierUsers.forEach((id) => {
                blocksUsedBySameTier += this.usage.get(id).guaranteed;
                blocksUsedBySameTier += this.usage.get(id).overload;
            });
            //If we do not have enough resources, we allocate overload blocks
            if (this.blocks - blocksUsedBySameTier < blocksToAllocate) {
                let sameTierUsersInOverload = this.overloadDeallocationQueue.filter((id) => {
                    this.database.getUserTier(processID) === this.database.getUserTier(id);
                });
                if(sameTierUsersInOverload.length == 0){
                    throw new Error(`Not enough blocks available to spawn process ID ${processID}`);
                } else {
                    //We keep deallocating overload blocks until we have enough to spawn the process
                    while(sameTierUsersInOverload.length > 0 && blocksToAllocate > 0){
                        blocksToAllocate = this.deallocateOverloadBlocks(sameTierUsersInOverload[0],blocksToAllocate);
                    }
                    //If we could not deallocate enough blocks, we throw an error
                    if(blocksToAllocate > 0){
                        throw new Error(`Not enough blocks available to spawn process ID ${processID}`);
                    } else {
                        this.usage.set(processID, { guaranteed: userTierInfo.guarantee, overload: 0 });
                        return processID;
                    }
                }
            } else{
                this.usage.set(processID, { guaranteed: blocksToAllocate, overload: 0 });
                return processID;
            }  
        } else { //For Overload. Successful allocation will return processID.
            let blocksToAllocate = userTierInfo.overload;
            // Check if sufficient blocks are available in user tier or below
            //Calculate blocks used by same tier users or lower tier users by calling getTierIDs, filter by tiers lower than user tier.
            let sameOrLowerUsers = Array.from(this.usage).filter((id) => {
                this.database.getUserTier(processID) >= this.database.getUserTier(id);
            });
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
                    throw new Error(`Not enough blocks available to allocate overload for process ID ${processID}`);
                } else {
                    //We keep deallocating overload blocks until we have enough to allocate all of the overload blocks
                    while(sameOrLowerUsersInOverload.length > 0 && blocksToAllocate > 0){
                        blocksToAllocate = this.deallocateOverloadBlocks(sameOrLowerUsersInOverload[0],blocksToAllocate);
                    }
                    //If we could not deallocate enough blocks, we throw an error
                    if(blocksToAllocate > 0){
                        throw new Error(`Not enough blocks available to allocate overload for process ID ${processID}`);
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

    deallocateOverloadBlocks(processID,blocks) {
        if (!this.usage.has(processID)) {
            throw new Error(`Process ID ${processID} not found in block usage tracking.`);
        }
        if(this.usage.get(processID).overload <= blocks && this.usage.get(processID).overload > 0){
            removedBlocks = blocks - this.usage.get(processID).overload;
            this.usage.get(processID).overload = 0;
            blocks -= removedBlocks;
        }
        return blocks;
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
        throw new Error(`Process ID ${processID} not found in block usage tracking.`);
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
        this.addUser("testProcess", 1);
        this.addUser("user2", 2);
        this.addUser("user3", 3);
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



module.exports = { PrometheusDaemonManager };

  
  

