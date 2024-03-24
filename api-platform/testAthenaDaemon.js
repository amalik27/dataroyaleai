const AthenaDaemon = require('./athenaDaemon');
const PlatformDaemon = require("./platformDaemon");

// Mocking PlatformDaemon to avoid implementation specifics
class PlatformDaemon {
    constructor(port, maxCPU, maxMemory, processID, maxUptime, something, name) {
        // Implementation not required for the test
    }

    checkContainerHealth(containerTag) {
        // Mocking a healthy container response
        return Promise.resolve({ status: 'healthy' });
    }

    forward({ containerID, body }) {
        // Mocking a response from the model
        return Promise.resolve(JSON.stringify({ result: Math.random() })); // Random result for demonstration
    }
}

// Substituting the real PlatformDaemon with the mocked one for testing
AthenaDaemon.__proto__ = PlatformDaemon.prototype;

// Initialize AthenaDaemon
const athenaDaemon = new AthenaDaemon(8080, '100%', '1GB', 'process-123', 3600);

// Listen to the dataRecordingStarted event
athenaDaemon.eventEmitter.on('dataRecordingStarted', () => {
    console.log('Data recording has started.');
});

// Listen to the dataRecordingStopped event
athenaDaemon.eventEmitter.on('dataRecordingStopped', () => {
    console.log('Data recording has stopped.');
});

// Call evaluateModel to trigger the events
// Note: Replace 'dummy.csv', 'container-123', ['x'], ['y'], and 'mae' with your actual parameters
athenaDaemon.evaluateModel('dummy.csv', 'container-123', ['x'], ['y'], 'mae')
    .then(score => {
        console.log('Evaluation completed with score:', score);
    })
    .catch(error => {
        console.error('Evaluation failed with error:', error);
    });
