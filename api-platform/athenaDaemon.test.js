const AthenaDaemon = require('./athenaDaemon');
const EventEmitter = require('events');
const shell = require('shelljs');

jest.mock('shelljs', () => ({
  exec: jest.fn(),
}));

describe('AthenaDaemon', () => {
  let athenaDaemon;

  beforeEach(() => {
    athenaDaemon = new AthenaDaemon([3000], 0.5, 500, 'user123', 10);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Emitter', () => {
    it('should emit "dataRecordingStarted" when data recording starts', () => {
      const spy = jest.spyOn(EventEmitter.prototype, 'emit');
      // Trigger the start of data recording
      athenaDaemon.dataRecording = true;
      athenaDaemon.eventEmitter.emit('dataRecordingStarted');
      expect(spy).toHaveBeenCalledWith('dataRecordingStarted');
    });

    it('should emit "dataRecordingStopped" when data recording stops', () => {
      const spy = jest.spyOn(EventEmitter.prototype, 'emit');
      // Trigger the stop of data recording
      athenaDaemon.dataRecording = false;
      athenaDaemon.eventEmitter.emit('dataRecordingStopped');
      expect(spy).toHaveBeenCalledWith('dataRecordingStopped');
    });
  });

  describe('Hardware Data Collection', () => {
    it('should collect hardware usage data', async () => {
      const mockOutput = '5% 100MiB/500MiB';
      shell.exec.mockImplementation(() => ({ code: 0, stdout: mockOutput }));

      const stats = await athenaDaemon.getContainerStats('containerID');

      expect(stats).toEqual({ cpuUsage: '5%', memoryUsage: '100MiB/500MiB' });
      expect(shell.exec).toHaveBeenCalledWith('docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" containerID', { silent: true });

    });
  });

  // Additional tests for other methods and error handling can be added here
});
