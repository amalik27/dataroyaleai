const { PrometheusDaemonManager } = require('./manager');
const { PrometheusDaemon } = require('./daemon');
const shell = require('shelljs');
const chalk = require('chalk');

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
  
});


jest.mock('shelljs', () => ({
  exec: jest.fn(),
}));

describe('PrometheusDaemonManager', () => {
  let manager;

  beforeEach(() => {
    // Reset the shelljs mock for each test
    jest.clearAllMocks();
    manager = new PrometheusDaemonManager();
  });

  test('reapOrphanContainers should remove orphan containers', () => {
    // Mock shell.exec to simulate docker commands
    shell.exec.mockImplementationOnce((command, options, callback) => {
      if (command.includes('docker ps -a')) {
        // Simulate finding orphan containers
        callback(0, 'container1\ncontainer2', '');
      } else if (command.includes('docker rm')) {
        // Simulate successful container removal
        callback(0, '', '');
      }
    });

    manager.reapOrphanContainers();

    // Check if docker ps command was called
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());

    // Check if docker rm command was called for each container
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm container1'), expect.anything(), expect.anything());
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm container2'), expect.anything(), expect.anything());
  });
});

describe('PrometheusDaemonManager error handling', () => {
  let manager;

  beforeEach(() => {
    // Reset the shelljs mock for each test
    jest.clearAllMocks();
    manager = new PrometheusDaemonManager();
  });

  test('should handle errors when listing orphan containers', () => {
    // Simulate an error when trying to list orphan containers
    shell.exec.mockImplementationOnce((command, options, callback) => {
      if (command.includes('docker ps -a')) {
        // Simulate an error
        callback(1, '', 'Error listing containers');
      }
    });

    manager.reapOrphanContainers();

    // Check if docker ps command was called and failed
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());
    // Since there's an error, docker rm should not be called
    expect(shell.exec).not.toHaveBeenCalledWith(expect.stringContaining('docker rm'), expect.anything(), expect.anything());
  });

  test('should handle errors when removing orphan containers', () => {
    // First call simulates finding orphan containers, second call simulates an error during removal
    shell.exec.mockImplementation((command, options, callback) => {
      if (command.includes('docker ps -a')) {
        // Simulate finding one orphan container
        callback(0, 'container1', '');
      } else if (command.includes('docker rm container1')) {
        // Simulate an error during container removal
        callback(1, '', 'Error removing container');
      }
    });

    manager.reapOrphanContainers();

    // Check if docker ps command was called
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());
    // Check if docker rm command was called and failed
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm container1'), expect.anything(), expect.anything());
  });
});
