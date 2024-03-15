var shell = require('shelljs');
var chalk = require("chalk");
const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

const { PrometheusDaemon } = require('./daemon');

class PrometheusDaemonManager {
    constructor(maxCPU,maxMemory,portsAllowed) {
      this.daemons = new Map(); //Make it a set as duplication is VERY bad
      this.messageQueue = []; //This queue is implemented as a priority queue.
      this.ports = new Set(portsAllowed.sort((a, b) => a - b));
      this.MINPORT = this.ports[0];
      this.MAXPORT = this.ports[this.ports.length-1];
      this.portMap = new Map();
      //Parameter which needs to be in place in the constructor for when we make an instance of this. Resource limits must be respected for this system to make sense.
      this.maxCPU = maxCPU;
      this.maxMemory = maxMemory;
      this.interval = null;

      this.cpuResourcePool = {
        G: { 1: new Set(), 2: new Set(), 3: new Set() }, // Guaranteed CPU blocks for each tier
        O: { 1: new Set(), 2: new Set(), 3: new Set() }  // Overload CPU blocks for each tier
      };
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
            }
          }, intervalTime);
        }
    }

    //Port allocation functions
    allocatePorts(N, processID) {
        // 1.5 Check if we have reached the limit of port allocations
        if (this.portMap.size + N > this.ports.size) {
            throw new Error(chalk.red("Not enough free ports available"));
        }
        
        const allocatedPorts = Array.from(this.ports).slice(0, N);
        
        // Delete the allocated ports from the set of available ports
        allocatedPorts.forEach(port => this.ports.delete(port));
        
        // Associate the allocated ports with the processID in the portMap
        this.portMap.set(processID, allocatedPorts);
    
        return allocatedPorts;
    }

    removeProcessFromPortMap(processID) {
        // Check if the processID exists in the portMap
        if (this.portMap.has(processID)) {
            // Retrieve the allocated ports for the processID
            const allocatedPorts = this.portMap.get(processID);
            
            // Add the released ports back to the set of available ports
            allocatedPorts.forEach(port => this.ports.add(port));
            
            // Remove the processID from the portMap
            this.portMap.delete(processID);
        } else {
            // Throw an error if the processID is not found in the portMap
            throw new Error(`Process ID ${processID} not found in port mapping.`);
        }
    }



    //Daemon functions
    #spawnNewDaemon(parameters) {
        // Implement the logic to spawn a new daemon
        let ports = this.allocatePorts(parameters.ports,parameters.processID);

        const daemon = new PrometheusDaemon(ports,parameters.cpu,parameters.memory,parameters.processID,parameters.uptime);
        this.#registerDaemon(parameters.processID, daemon);
        daemon.startMonitoring(parameters.interval);


        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[Prometheus] Daemon child ${parameters.processID} died with status ${code}`));
            //TODO: Replace this line with a more thorough this.cleanUp() function that deals with all aspects of removing a process.
            this.daemons.delete(parameters.processID);
          });

        // daemon.on('request', (cpu,memory) => {
        // console.log(`Daemon child ${parameters.processID} requested ${cpu} cpu and ${memory} memory`);
        // this.daemons.delete(parameters.processID);
        // });
    }

    #killProcessDaemon(processID) {
        // Implement the logic to kill a specific process daemon
        const daemon = this.daemons[processID];
        if (daemon) {
            daemon.shutDown();
            this.unregisterDaemon(processID);
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

    #allocateResources() {
        while (this.messageQueue.length > 0) {
            const process = this.messageQueue.shift();
            if (this.allocateGBlock(process) || this.allocateOBlock(process)) {
                this.startProcess(process);
            } else {
                // No resources available, push the process back to the queue
                this.messageQueue.unshift(process);
                break;
            }
        }
    }

    #allocateGBlock(process) {
        for (let tier = process.tier; tier >= 1; tier--) {
            if (this.cpuResourcePool.G[tier].size > 0) {
                const block = this.cpuResourcePool.G[tier].values().next().value;
                this.cpuResourcePool.G[tier].delete(block);
                process.allocatedBlock = block;
                return true;
            }
        }
        return false;
    }

    /**
     * @param {PrometheusDaemon} process
     */
    #allocateOBlock(process) {
        for (let tier = process.tier; tier >= 1; tier--) {
            if (this.cpuResourcePool.O[tier].size > 0) {
                const block = this.cpuResourcePool.O[tier].values().next().value;
                this.cpuResourcePool.O[tier].delete(block);
                process.allocatedBlock = block;
                return true;
            }
        }
        return false;
    }

    /**
     * @param {PrometheusDaemon} process
     */
    initializeContainer(processID,container) {
      // Logic to start a process on a daemon
      const daemon = this.daemons[processID];
      if (daemon) {
          // Initialize containers with the required resources
          daemon.containerQueue.enqueue({cpus:container.cpus, memory:container.memory},container.priority,container.containerID,container.model);
      } else {
          throw new Error(`No daemon found with process ID ${processID}`);
      }
    }

    /**
     * @param {PrometheusDaemon} process
     */
    releaseResources(process) {
      // Determine if the block was a G or O block
      const blockType = process.allocatedBlock.type;
      const blockTier = process.allocatedBlock.tier;

      // Return the block back to the appropriate pool
      this.cpuResourcePool[blockType][blockTier].add(process.allocatedBlock.id);

      console.log(`Resources released for process ${process.processID}: CPU block ${process.allocatedBlock.id}`);
      // Attempt to reallocate resources to queued processes
      this.allocateResources();
    }

    rerouteAPICall(processID, apiEndpoint) {
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
          this.daemons[processID] = daemon;
          console.log(`Daemon registered with process ID ${processID}`);
      } else {
          throw new Error(`Daemon with process ID ${processID} is already registered`);
      }
    }

    #unregisterDaemon(processID) {
      if (this.daemons[processID]) {
          delete this.daemons[processID];
          console.log(`Daemon with process ID ${processID} has been unregistered`);
      } else {
          throw new Error(`No daemon found with process ID ${processID} to unregister`);
      }
    }

}

module.exports = { PrometheusDaemonManager };

  
  

