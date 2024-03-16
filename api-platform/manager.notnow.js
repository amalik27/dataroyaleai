const { PrometheusDaemonManager } = require('./manager');
const { PrometheusDaemon } = require('./daemon');

jest.mock('./daemon', () => {
  return {
    PrometheusDaemon: jest.fn().mockImplementation(() => {
      return {
        initializeContainers: jest.fn(),
        addProcess: jest.fn(),
        stopMonitoring: jest.fn(),
        killContainers: jest.fn(),
        getRunningContainers: jest.fn(),
        rerouteAPICall: jest.fn(),
      };
    }),
  };
});

describe('PrometheusDaemonManager', () => {
  let manager;
  const processID = 'testProcess';
  const containerIDs = ['container1', 'container2'];
  const maxMemory = 100;
  const cpus = 0.5;

  beforeEach(() => {
    manager = new PrometheusDaemonManager();
  });

  test('should register and unregister a daemon', () => {
    manager.registerDaemon(processID, new PrometheusDaemon());
    expect(manager.daemons[processID]).toBeDefined();
    
    manager.unregisterDaemon(processID);
    expect(manager.daemons[processID]).toBeUndefined();
  });
  test('should keep process in queue if no resources are available', () => {
    // Setup: Create and register a daemon instance
    const daemon = new PrometheusDaemon();
    manager.registerDaemon(processID, daemon);
  
    // Add a process to the queue that requires resources beyond what's available
    const process = {
      processID,
      containerIDs,
      maxMemory,
      cpus,
      tier: 1, // Assume tier 1 for highest priority
      priority: 1,
      allocatedBlock: null // This will be set by allocateResources
    };
    manager.addProcessToQueue(process);
  
    // Act
    manager.allocateResources();
  
    // Assert
    // Check if the process is still in the queue awaiting resource allocation
    expect(manager.processQueue.length).toBe(1);
    // Ensure that the process has not been started
    expect(daemon.initializeContainers).not.toHaveBeenCalled();
  });
  test('Issue instruction to daemon to initialize a container.', () => {
    manager.registerDaemon(processID, new PrometheusDaemon());
    expect(manager.daemons[processID]).toBeDefined();
    
    manager.unregisterDaemon(processID);
    expect(manager.daemons[processID]).toBeUndefined();
  });
});



