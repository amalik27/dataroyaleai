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

describe('PrometheusDaemonManager - reapOrphanContainers', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new PrometheusDaemonManager();
    manager.daemons = {
      daemon1: { getRunningContainers: () => ['container1', 'container2'] },
      daemon2: { getRunningContainers: () => ['container3'] },
    };
  });

  test('should not remove any containers when there are no orphans', () => {
    shell.exec.mockImplementationOnce((command, options, callback) => {
      callback(0, 'container1\ncontainer2\ncontainer3', '');
    });

    manager.reapOrphanContainers();

    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());
    expect(shell.exec).not.toHaveBeenCalledWith(expect.stringContaining('docker rm'), expect.anything(), expect.anything());
  });

  test('should remove orphan containers', () => {
    shell.exec.mockImplementationOnce((command, options, callback) => {
      // Simulating docker ps listing extra containers
      callback(0, 'container1\ncontainer2\ncontainer3\norphan1\norphan2', '');
    }).mockImplementationOnce((command, options, callback) => {
      if (command.includes('docker rm')) {
        callback(0, '', ''); // Simulate successful removal
      }
    });

    manager.reapOrphanContainers();

    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm orphan1'), expect.anything(), expect.anything());
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm orphan2'), expect.anything(), expect.anything());
  });

  test('should handle errors during orphan container removal', () => {
    shell.exec.mockImplementationOnce((command, options, callback) => {
      // Simulating docker ps listing an extra container
      callback(0, 'container1\ncontainer2\ncontainer3\norphan1', '');
    }).mockImplementationOnce((command, options, callback) => {
      if (command.includes('docker rm')) {
        callback(1, '', 'Error removing container'); // Simulate removal error
      }
    });

    manager.reapOrphanContainers();

    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker ps -a'), expect.anything(), expect.anything());
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('docker rm orphan1'), expect.anything(), expect.anything());
  });
});
