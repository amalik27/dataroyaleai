var shell = require('shelljs');
var chalk = require("chalk");
const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

const { PrometheusDaemon } = require('./daemon');

class PrometheusDaemonManager {
    constructor() {
      this.daemons = {};
      this.processQueue = [];
      this.cpuResourcePool = {
        G: { 1: new Set(), 2: new Set(), 3: new Set() }, // Guaranteed CPU blocks for each tier
        O: { 1: new Set(), 2: new Set(), 3: new Set() }  // Overload CPU blocks for each tier
      };
    }

    spawnNewDaemon(processID) {
        // Implement the logic to spawn a new daemon
        const daemon = new PrometheusDaemon();
        this.registerDaemon(processID, daemon);
    }

    killProcessDaemon(processID) {
        // Implement the logic to kill a specific process daemon
        const daemon = this.daemons[processID];
        if (daemon) {
            daemon.stopMonitoring();
            daemon.killContainers(daemon.getRunningContainers());
            this.unregisterDaemon(processID);
        }
    }

    addProcessToQueue(process) {
        this.processQueue.push(process);
        // Sort the queue first by tier and then by priority within each tier
        this.processQueue.sort((a, b) => {
            if (a.tier === b.tier) {
                return a.priority - b.priority;
            }
            return a.tier - b.tier;
        });
    }

    allocateResources() {
        while (this.processQueue.length > 0) {
            const process = this.processQueue.shift();
            if (this.allocateGBlock(process) || this.allocateOBlock(process)) {
                this.startProcess(process);
            } else {
                // No resources available, push the process back to the queue
                this.processQueue.unshift(process);
                break;
            }
        }
    }

    allocateGBlock(process) {
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

    allocateOBlock(process) {
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

    startProcess(process) {
      // Logic to start a process on a daemon
      const daemon = this.daemons[process.processID];
      if (daemon) {
          // Initialize containers with the required resources
          daemon.initializeContainers(process.containerIDs, process.maxMemory, process.cpus);
          console.log(`Process ${process.processID} has started with resources - Memory: ${process.maxMemory}, CPUs: ${process.cpus}`);
          // Add process to daemon's tracking to manage lifecycle
          daemon.addProcess(process);
      } else {
          throw new Error(`No daemon found with process ID ${process.processID}`);
      }
    }
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

    registerDaemon(processID, daemon) {
      if (!this.daemons[processID]) {
          this.daemons[processID] = daemon;
          console.log(`Daemon registered with process ID ${processID}`);
      } else {
          throw new Error(`Daemon with process ID ${processID} is already registered`);
      }
    }

    unregisterDaemon(processID) {
      if (this.daemons[processID]) {
          delete this.daemons[processID];
          console.log(`Daemon with process ID ${processID} has been unregistered`);
      } else {
          throw new Error(`No daemon found with process ID ${processID} to unregister`);
      }
    }

}

module.exports = { PrometheusDaemonManager };

  
  

