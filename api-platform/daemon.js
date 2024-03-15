var shell = require('shelljs');
var chalk = require("chalk");
var http = require('http');
const EventEmitter = require('events');
const { default: container } = require('node-docker-api/lib/container');
const STARTING_PORT=5000;
const portsAllowed = 101; // Define max number of ports from STARTING_PORT 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

//TODO: Create new function using `docker container ls --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}" -a` to return true or false if a given port is taken.


/**
 * We operate under the assumption that the Docker Container is ideal and absolutely cannot go beyond the resource limits given(which to be fair it seems to be able to do, as it emulates the Operating System).
 */


class PrometheusDaemon extends EventEmitter{



  constructor( portsAllowed, maxCPU = .05, maxMemory = 300, processID, maxUptime) {
        super();
        this.ports = new Set(portsAllowed);
        this.portMap = new Map();
        this.containerQueue = new ContainerQueue();
        this.containerStack = new ContainerStack(maxCPU, maxMemory);
        this.interval = null;
        this.processID = processID;
        this.maxUptime = maxUptime;

        console.log("[Prometheus] Initialized Daemon. Prometheus is watching for updates...");
    }

  
  /*
  * Causes the internal timer to start as well as listens for updates on the queue.
  */
  startMonitoring(intervalTime) {
    const startTime = Date.now(); // Capture the start time of the daemon
    if (!this.interval) {
      this.interval = setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds

        if (elapsedTime >= this.maxUptime) {
          console.log(chalk.red("[Prometheus] Max uptime reached. Stopping daemon and cleaning up..."))
          this.shutdown();
        }

        if (!this.containerQueue.isEmpty()) {

          //Call HW-Limit-Aware-Start-System
          const container = this.containerQueue.dequeue();
          try{
            this.#initializeContainer(container);
          }catch(e){
            if(e.name==="HardwareLimitError"){
              return;
            }
            console.log(chalk.red(e.toString()));
            console.log(chalk.gray(e.stack.toString()));
            this.containerQueue.queue.push(container);//NOTE: PUSH BECAUSE WE WANT IT TO REMAIN #1
          }
          
        }
      }, intervalTime);
    }
  }

  /** 
   * To pause the monitoring system. Note, this will NOT reset the timer. This is a good way to make a particular process not accept any more containers, while keeping it alive. The downside is that the timer is currently not running.
  */
  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log(chalk.gray("[Prometheus] Prometheus has stopped watching for updates..."));
  }


  shutdown() {
    console.log(chalk.green('[PrometheusDaemon] Shutting down...'));
    this.stopMonitoring();
    this.killContainers(this.getRunningContainers()).then(() => {
        console.log(chalk.green('[PrometheusDaemon] Successfully shut down.'));
        this.emit('exit', 0);
        return;
    }).catch((error) => {
        console.error(chalk.red('[PrometheusDaemon] Error during shutdown:', error));
        this.emit('exit', 1);
    });
}




  //This family of functions deals with port mappings
  /**
   * Function to add a number to the ports using hashing with linear probing 
   */ 
  addToPortMap(containerID) {
    // 1. Check if the container exists in the map
    if (this.portMap.has(containerID)) {
        throw new Error(chalk.red("Container already has an allocated port"));
    }
    // 1.5 Check if we have reached the limit of port allocations
    if (this.portMap.size === this.ports.size) {
        throw new Error(chalk.red("No free ports available"));
    }
    
    // Convert ports set to an array for easier index management
    const portsArray = Array.from(this.ports);
    let hashIndex = containerID % portsArray.length;
    let port = portsArray[hashIndex];
    
    // 2. Find an unclaimed port, incrementing by 1 on collision
    while (this.portMap.has(port)) {
        hashIndex = (hashIndex + 1) % portsArray.length;
        port = portsArray[hashIndex];
    }
    
    // Assign the found port to the container
    this.portMap.set(containerID, port);
    
    // Optionally, you might want to remove the allocated port from the available ports set
    // to ensure it's not allocated again. Depends on your use case.
    this.ports.delete(port);
    return port;
  }

  /**
   * As the name implies, it gets the port that a particular container operates on when given its unique ID
   */
  getPortByID(containerID) {
    // Check if the containerID is present in the portMap
    if (this.portMap.has(Number(containerID))) {
        // Return the port assigned to the containerID
        return this.portMap.get(Number(containerID));
    } else {
        // Throw an error if the containerID is not found in the portMap
        throw new Error(`Container ID ${containerID} not found in port mapping.`);
    }
  }


  /**
   * As the name implies, removes container from port mapping
   */
  removeContainerFromPortMap(containerID) {
    // Check if the containerID exists in the portMap
    if (this.portMap.has(Number(containerID))) {
        // Retrieve the allocated port for the containerID
        const allocatedPort = this.portMap.get(Number(containerID));
        
        // Remove the containerID from the portMap
        this.portMap.delete(Number(containerID));
        
        // Add the released port back to the set of available ports
        this.ports.add(Number(allocatedPort));

    } else {
        // Throw an error if the containerID is not found in the portMap
        throw new Error(`Container ID ${containerID} not found in port mapping.`);
    }
  }



  //This family of functions deals with container management
  /**
   * Used to intialize a container. Does lots of internal error handling.
   * 
   * @param {Container} container
   * 
   */
  #initializeContainer(container, silent = true) {
    console.log(chalk.green(`[Prometheus] Starting Container...`));

    if (this.containerStack.exists(container.containerID)) {
      console.log(chalk.yellow(`Container ${container.containerID} already exists in the stack. Skipping initialization.`));
      return; // Skip initialization if container is already in the stack
    }

    this.containerStack.push(container);
    // Building the Docker container
    let buildResult = shell.exec(`docker build -t ${container.containerID} ./${container.model}`, { silent: silent });
    if (buildResult.code !== 0) {
      console.error(chalk.red(`Failed to build container ${container.containerID} with exit code ${buildResult.code}: ${buildResult.stderr}`));
      return; // Exit if build fails
    }

    //Let the errors, if any surface to monitoring chronjob
    let port = this.addToPortMap(parseInt(container.containerID)); 

    
    // Running the Docker container
    let runResult = shell.exec(`docker run -d --memory=${container.memory}m --cpus=${container.cpu} -p ${port}:${STARTING_PORT} ${container.containerID}`, { silent: silent });
    if (runResult.code !== 0) {
      console.error(chalk.red(`Failed to start container ${container.containerID} with exit code ${runResult.code}: ${runResult.stderr}`));
      this.removeContainerFromPortMap(container.containerID);
      return; // Exit if run fails
    }

  
    console.log(`${container.containerID} running image ${container.model} is listening on port ${port} with memory cap ${container.memory}m with cpu availability ${container.cpu}. | Build and run exit codes were ${buildResult.code} and ${runResult.code}.`);
    console.log(`Remaining Resources - CPU: ${(this.containerStack.getMaxCPU() - this.containerStack.getCurrentCPU()).toFixed(2)}, Memory: ${(this.containerStack.getMaxMemory() - this.containerStack.getCurrentMemory()).toFixed(2)} MB. ContainerStack length: ${this.containerStack.stack.length.toString()}`);
  }

  /**
   * 
   * @param {Array<Container>} containers
   */
  killContainers = (containers, silent = true) => {
    console.log(chalk.red("[Prometheus] Killing Containers..."));
    let promises = containers.map(container => {
        return new Promise((resolve, reject) => {
            if (!this.containerStack.exists(container.containerID)) {
                console.log(chalk.yellow(`Container ${container.containerID} not found in stack. Skipping kill sequence.`));
                return resolve(); // Resolve immediately for skipped containers
            }
            
            let containerTag = container.containerID;
            shell.exec(`docker ps | grep ${containerTag} | cut -f 1 -d ' '`, { silent: silent }, (code, stdout, stderr) => {
                if (code !== 0) {
                    return reject(new Error(`Error finding running container for ID: ${containerID}`));
                }
                
                let containerID = stdout.trim();
                shell.exec(`docker stop ${containerID}`, { silent: silent }, (stopCode) => {
                    if (stopCode !== 0) {
                        return reject(new Error(`Error stopping container ${containerID} | exit code: ${stopCode}`));
                    }

                    try {
                        this.removeContainerFromPortMap(containerTag);
                    } catch (error) {
                        return reject(error);
                    }

                    shell.exec(`docker container rm ${containerID}`, { silent: silent }, (rmCode) => {
                        if (rmCode !== 0) {
                            return reject(new Error(`Error removing container ${containerID}`));
                        }

                        shell.exec(`docker rmi ${containerTag}:latest -f`, { silent: silent }, (rmiCode) => {
                            if (rmiCode !== 0) {
                                return reject(new Error(`Error removing image ${containerTag}:latest`));
                            }

                            this.containerStack.remove(containerTag); // Ensure this operation is synchronous or properly handled if asynchronous
                            console.log(chalk.grey(`${containerTag}:${containerID} kill sequence completed.`));
                            resolve();
                        });
                    });
                });
            });
        });
    });

    return Promise.all(promises)
        .then(() => console.log(chalk.green("All specified containers have been processed.")))
        .catch(error => console.log(chalk.red(error.message)));
  };

  ///Passes by value, NOT reference
  getRunningContainers(){
    return this.containerStack.stack.slice(0);//used to change reference
  }




  //This family of functions(or at the time of writing this, this function) is for dealing with queries made to models via the API service. Alternatively this is also used for actually inducing a forward pass in the receiving model.
  /**
   * This is how we pass on information to a given container
   * 
   * @param {JSON} req is the JSON data of the request as we recieve it.
   * @param {String} address is the address we are considering sending this to. To improve modularity, I added an address field. Hypothetically in future implementations, one could have these daemons running on one machine with the containers on another.
   */
  async forward(req, address = '127.0.0.1') {
    // Wrap the request in a promise to handle it asynchronously
    return new Promise((resolve, reject) => {
      // Extract the container ID from the request.
      const containerID = req.containerID;
      let port = 0;
      try{
        
        port = this.getPortByID(containerID); // Assumes containerID is an integer.
      } catch (e) {
        reject(`Problem with request: ${e.message}`);
      }
      

      const options = {
        hostname: address,
        port: port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      forwardReq.write(JSON.stringify(req.body));
      forwardReq.on('error', (e) => {
        // Reject the promise on request error
        reject(`problem with request: ${e.message}`);
      });

      // End the request
      forwardReq.end();
    });
  }

}

/**This class is a tool for the PrometheusDaemon */
class ContainerStack {
  //Private Fields, use getters and setters
  #maxCPU;
  getMaxCPU = () => this.#maxCPU;
  setMaxCPU = (cpu) => this.#maxCPU=cpu;
  
  #maxMemory;
  getMaxMemory = () => this.#maxMemory;
  setMaxMemory = (memory) => this.#maxMemory=memory;

  #currentCPU
  getCurrentCPU = () => this.#currentCPU;

  #currentMemory
  getCurrentMemory = () => this.#currentMemory;

  
  constructor(maxCPU, maxMemory) {
    this.stack = [];
    this.#maxCPU = maxCPU;
    this.#maxMemory = maxMemory;
    this.#currentCPU = 0;
    this.#currentMemory = 0;
  }


  exists(containerID) {
    return this.stack.some(item => item.containerID === containerID);
  }

  push(container) {
    // Check if pushing this container exceeds CPU or memory limits. Only add if so.
    if (this.#currentCPU + container.cpu <= this.#maxCPU && this.#currentMemory + container.memory <= this.#maxMemory) {
      this.stack.push(container);
      this.#currentCPU += container.cpu;
      this.#currentMemory += container.memory;
    } else {
      throw new HardwareLimitError(chalk.yellow(`[Prometheus] Reached hardware limit when attempting to initialize ${container.toString()} from queue...`));
    }
  }

  ///For debugging.
  printAvail = () => console.log(`[Container Stack] Availability is now ${(this.#maxCPU - this.#currentCPU).toPrecision(4)} CPU and ${(this.#maxMemory - this.#currentMemory).toPrecision(4)} RAM`);

  remove(containerID) {
    const indexToRemove = this.stack.findIndex((item) => item.containerID === containerID);

    if (indexToRemove !== -1) {
      // Corrected to access the first element of the array returned by splice
      const [container] = this.stack.splice(indexToRemove, 1);
      if (container) {
        console.log(container.toString());
        this.#currentCPU -= container.cpu;
        this.#currentMemory -= container.memory;
      }
    } else {
      console.log(chalk.red(`Container with ID '${containerID}' not found.`));
    }
  }

  isEmpty() {
    return this.stack.length === 0;
  }
}

/**This class is a tool for the PrometheusDaemon */
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
  enqueue(parameters,priority=1, containerID,model) {
    if (this.queue.find(container=>{
        container.containerID ==containerID
    }) == undefined) {
      this.queue.push(new Container(parameters.cpus, parameters.memory,containerID,priority,model));
      this.queue.sort((a, b) => a.priority - b.priority);
      //console.log(chalk.gray("[Success] Container Enqueued: " + containerID.toString()))
    } else{
      console.log(chalk.red("[ContainerQueue Failure] Duplicate ContainerID When Enqueueing " + containerID.toString()))
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


/**Container abstraction */
class Container{
  constructor(cpu, memory, containerID,priority,model){
    this.cpu = cpu;
    this.memory = memory;
    this.containerID = containerID;
    this.priority = priority;
    this.model = model;
    this.toString = () => `{containerID: ${containerID},cpu: ${cpu}, memory: ${memory}, priority: ${priority}}`
  }
}

/**Custom error because why not */
class HardwareLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "HardwareLimitError";
  }
}

module.exports = { Container, PrometheusDaemon}
