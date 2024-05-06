var shell = require('shelljs');
var chalk = require("chalk");
const EventEmitter = require('events');
const mysql = require('mysql');
const util = require('util');
const db = require('../backend/db.js')
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
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier,name = "Prometheus", databaseSystem =new DatabaseSystem(), resourceMonitor = PlatformResourceMonitor) {
        this.name = name
        this.daemons = new Map();
        this.messageQueue = [];
        this.messageHistory = [];
        this.maxCPU = maxCPU;
        this.maxMemory = maxMemory;
        this.interval = null;
        // Initialize resource monitor with blocks and ports range
        this.database = databaseSystem
        this.resourceMonitor = new resourceMonitor(blocksPerTier, portsAllowed,this.database, this.name);
        //Listen for deallocation events
        this.resourceMonitor.on('overloadDeallocated', (processID,blocks) => {
            //We deallocate the blocks from the process
            this.setProcessResources(processID, this.resourceMonitor.usage.get(processID).guaranteed);
            //We remove the process from the deallocation queue
            this.resourceMonitor.overloadDeallocationQueue = this.resourceMonitor.overloadDeallocationQueue.filter(id => id !== processID);
        });
        // Compute resources per block
        this.blockCPU = (maxCPU / this.resourceMonitor.blocks).toFixed(2);
        this.blockMemory = (maxMemory / this.resourceMonitor.blocks).toFixed(2);
    }
    


    //Needed for continuous monitoring of the queue asynchronously, allowing for reshuffles.
    startMonitoring(intervalTime) {
        console.log(chalk.blue(`[${this.name}] Starting monitoring`));
        if (!this.interval) {
          this.interval = setInterval(async () => {
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
                        await this.allocateOverloadBlocks(message.body.processID);
                        //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof OverloadResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                            this.messageHistory.push(message);
                        } else{
                            console.log(chalk.red(`[${this.name} Manager]]FAILURE`))
                            console.log(e.message);
                            this.messageQueue.shift();
                            message.status = "FAILED";
                            this.messageHistory.push(message);
                        }
                    }
                }
                if(message.type === "START"){
                    try{
                        await this.spawnNewDaemon(message.body);
                         //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof GuaranteeResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                        } else{
                            console.log(chalk.red(`[${this.name} Manager]]FAILURE`))
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
        // this.messageQueue.sort((a, b) => {
        //     if (a.tier === b.tier) {
        //         return a.priority - b.priority;
        //     }
        //     return a.tier - b.tier;
        // });
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
     * Initializes a container for a specific process on a daemon.
     * @param {string} processID - The ID of the process.
     * @param {string} container - The container to be initialized.
     * @throws {DaemonNotFoundError} If no daemon is found with the specified process ID.
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
    async spawnNewDaemon(parameters) {
        //Try allocations. If we fail, we deallocate and throw an error
        if (this.daemons.get(parameters.processID)) {
            throw new AlreadyRegisteredError(chalk.red(`Daemon with process ID ${parameters.processID} is already registered`));
        }
        let tier, resources, ports;
        try{
            tier = await this.database.getUserTier(parameters.processID);
            resources = await this.database.getTierResources(tier);
            resources.processID = parameters.processID; //Terrible ik
            ports = await this.resourceMonitor.allocateProcess(resources);
        } catch(e){
            throw e;
        }
        //Allocations succeed, move on.
        //Create new daemon with the guarantee blocks asssigned to it based on its tier
        const daemon = new PlatformDaemon(ports, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockCPU, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockMemory, parameters.processID, resources.time, resources.time/3, this.name);
        daemon.startMonitoring(parameters.interval);
        this.registerDaemon(parameters.processID, daemon);

        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[${this.name}] Daemon child ${parameters.processID} died with status ${code}`));
            //Print daemons
            
            console.log(chalk.gray(`[${this.name}] Daemons: ${Array.from(this.daemons.keys())}`));
            this.unregisterDaemon(parameters.processID);
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
    async allocateOverloadBlocks(processID) {
        if (this.daemons.get(processID)) {
            //Try allocate, catch and pass through error if failed
            try{
                //Allocate overload blocks
                await this.resourceMonitor.allocateBlocks(false, processID);
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
            return await this.daemons.get(processID).killContainers([{containerID:containerID}]);
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
    registerDaemon(processID, daemon) {
      if (!this.daemons[processID]) {
          this.daemons.set(processID, daemon);
          console.log(chalk.green(`[${this.name}] Daemon registered with process ID ${processID}`));
      } else {
          throw new AlreadyRegisteredError(`[${this.name}] Daemon with process ID ${processID} is already registered`);
      }
    }

    unregisterDaemon(processID) {
      if (this.daemons.get(processID)) {
          this.daemons.delete(processID);
          console.log(chalk.gray(`[${this.name} Manager]Daemon unregistered with process ID ${processID}`));
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
            const users = Array.from(this.usage).filter(async (id) => {
                await this.database.getUserTier(id) === tier;
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
        return Array.from(this.usage);
    }

    async allocateProcess(parameters) {
        let ports = [];
        try{
            ports = this.allocatePorts(parameters.ports, parameters.processID);
            await this.allocateBlocks(true, parameters.processID);
        } catch(e){
            //If we fail to allocate, we deallocate the ports and throw an error
            try{
                this.removeProcessFromPortMap(parameters.processID);
            } catch{
                console.log(chalk.red("Error deallocating ports"));
            }
            throw e;
        }
        console.log(chalk.green(`[${this.name} Resource Monitor] Process ID ${parameters.processID} allocated ${parameters.ports} ports and ${parameters.guaranteed} blocks`));
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


    async canAllocateResources(processID, spawnBlocks) {
        const userTier = await this.database.getUserTier(processID);
        const tiers = await this.database.getAllTiers();
        let blocksPerTier = this.blocksPerTier.slice();
    
        // Deduct guaranteed blocks from tiers based on current allocations
        for (const [key, value] of this.usage) {
            const tier = await this.database.getUserTier(key);
            blocksPerTier[tier - 1] -= value.guaranteed;
        }
    
        // Temporarily deduct spawn blocks for the new process from its tier
        blocksPerTier[userTier - 1] -= spawnBlocks;
    
        // Check if temporary deduction resulted in negative blocks, indicating insufficient resources
        if (blocksPerTier[userTier - 1] < 0) return false;
    
        // Adjust overload blocks across tiers, starting from the lowest tier
        for (let tier = tiers.length; tier >= 1; tier--) {
            for (const [key, value] of this.usage) {
                const userCurrentTier = await this.database.getUserTier(key);
                if (userCurrentTier <= tier) {
                    // If a user's tier is equal or lower, consider their overload usage
                    blocksPerTier[tier - 1] -= value.overload;
    
                    // If deducing overload blocks results in negative, attempt to pull from lower tiers if available
                    if (blocksPerTier[tier - 1] < 0 && tier < tiers.length) {
                        // Attempt to pull from a lower tier
                        for (let lowerTier = tier + 1; lowerTier <= tiers.length; lowerTier++) {
                            if (blocksPerTier[lowerTier - 1] + blocksPerTier[tier - 1] >= 0) {
                                // If lower tier can cover the deficit, adjust block counts accordingly
                                blocksPerTier[lowerTier - 1] += blocksPerTier[tier - 1];
                                blocksPerTier[tier - 1] = 0; // Reset the current tier's overload to 0 as it's covered by a lower tier
                                break; // Break after covering the deficit
                            }
                        }
                    }
                }
            }
        }
    
        // If any tier ends up with negative blocks, allocation is not possible
        for (let tier = 1; tier <= tiers.length; tier++) {
            if (blocksPerTier[tier - 1] < 0) {
                return false;
            }
        }
    
        // If the function hasn't returned false by now, allocation is possible
        return true;
    }

    /**
     * If we set isSpawn to true, we are allocating blocks for a new process. If false, we are allocating blocks for overload.
     */
    async allocateBlocks(isSpawn = false, processID) {
        const userTierInfo = await this.database.getTierResources(await this.database.getUserTier(processID));
        if (!userTierInfo) {
            throw new ResourceNotFoundError(`User tier information for process ID ${processID} not found.`);
        }

        // For spawning, allocate all G blocks. Successful spawn will return processID.
        if (isSpawn) {
            let blocksToAllocate = userTierInfo.guaranteed;
            // Check if sufficient blocks are available in user tier
            
            //Calculate blocks used by same tier users
            let sameTierUsers = Array.from(this.usage)
            .filter(async ([key, _]) => 
                await this.database.getUserTier(processID) === await this.database.getUserTier(key)
            )
            .map(([key, _]) => key);
            let blocksUsedBySameTier = 0;
            sameTierUsers.forEach((id) => {
                blocksUsedBySameTier += this.usage.get(id).guaranteed;
                blocksUsedBySameTier += this.usage.get(id).overload;
            });
            


            if (this.blocksPerTier[await this.database.getUserTier(processID)-1] - blocksUsedBySameTier < blocksToAllocate && this.canAllocateResources(processID,blocksToAllocate)) {
                let sameTierUsersInOverload = this.overloadDeallocationQueue.filter(async (id) => 
                    await this.database.getUserTier(processID) === await this.database.getUserTier(id)
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
                        this.usage.set(processID, { guaranteed: userTierInfo.guaranteed, overload: 0 });
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
            .filter(async ([key, _]) => {
                await this.database.getUserTier(processID) >= await this.database.getUserTier(key);
            })
            .map(([key, _]) => key);
            //Calculate blocks used by users whose tiers are in usableTiers
            let blocksUsedByUsableTiers = 0;
            sameOrLowerUsers.forEach((id) => {
                blocksUsedByUsableTiers += this.usage.get(id).guaranteed;
                blocksUsedByUsableTiers += this.usage.get(id).overload;
            });
            //Do we have enough?
            console.log(`WE HAVE ENOUGH BLOCKS: ${this.blocks - blocksUsedByUsableTiers >= blocksToAllocate}, ${this.blocks}, ${blocksUsedByUsableTiers}, ${blocksToAllocate}`)
            console.log(sameOrLowerUsers);
            console.log(blocksUsedByUsableTiers);
            if (this.blocks - blocksUsedByUsableTiers < blocksToAllocate) {
                let sameOrLowerUsersInOverload = this.overloadDeallocationQueue.filter(async (id) => {
                    await this.database.getUserTier(processID) >= await this.database.getUserTier(id);
                });
                if(sameOrLowerUsersInOverload.length == 0){
                    throw new OverloadResourceAllocationError(`Not enough blocks available to allocate overload for process ID ${processID}`);
                } else {
                    //We keep deallocating overload blocks until we have enough to allocate all of the overload blocks
                    while(sameOrLowerUsersInOverload.length > 0 && blocksToAllocate > 0){
                        blocksToAllocate = this.deallocateOverloadBlocks(sameOrLowerUsersInOverload[0],blocksToAllocate);
                        sameOrLowerUsersInOverload.shift();
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


class DatabaseSystem {
    constructor() {
        this.query = util.promisify(db.query).bind(db);

        //Add tiers automatiically
        //tier 1 = 20 Guarantee, 10 Overload, 60 seconds uptime, 10 seconds overload time
        //tier 2 = 30 Guarantee, 15 Overload, 45 seconds uptime, 5 seconds overload time
        //tier 3 = 40 Guarantee, 20 Overload, 35 seconds uptime, 0 seconds overload time
        //Add to db via sql
        //const query = `INSERT INTO tiers (TierLevel, Guarantee, Overload, Uptime, OverloadUptime) VALUES (1, 20, 10, 60, 10), (2, 30, 15, 45, 5), (3, 40, 20, 35, 0)`;
        /*
	 * db.query(query, (err, results) => {
            if (err) {
                console.error('Error adding tiers:', err.code);
            } else {
                console.log('Tiers added successfully');
            }
        });*/
    }
    async getID(username) {
        const sql = 'SELECT id FROM users WHERE username = ?';
        const results = await this.query(sql, [username]);
        if (results.length > 0) {
            return results[0].id;
        } else {
            throw new Error('User not found');
        }
    }
    async validateUserAPIKey(apiKey,user) {
        const query = 'SELECT username FROM users WHERE api_token = ?';
        try {
            const results = await this.query(query, [apiKey]);
            if (results.length > 0) {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            throw err;
        }
    }

    //Given user and amount, check if user has requisite credits
    async checkUserCredits(username) {
        //PAYMENT HANDLING LOGIC FOR DETERMINING COST GOES HERE
        let amount = 5; // Suppose 5 credits are required per call for now

        const sql = "SELECT credits FROM users WHERE username = ?";
        const results = await this.query(sql, [username]);
        if (results.length > 0 && results[0].credits >= amount) {
            return ;
        } else {
            return false;
        }
    }
    //Deduct user credits
    async deductUserCredits(username) {
        //PAYMENT HANDLING LOGIC FOR DETERMINING COST GOES HERE
        let amount = 5; // Suppose 5 credits are required per call  for now

        const sql = "UPDATE users SET credits = credits - ? WHERE username = ?";
        await this.query(sql, [amount, username]);
    }

    async getUserTier(username) {
        const query = 'SELECT tier FROM users WHERE username = ?';
        try {
            const results = await this.query(query, [username]);
            if (results.length > 0) { 
                return results[0].tier;
            } else {
                throw new Error('User not found');
            }
        } catch (err) {
            throw err;
        }
    }

    async getTierResources(tier) {
        const query = 'SELECT Guarantee, Overload, Uptime, ports FROM tiers WHERE TierLevel = ?';
        try {
            const results = await this.query(query, [tier]);
            if (results.length > 0) {
                //Convert from rowdatapacket to object where Guarantee param becomes guarantee and Overload becomes overload
                let resources = {guaranteed: results[0].Guarantee, overload: results[0].Overload, time: results[0].Uptime, ports: results[0].ports};
                return resources;

            } else {
                throw new Error('Tier not found: ' + tier);
            }
        } catch (err) {
            throw err;
        }
    }

    async getAllTiers(){
        const query = 'SELECT * FROM tiers';
        try {
            const results = await this.query(query);
            if (results.length > 0) {
                return results;
            } else {
                throw new Error('Tiers not found');
            }
        } catch (err) {
            throw err;
        }
    }

    async getAllPublishedSubmissions() {
        // Specify the columns you want to fetch in the SELECT clause
        const query = 'SELECT submission_id, user_id, comp_id, score FROM submissions WHERE published = TRUE AND Score IS NOT NULL';
        try {
            const results = await this.query(query);
            console.log(results);
            //Convert each RowDataPacket into object
            results.forEach((row, index) => {
                results[index] = { submission_id: row.submission_id, user_id: row.user_id, comp_id: row.comp_id,  score: row.score};
            });
            console.log(results);
            return results;
        } catch (err) {
            console.error('Failed to retrieve published submissions:', err);
            throw err;
        }
    }


    //Function to check if submission_id and api token correspond to the same user
    async checkSubmissionOwnership(submission_id, api_token) {
        const query = 'SELECT user_id FROM submissions WHERE submission_id = ?';
        try {
            const results = await this.query(query, [submission_id]);
            if (results.length > 0) {
                const user_id = results[0].user_id;
                const query2 = 'SELECT id FROM users WHERE api_token = ?';
                const results2 = await this.query(query2, [api_token]);
                if (results2.length > 0) {
                    return results2[0].id === user_id;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } catch (err) {
            throw err;
        }
    }
    
    async updatePublishedStatus(submission_id, published) {
        // Ensure the inputs are of the correct type
        if (!Number.isInteger(submission_id) || typeof published !== 'boolean') {
            throw new Error("Invalid input types: submission_id must be an integer, and published must be a boolean.");
        }
    
        const query = 'UPDATE submissions SET published = ? WHERE submission_id = ? AND score IS NOT NULL';
        try {
            const result = await this.query(query, [published, submission_id]);
            if (result.affectedRows === 0) {
                console.log(`No submission found with ID ${submission_id}, or no change needed.`);
            } else {
                console.log(`Updated submission ${submission_id} to published status ${published}.`);
            }
        } catch (err) {
            console.error('Failed to update published status:', err);
            throw err;
        }
    }
    
    //GEt container file_path from sumission_id if it is either published or belongs to the user with this api token
    async getContainerFilePath(submission_id, api_token) {
        const query = 'SELECT file_path FROM submissions WHERE submission_id = ? AND (published = TRUE OR user_id = (SELECT id FROM users WHERE api_token = ?))';
        try {
            const results = await this.query(query, [submission_id, api_token]);
            if (results.length > 0) {
                return results[0].file_path;
            } else {
                return null;
            }
        } catch (err) {
            throw err;
        }
    }

    //Check if user_id matches api-key
    async checkUserOwnership(user_id, api_token) {
        const query = 'SELECT username FROM users WHERE api_token = ?';
        try {
            const results = await this.query(query, [api_token]);
            if (results.length > 0) {
                return results[0].username === user_id;
            } else {
                return false;
            }
        } catch (err) {
            throw err;
        }
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
let Prometheus = new PlatformDaemonManager(4, 4000, 500, blocksPerTier = [40, 30, 50]);
Prometheus.startMonitoring(1000);
module.exports = { Prometheus, PlatformDaemonManager , getSystemState, DaemonNotFoundError, DatabaseSystem, PlatformResourceMonitor, GuaranteeResourceAllocationError, OverloadResourceAllocationError, AlreadyRegisteredError};

  
  

