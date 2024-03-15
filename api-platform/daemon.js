var shell = require('shelljs');
var chalk = require("chalk");
var http = require('http');
const portsAllowed = 101; // Define max number of ports from STARTING_PORT 
const defaultMemory = 50;//mb of memory.
const defaultCPU = .01;//cpus stat. More info read here: https://docs.docker.com/config/containers/resource_constraints/#cpu

//TODO: Create new function using `docker container ls --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}" -a` to return true or false if a given port is taken.


/**
 * We operate under the assumption that the Docker Container is ideal and absolutely cannot go beyond the resource limits given(which to be fair it seems to be able to do, as it emulates the Operating System).
 */


class PrometheusDaemon{


  /**
   * The PrometheusDaemon constructor initializes a new instance of the class with parameters for port allocation, CPU and memory limits, process identification, and maximum uptime. It sets up an array to track port usage, a queue for container management, and a stack for actively monitoring container resources. It logs initialization messages to indicate the system's operational parameters. The  maxUptime parameter specifies the duration the daemon should run before automatically shutting down, ensuring resource usage does not exceed predetermined limits. This setup prepares the daemon for monitoring and managing Docker containers within specified hardware constraints.
   * @param portsAllowed is the number of ports we permit this particular instance.
   * @param processID would be a unique identifier for the particular daemon
   * @param maxUptime is the time allotted for the Daemon to be alive for in SECONDS. Be aware that the units are SECONDS. This is very IMPORTANT.
   * @param STARTING_PORT is where we begin counting our ports from. The default value is there for testing but PLEASE assign it. Port conflicts are the absolute last thing we want on our mind. 
   * 
   */
  constructor(manager,STARTING_PORT = 5000, portsAllowed, maxCPU = .05, maxMemory = 300, processID,maxUptime){
    this.manager=manager;
    this.ports = new Array(portsAllowed);
    this.containerQueue = new ContainerQueue()
    console.log(`[Prometheus] Process Stack initialized with maxCPU:${maxCPU} and maxMemory:${maxMemory}`);
    this.containerStack = new ContainerStack(maxCPU,maxMemory);
    this.interval = null
    this.processID = processID;
    this.maxUptime = maxUptime;
    this.STARTING_PORT = STARTING_PORT;

    console.log(chalk.green("[Prometheus] Initialized Daemon. Prometheus is watching for updates..."));
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
          console.log(chalk.red("[Prometheus] Max uptime reached. Stopping daemon and cleaning up..."));
          this.stopMonitoring();
          this.killContainers(this.getRunningContainers());
          // Additional cleanup logic here if necessary
          process.exit(0); // Exit the process
        }

        if (!this.containerQueue.isEmpty()) {

          //Call HW-Limit-Aware-Start-System
          const container = this.containerQueue.dequeue();
          try{
            this.initializeContainer(container);
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

  //This family of functions deals with port mappings
  /**
   * Function to add a number to the ports using hashing with linear probing 
   */ 
  addToPortMap(containerID) {
    /// Function to calculate the hash value for a given number

    let index = containerID % portsAllowed;
    
    // Check if the slot is empty, if not, probe linearly until an empty slot is found
    while (this.ports[index] !== undefined) {
      console.log(this.ports[index]);
      index = (index + 1) % portsAllowed;
    }

    // Insert the number into the empty slot
    this.ports[index] = containerID;
    return index;
  }

  /**
   * As the name implies, it gets the port that a particular container operates on when given its unique ID
   */
  getPortByID(containerID) {    
    for (let index = parseInt(containerID)%portsAllowed; index < this.ports.length; index++) {
      const element = this.ports[index];
      if(element==containerID){
        return this.STARTING_PORT + index;
      }
    }
    // if (index === -1) {
    //   throw new Error(`Container ID ${containerID} not found.`);
    // }
    throw new Error(`Container ID ${containerID} not found in containerID-Port set.`);
  }

  /**
   * As the name implies, removes container from port mapping
   */
  removeContainerFromPortMap(containerID) {    
    for (let index = parseInt(containerID)%portsAllowed; index < this.ports.length; index++) {
      const element = this.ports[index];
      if(element==containerID){
        this.ports[index]=undefined;
        return;
      }
    }
    // if (index === -1) {
    //   throw new Error(`Container ID ${containerID} not found.`);
    // }
    throw new Error(chalk.red(`Container ID ${containerID} not found in containerID-Port set.`));
  }


  //This family of functions deals with container management
  /**
   * Used to intialize a container. Does lots of internal error handling.
   * 
   * @param {Container} container
   * 
   */
  initializeContainer(container, silent = true) {
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
  
    let port = this.STARTING_PORT + this.addToPortMap(parseInt(container.containerID), this.portsAllowed); 
    // Running the Docker container
    let runResult = shell.exec(`docker run -d --memory=${container.memory}m --cpus=${container.cpu} -p ${port}:${this.STARTING_PORT} ${container.containerID}`, { silent: silent });
    if (runResult.code !== 0) {
      console.error(chalk.red(`Failed to start container ${container.containerID} with exit code ${buildResult.code}: ${runResult.stderr}`));
      this.removeContainerFromPortMap(container.containerID);
      return; // Exit if run fails
    }

  
    console.log(`${container.containerID} running image ${container.model} is listening on port ${port} with memory cap ${container.memory}m with cpu availability ${container.cpu}. | Build and run exit codes were ${buildResult.code} and ${runResult.code}.`);
    console.log(`Remaining Resources - CPU: ${(this.containerStack.maxCPU - this.containerStack.currentCPU).toFixed(2)}, Memory: ${(this.containerStack.maxMemory - this.containerStack.currentMemory).toFixed(2)} MB. ContainerStack length: ${this.containerStack.stack.length.toString()}`);
  }

  /**
   * 
   * @param {Array<Container>} containers
   */
  killContainers(containers, silent = true){
    console.log(chalk.red("[Prometheus] Killing Containers..."));
    containers.forEach((container) => {
        if (!this.containerStack.exists(container.containerID)) {
          console.log(chalk.yellow(`Container ${container.containerID} not found in stack. Skipping kill sequence.`));
          return; // Skip this container if it's not in the stack
      }
        let containerTag = container.containerID//I know this is terrible basically our system has its own ID format which is technically docker's tag format. Don't yell at me ok.
        let containerID = shell.exec(`docker ps | grep ${containerTag} | cut -f 1 -d ' '`, {silent: silent});
        if (containerID.code !== 0) {
            console.log(chalk.red(`Error finding running container for ID: ${containerID}`));
            return; // Exit this iteration of the loop and continue with the next
        }

        let containerStopped = shell.exec(`docker stop ${containerID}`, {silent: silent});
        if (containerStopped.code !== 0) {
            if(containerStopped.code == 1){
              console.log(chalk.yellow(`Container was stopped due to application error or incorrect reference in the image specification`));
              this.containerStack.remove(containerTag);
            } else {
              console.log(chalk.red(`Error stopping container ${containerID} | exit code: ${containerStopped.code}`));
            } 
        }
        //At this point, container is stopped, so we will remove it from the port mapping now.
        try{
          this.removeContainerFromPortMap(containerTag);
        } catch (e){
          console.log(e)
        }

        let containerRemoved = shell.exec(`docker container rm ${containerID}`, {silent: silent});
        if (containerRemoved.code !== 0) {
            console.log(chalk.red(`Error removing container ${containerID}| exit code: ${containerRemoved.code}`));
        }

        let imageRemoved = shell.exec(`docker rmi ${containerTag}:latest -f`, {silent: silent});
        if (imageRemoved.code !== 0) {
            console.log(chalk.red(`Error removing image ${containerTag}:latest| exit code: ${imageRemoved.code}`));
        }
        this.containerStack.remove(containerTag); // Adjust if container ID or tag is used for identification within the stack
        // If all operations are successful
        console.log(chalk.grey(`${containerTag}:${containerID} kill sequence ended with codes:[${containerStopped.code},${containerRemoved.code},${imageRemoved.code}]. ContainerStack length: ${this.containerStack.stack.length.toString()}`));
    })
  }

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
  constructor(maxCPU, maxMemory) {
    this.stack = [];
    this.maxCPU = maxCPU;
    this.maxMemory = maxMemory;
    this.currentCPU = 0;
    this.currentMemory = 0;
  }

  exists(containerID) {
    return this.stack.some(item => item.containerID === containerID);
  }

  push(container) {
    // Check if pushing this container exceeds CPU or memory limits. Only add if so.
    if (this.currentCPU + container.cpu <= this.maxCPU && this.currentMemory + container.memory <= this.maxMemory) {
      this.stack.push(container);
      this.currentCPU += container.cpu;
      this.currentMemory += container.memory;
    } else {
      throw new HardwareLimitError(chalk.yellow(`[Prometheus] Reached hardware limit when attempting to initialize ${container.toString()} from queue...`));
    }
  }

  ///For debugging.
  printAvail = () => console.log(`[Container Stack] Availability is now ${(this.maxCPU - this.currentCPU).toPrecision(4)} CPU and ${(this.maxMemory - this.currentMemory).toPrecision(4)} RAM`);

  remove(containerID) {
    const indexToRemove = this.stack.findIndex((item) => item.containerID === containerID);

    if (indexToRemove !== -1) {
      // Corrected to access the first element of the array returned by splice
      const [container] = this.stack.splice(indexToRemove, 1);
      if (container) {
        console.log(container.toString());
        this.currentCPU -= container.cpu;
        this.currentMemory -= container.memory;
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
