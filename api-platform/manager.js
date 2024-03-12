var shell = require('shelljs');
var chalk = require("chalk");
var Prometheus = require('./daemon')
const portsAllowed = 101; // Define max number of ports from 5000 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu


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
  
  