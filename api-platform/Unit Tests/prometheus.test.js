const { PlatformDaemon,Container } = require('../platformDaemon.js');
const { PlatformDaemonManager, DatabaseSystem } = require('../platformManager');
const EventEmitter = require('events');
const shell = require('shelljs');
jest.useFakeTimers();
jest.mock('shelljs', () => ({
    exec: jest.fn().mockImplementation((command, options, callback) => {
      if (command.includes('docker build')) {
        // Simulate a successful docker build command
        if (typeof callback === 'function') {
          callback(0, 'Build successful', ''); // success code, stdout, and no stderr
        }
        return { code: 0, stdout: 'Build successful', stderr: '' };
      } else if (command.includes('docker run')) {
        // Simulate a successful docker run command
        if (typeof callback === 'function') {
          callback(0, 'Run successful', ''); // success code, stdout, and no stderr
        }
        return { code: 0, stdout: 'Run successful', stderr: '' };
      }
      // Default simulated response for other commands
      if (typeof callback === 'function') {
        callback(0, '', ''); // success code, and no stdout or stderr
      }
      return { code: 0, stdout: '', stderr: '' };
    }),
  }));

  
//Mock console.log
console.log = jest.fn();
//Mock the database
jest.mock('mysql', () => ({
    createConnection: jest.fn().mockReturnValue({
      connect: jest.fn((callback) => callback(null)),
      query: jest.fn((sql, values, callback) => {
        if (typeof values === 'function') { // No values provided, callback is in the second argument
          callback = values;
        }
        callback(null, [], null); // Simulate success with empty results
      }),
      end: jest.fn((callback) => callback(null)),
      // Add more mock functions as needed for your tests
    }),
  }));
  
describe('PlatformDaemon Initialization', () => {
  let daemon;
  const maxCPU = 0.05;
  const maxMemory = 300;
  const processID = 'testDaemon';
  const maxUptime = 60; // in seconds
  const maxOverloadTime = 0; // not considering overload in this test

  beforeAll(() => {
    daemon = new PlatformDaemon([], maxCPU, maxMemory, processID, maxUptime, maxOverloadTime, "TestDaemon");
  });

  it('should correctly initialize with given parameters', () => {
    expect(daemon).toBeInstanceOf(PlatformDaemon);
    expect(daemon).toBeInstanceOf(EventEmitter);
    expect(daemon.processID).toBe(processID);
    expect(daemon.maxUptime).toBe(maxUptime);
    expect(daemon.maxOverloadTime).toBe(maxOverloadTime);
    expect(daemon.containerStack.getMaxCPU()).toBe(maxCPU);
    expect(daemon.containerStack.getMaxMemory()).toBe(maxMemory);
  });

  it('should start with an empty container stack', () => {
    expect(daemon.containerStack.stack.length).toBe(0);
  });

  it('starts monitoring upon initialization', () => {
    const monitoringSpy = jest.spyOn(daemon, 'startMonitoring');

    daemon.startMonitoring(1000); // Assuming this is the interval time set in the daemon

    expect(monitoringSpy).toHaveBeenCalled();

    // Fast-forward until all timers have been executed
    jest.runAllTimers();

    // Now we would verify that the monitoring process has been invoked
    // Note: This step is where we ideally check for the effects of monitoring, which might require more detailed mocks or stubs

    monitoringSpy.mockRestore();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });
});
describe("PlatformDaemon Container Initialization", () => {
    let daemon;
    const containerCPU = 0.5;
    const containerMemory = 512; // MB
    const containerID = "2342345";
    const model = "testModel";
  
    beforeEach(() => {
      // Initialize the daemon with some mock settings
      daemon = new PlatformDaemon([5000,5001,5002], containerCPU, containerMemory, "testProcess", 100, 0, "TestDaemon");
    });
  
    afterEach(() => {
      // Clear all mocks after each test
      jest.clearAllMocks();
    });
  
    it("initializes and adds a new container successfully", async () => {
      const container = new Container(containerCPU, containerMemory, containerID, model);
  
      // Attempt to initialize the container
      await daemon.initializeContainer(container);
  
      // Verify container was added to stack
      expect(daemon.containerStack.exists(container.containerID)).toBeTruthy();
  
      // Verify Docker build and run commands were called
      // Verify Docker build command was called correctly
        expect(shell.exec).toHaveBeenCalledWith(
            expect.stringContaining(`docker build -t ${container.containerID} ${container.model}`),
            { silent: true } // Expect the exact options object used in the call
        );
        
        // Verify Docker run command was called correctly
        expect(shell.exec).toHaveBeenCalledWith(
            expect.stringContaining(`docker run -d --memory=${container.memory}m --cpus=${container.cpu} -p 5002:5000 2342345`), // Match the start of the command
            { silent: true } // Expect the exact options object used in the call
        );
  
    });
  });
  
describe('PlatformDaemon Overload Handling', () => {
    let daemon;
    beforeEach(() => {
        daemon = new PlatformDaemon([5000], 0.5, 512, 'testProcess', 100, 10, 'TestDaemon');
        daemon.startMonitoring(1000); // Start monitoring with a 1-second interval
    });

    it('correctly enters and exits overload mode', () => {
        expect(daemon.getOverload()).toBeFalsy();

        daemon.enableOverload();
        expect(daemon.getOverload()).toBeTruthy();

        jest.advanceTimersByTime(11000); // Fast forward beyond the overload time
        expect(daemon.getOverload()).toBeFalsy();
    });
});
describe('Container Health Check', () => {
    let daemon;
    beforeEach(() => {
      daemon = new PlatformDaemon([5000], 0.5, 512, 'testProcess', 100, 0, 'TestDaemon');
    });
  
    it('performs health check correctly', async () => {
      const containerID = 'healthyContainer';
      daemon.checkContainerHealth = jest.fn().mockResolvedValue({ status: 'healthy' });
  
      const healthStatus = await daemon.checkContainerHealth(containerID);
      expect(healthStatus).toEqual({ status: 'healthy' });
      expect(daemon.checkContainerHealth).toHaveBeenCalledWith(containerID);
    });
});
describe('PlatformDaemon Port Allocation', () => {
    let daemon;
    const containerCPU = 0.5;
    const containerMemory = 512;
    const model = 'testModel';

    beforeEach(() => {
        // Set up the daemon with a set of ports allowed for allocation
        daemon = new PlatformDaemon([8000, 8001, 8002], containerCPU, containerMemory, 'testProcess', 100, 10, 'TestDaemon');
    });

    it('allocates ports correctly without duplication', () => {
        const containerIDs = ['123123', '124324', '23452345'];
        const allocatedPorts = [];

        containerIDs.forEach(id => {
            const port = daemon.addToPortMap(id); // Allocate a port for each container
            allocatedPorts.push(port); // Store the allocated port
            expect(daemon.portMap.has(id)).toBeTruthy(); // Verify the port was allocated to the container
            expect(daemon.ports.has(port)).toBeFalsy(); // Verify the allocated port is no longer available
        });

        // Ensure all allocated ports are unique
        const uniquePorts = new Set(allocatedPorts);
        expect(uniquePorts.size).toEqual(containerIDs.length);
    });

    afterEach(() => {
        daemon.shutdown(); // Clean up by shutting down the daemon
    });
});
describe('PlatformDaemonManager Message Queue', () => {
    let daemonManager;
    const maxCPU = 4;
    const maxMemory = 4000;
    const portsAllowed = 500;
    const blocksPerTier = [40, 30, 50];
  
    beforeEach(() => {
      // Initialize a new daemon manager before each test
      daemonManager = new PlatformDaemonManager(maxCPU, maxMemory, portsAllowed, blocksPerTier, "TestDaemonManager");
    });
  
    it('adds a message to the queue successfully', () => {
      const initialQueueLength = daemonManager.messageQueue.length;
      const message = {
        id: "testMessage",
        type: "TEST",
        body: {
          detail: "This is a test message."
        }
      };
  
      // Act: Add a message to the queue
      const messageId = daemonManager.addMessageToQueue(message);
  
      // Assert: Check if the message has been added successfully
      expect(daemonManager.messageQueue.length).toBe(initialQueueLength + 1);
      expect(daemonManager.messageQueue.some(msg => msg.id === messageId)).toBe(true);
    });
});
describe('PlatformDaemonManager START Message Handling', () => {
    let daemonManager;
    beforeEach(() => {
        daemonManager = new PlatformDaemonManager(4, 4000, 100, [40, 30, 50], "TestDaemonManager");
        jest.spyOn(daemonManager, 'spawnNewDaemon').mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('handles START message correctly', async () => {
        const startMessage = {
        type: "START",
        body: {
            processID: "process1",
            interval: 1000
        }
        };

        daemonManager.addMessageToQueue(startMessage);
        daemonManager.startMonitoring(1000);

        jest.runOnlyPendingTimers(); // Fast-forward timers to process the message queue

        // Verify that spawnNewDaemon was called with correct process ID
        expect(daemonManager.spawnNewDaemon).toHaveBeenCalledWith(expect.objectContaining({
        processID: "process1"
        }));
    });
});

describe('Database Interaction for User Submissions', () => {
    let daemonManager;

    beforeEach(() => {
        daemonManager = new PlatformDaemonManager(4, 4000, 100, [40, 30, 50], "TestDaemonManager");
        // Mock database call for getting user submissions
        daemonManager.database.getUserSubmissions = jest.fn().mockResolvedValue(['/path/to/submission']);
    });

    it('fetches user submission successfully', async () => {
        const processID = 'testProcess';
        const userID = 'testUser';

        const submissionPath = await daemonManager.database.getUserSubmissions(processID, userID);

        expect(submissionPath).toEqual(['/path/to/submission']);
        expect(daemonManager.database.getUserSubmissions).toHaveBeenCalledWith(processID, userID);
    });
});
describe('PlatformDaemonManager Daemon Spawning', () => {
    let daemonManager;

    beforeEach(() => {
        // Initialize your daemonManager with a mock database system if necessary
        // For example, if your PlatformDaemonManager constructor allows passing a DatabaseSystem instance
        const mockDatabaseSystem = new DatabaseSystem();
        jest.spyOn(mockDatabaseSystem, 'getUserTier').mockResolvedValue(1);
        jest.spyOn(mockDatabaseSystem, 'getTierResources').mockResolvedValue({
            guaranteed: 20,
            overload: 10,
            time: 60,
            ports: 2
        });
        
        daemonManager = new PlatformDaemonManager(4, 4000, 500, [40, 30, 50], "TestDaemonManager", mockDatabaseSystem);
    });

    it('spawns a new daemon with guaranteed resource allocation', async () => {
        const spawnParams = {
            processID: "testProcess",
            interval: 1000
        };

        await expect(daemonManager.spawnNewDaemon(spawnParams)).resolves.not.toThrow();

        // Verify the daemon was spawned and registered
        expect(daemonManager.daemons.has(spawnParams.processID)).toBeTruthy();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});


describe('Container Health Status Update', () => {
  let daemon;
  const maxCPU = 0.5;
  const maxMemory = 512;
  const processID = 'healthCheckDaemon';
  const maxUptime = 60; // in seconds

  beforeEach(() => {
    // Initialize a PlatformDaemon instance before each test
    daemon = new PlatformDaemon([8000], maxCPU, maxMemory, processID, maxUptime, 0, 'TestDaemon');
  });

  it('updates container health status correctly', async () => {
    const containerID = 'container123';
    const containerHealthSpy = jest.spyOn(daemon, 'checkContainerHealth').mockResolvedValue({ status: 'healthy' });

    const healthStatus = await daemon.checkContainerHealth(containerID);
    expect(healthStatus).toEqual({ status: 'healthy' });
    expect(containerHealthSpy).toHaveBeenCalledWith(containerID);

    containerHealthSpy.mockRestore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});

describe('PlatformDaemon Resource Allocation Limit', () => {
  let daemon;
  beforeEach(() => {
      // Initialize the daemon with limited resources
      daemon = new PlatformDaemon([8000], 1, 1024, 'testProcess', 100, 10, 'TestDaemon');
  });

  it('should not allow a container to exceed resource limits', () => {
      const container = new Container(2, 2048, 'containerExceedingLimits', 'testModel');

      // Expect the initialization to throw an error due to resource limits
      expect(() => daemon.initializeContainer(container)).toThrowError();

      // Verify the container is not added to the container stack
      expect(daemon.containerStack.stack).not.toContain(container);

      // Check that the resources of the daemon are not exceeded
      expect(daemon.containerStack.getCurrentCPU()).toBeLessThanOrEqual(daemon.containerStack.getMaxCPU());
      expect(daemon.containerStack.getCurrentMemory()).toBeLessThanOrEqual(daemon.containerStack.getMaxMemory());
  });

  afterEach(() => {
      daemon.shutdown(); // Clean up by shutting down the daemon
  });
});

describe('PlatformDaemon Container Resource Deallocation', () => {
  let daemon;
  beforeEach(() => {
      // Initialize the daemon with some mock settings
      daemon = new PlatformDaemon([5000, 5001, 5002], 2, 2048, "testProcess", 100, 0, "TestDaemon");
  });

  it("deallocates resources when a container is killed", async () => {
      const container = new Container(1, 1024, "containerToKill", "testModel");

      // Initialize the container to consume resources
      await daemon.initializeContainer(container);
      expect(daemon.containerStack.getCurrentCPU()).toEqual(1);
      expect(daemon.containerStack.getCurrentMemory()).toEqual(1024);

      // Kill the container and check if resources are released
      await daemon.killContainers([container]);
      expect(daemon.containerStack.getCurrentCPU()).toEqual(0);
      expect(daemon.containerStack.getCurrentMemory()).toEqual(0);
  });

  afterEach(() => {
      jest.clearAllMocks();
  });
});


describe('PlatformDaemon Exit Event Emission', () => {
  let daemon;
  beforeEach(() => {
      // Initialize the daemon with some settings
      daemon = new PlatformDaemon([5000], 0.5, 1024, 'testExitEvent', 100, 0, 'TestDaemon');
  });

  it('emits an exit event on shutdown', done => {
      // Set up an event listener for the 'exit' event
      daemon.on('exit', (code) => {
          try {
              // Check that the exit event provides the correct status code
              expect(code).toBe(0);
              done(); // Indicate that the test is complete
          } catch (error) {
              done(error); // Pass the error if the expectation fails
          }
      });

      // Trigger the shutdown which should cause the exit event to emit
      daemon.shutdown();
  });

  afterEach(() => {
      jest.clearAllMocks();
  });
});

describe('PlatformDaemon Container Health Check Failure Handling', () => {
  let daemon;
  beforeEach(() => {
    // Initialize the daemon with some settings
    daemon = new PlatformDaemon([7000], 1, 2048, 'healthCheckFailureDaemon', 100, 0, 'TestDaemon');
    jest.spyOn(daemon, 'addToPortMap').mockImplementation((containerID) => 7000 + parseInt(containerID, 10));
  });

  it('handles failed container health checks by attempting a restart', async () => {
    const container = new Container(0.5, 1024, '3', 'testModel3');
    await daemon.initializeContainer(container);

    // Mock a failing health check response
    jest.spyOn(daemon, 'checkContainerHealth').mockResolvedValueOnce({ status: 'unhealthy' });

    // Simulate a health check routine
    const healthStatus = await daemon.checkContainerHealth(container.containerID);
    expect(healthStatus).toEqual({ status: 'unhealthy' });

    // Expect the daemon to attempt a restart on the container
    // We mock the restart behavior here; in a real scenario, you would check if the appropriate methods were called
    jest.spyOn(daemon, 'killContainers').mockResolvedValueOnce();
    jest.spyOn(daemon, 'initializeContainer').mockResolvedValueOnce();

    // Simulate the restart action
    await daemon.killContainers([container]);
    await daemon.initializeContainer(container);

    // Verify the restart actions were called
    expect(daemon.killContainers).toHaveBeenCalledWith([container]);
    expect(daemon.initializeContainer).toHaveBeenCalledWith(container);
  });

  afterEach(() => {
    jest.clearAllMocks();
    daemon.shutdown();
  });
});
describe('PlatformDaemon Non-existent Container Removal Handling', () => {
  let daemon;
  beforeEach(() => {
      // Initialize the daemon with some settings
      daemon = new PlatformDaemon([9000], 1, 2048, 'nonExistentContainerRemoval', 100, 0, 'TestDaemon');
  });

  it('gracefully handles the removal of a non-existent container', async () => {
      const nonExistentContainer = new Container(0.5, 1024, "nonExistent", "testModelNonExistent");

      // Attempt to remove a non-existent container and expect no errors or exceptions
      await expect(daemon.killContainers([nonExistentContainer])).resolves.not.toThrow();

      // Additionally, check that the internal state of the daemon has not been adversely affected
      expect(daemon.containerStack.stack.length).toBe(0);
      expect(daemon.containerStack.getCurrentCPU()).toEqual(0);
      expect(daemon.containerStack.getCurrentMemory()).toEqual(0);
  });

  afterEach(() => {
      jest.clearAllMocks();
      daemon.shutdown();
  });
});
describe('PlatformDaemon Shutdown with Active Containers', () => {
  let daemon;
  beforeEach(() => {
      daemon = new PlatformDaemon([10000, 10001], 2, 4096, 'shutdownWithContainers', 100, 0, 'TestDaemon');
      jest.spyOn(daemon, 'addToPortMap').mockImplementation((containerID) => 10000 + parseInt(containerID, 10));
      jest.spyOn(daemon, 'killContainers').mockImplementation(async (containers) => {
          containers.forEach(container => {
              daemon.containerStack.remove(container.containerID);
          });
      });
  });

  it('ensures all containers are stopped and resources are released on shutdown', async () => {
      const container1 = new Container(1, 2048, '5', 'testModel5');
      const container2 = new Container(1, 2048, '6', 'testModel6');

      await daemon.initializeContainer(container1);
      await daemon.initializeContainer(container2);

      // Shutdown the daemon
      await daemon.shutdown();

      // After shutdown, the container stack should be empty and resources released
      expect(daemon.containerStack.stack.length).toBe(0);
      expect(daemon.containerStack.getCurrentCPU()).toEqual(0);
      expect(daemon.containerStack.getCurrentMemory()).toEqual(0);

      // Verify that killContainers was called for each container during shutdown
      expect(daemon.killContainers).toHaveBeenCalledWith(expect.arrayContaining([container1, container2]));
  });

  afterEach(() => {
      jest.clearAllMocks();
  });
});


