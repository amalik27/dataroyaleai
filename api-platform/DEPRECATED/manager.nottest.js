const { PlatformDaemonManager, getSystemState } = require('../platformManager');
const { PlatformDaemon, Container } = require('../platformDaemon');

// Mocking the dependencies
jest.mock('./daemon', () => ({
  PrometheusDaemon: jest.fn().mockImplementation(() => ({
    startMonitoring: jest.fn(),
    on: jest.fn(),
    initializeContainer: jest.fn(),
    checkContainerHealth: jest.fn(() => Promise.resolve({ status: 'healthy' })),
    shutdown: jest.fn(),
    setResourceLimits: jest.fn(),
  })),
  Container: jest.fn(),
}));

describe('PrometheusDaemonManager', () => {
  let manager;

  beforeEach(() => {
    // Assume these are the required arguments for initializing the manager
    manager = new PrometheusDaemonManager(100, 200, [5000, 6000], [10, 20, 30]);
  });

  it('should initialize correctly', () => {
    expect(manager).toBeDefined();
    expect(manager.maxCPU).toBe(100);
    expect(manager.maxMemory).toBe(200);
    // Add more assertions as needed
  });

  it('should add messages to the queue and fetch their status', () => {
    const message = {
      id: 'testMessage',
      type: 'START',
      body: {},
      priority: 1,
      tier: 1,
    };

    const messageId = manager.addMessageToQueue(message);
    expect(manager.messageQueue.length).toBe(1);
    expect(manager.fetchMessageStatus(messageId)).toEqual({ status: 'QUEUED', place: 0 });
  });

  it('should initialize a container correctly', () => {
    const processID = 'testProcess';
    const container = new Container(0.1, 50, 'testContainer', 'testModel');

    manager.daemons.set(processID, new PrometheusDaemon());
    manager.initializeContainer(processID, container);

    const daemon = manager.daemons.get(processID);
    expect(daemon.initializeContainer).toHaveBeenCalledWith(container);
  });

  it('should handle container health checks', async () => {
    const processID = 'testProcess';
    const containerID = 'testContainer';

    manager.daemons.set(processID, new PrometheusDaemon());
    const healthStatus = await manager.healthCheck(processID, containerID);

    expect(healthStatus).toEqual({ status: 'healthy' });
    const daemon = manager.daemons.get(processID);
    expect(daemon.checkContainerHealth).toHaveBeenCalledWith(containerID);
  });

  // Add more tests for other methods like spawning daemons, killing daemons, setting resources, etc.

});

// Test for getSystemState function
describe('Utility functions', () => {
  it('getSystemState should return the correct state', () => {
    const manager = new PrometheusDaemonManager(100, 200, [5000, 6000], [10, 20, 30]);
    const state = getSystemState(manager);

    expect(state).toBeDefined();
    expect(state.daemons).toBeDefined();
    // Add more assertions based on the expected structure of the system state
  });

  // More tests for other utility functions if necessary
});

describe('API call forwarding', () => {
  let manager;

  // Initialize the manager before each test
  beforeEach(() => {
    // Assuming these are the required arguments for initializing the manager
    manager = new PrometheusDaemonManager(100, 200, [5000, 6000], [10, 20, 30]);
  });

  it('should forward an API call to the correct container and return the response', async () => {
    const processID = 'testProcess';
    const containerID = 'testContainer';
    const mockRequestBody = { key: 'value' };
    const mockResponseData = 'mock response data';

    // Mock the forward function to simulate the daemon forwarding the request and returning a response
    const mockForwardFunction = jest.fn().mockResolvedValue(mockResponseData);
    const mockDaemon = new PrometheusDaemon();
    mockDaemon.forward = mockForwardFunction;

    manager.daemons.set(processID, mockDaemon);

    // Perform the forward operation
    const responseData = await manager.forward(processID, containerID, mockRequestBody);

    // Assertions to ensure the forward function is called with correct parameters
    expect(mockForwardFunction).toHaveBeenCalledWith({
      processID: processID,
      containerID: containerID,
      body: mockRequestBody,
    }, '127.0.0.1');

    // Verify the response data
    expect(responseData).toBe(mockResponseData);
  });
});

