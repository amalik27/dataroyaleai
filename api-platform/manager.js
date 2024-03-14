var shell = require('shelljs');
var chalk = require("chalk");
const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50; // MB of memory.
const defaultCPU = .01; // CPUs stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

const { PrometheusDaemon } = require('./daemon');

class PrometheusDaemonManager {
  constructor() {
    this.daemons = {};
    this.processQueue = [];
    this.cpuResourcePool = {
      G: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }, // Guaranteed CPU blocks for each tier
      O: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }  // Overload CPU blocks for each tier
    };
    // Priority levels for different tiers (modifiable for future adjustments)
    this.priorityLevels = {
      systemMessages: 0,
      tier1Users: 1,
      tier2Users: 2,
      tier3Users: 3
    };
  }

  

  spawnNewDaemon(processID) {
    const daemon = new PrometheusDaemon();
    this.registerDaemon(processID, daemon);
  }

  killProcessDaemon(processID) {
    const daemon = this.daemons[processID];
    if (daemon) {
      daemon.stopMonitoring();
      daemon.killContainers(daemon.getRunningContainers());
      this.unregisterDaemon(processID);
    }
  }

  addProcessToQueue(process) {
    this.processQueue.push(process);
    // Sort the queue first by priority and then by tier within each priority
    this.processQueue.sort((a, b) => {
      if (a.priority === b.priority) {
        return this.priorityLevels[a.tier] - this.priorityLevels[b.tier];
      }
      return a.priority - b.priority;
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
    const daemon = this.daemons[process.processID];
    if (daemon) {
      daemon.initializeContainers(process.containerIDs, process.maxMemory, process.cpus);
      console.log(`Process ${process.processID} has started with resources - Memory: ${process.maxMemory}, CPUs: ${process.cpus}`);
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
    this.allocateResources();
  }

  rerouteAPICall(processID, apiEndpoint) {
    const daemon = this.daemons[processID];
    if (daemon) {
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

  reapOrphanContainers() {
    console.log(chalk.blue('[PrometheusDaemonManager] Reaping orphan containers...'));
  
    // Command to list all containers that are not running but still exist
    let commandListOrphans = `docker ps -a --filter "status=exited" --filter "status=created" --no-trunc -q`;
    
    // Execute the command
    shell.exec(commandListOrphans, {silent: true}, (code, stdout, stderr) => {
      if (code !== 0) {
        console.error(chalk.red(`Error while trying to list orphan containers: ${stderr}`));
        return;
      }
  
      // Split the output by new line to get an array of container IDs
      let orphanContainerIds = stdout.split('\n').filter(id => id);
  
      if (orphanContainerIds.length === 0) {
        console.log(chalk.green('No orphan containers found.'));
        return;
      }
  
      // Remove each orphan container
      orphanContainerIds.forEach((containerId) => {
        if (containerId) {
          console.log(chalk.yellow(`Removing orphan container with ID: ${containerId}`));
          shell.exec(`docker rm ${containerId}`, {silent: true}, (rmCode, rmStdout, rmStderr) => {
            if (rmCode !== 0) {
              console.error(chalk.red(`Error while trying to remove orphan container ${containerId}: ${rmStderr}`));
            } else {
              console.log(chalk.green(`Successfully removed orphan container with ID: ${containerId}`));
            }
          });
        }
      });
    });
  }
  
}
 
module.exports = { PrometheusDaemonManager };
