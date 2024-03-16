const express = require('express');
const { PrometheusDaemonManager, getSystemState} = require('./manager');
const {Container} = require('./daemon');
const app = express();


app.use(express.json());
let manager;
// Define routes
app.get('/manager/displayUsage', (req, res) => {
    // Call the appropriate function from your manager.js file
    const result = getSystemState(manager);
    // Send the result as the response
    res.json(result);
});

app.post('/manager/addMessage', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).send('Message is required.');
    }
    try {
        let id = manager.addMessageToQueue(message);
        res.json({ messageID: id });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/manager/messageStatus', (req, res) => {
    const { messageID } = req.body;
    if (!messageID) {
        return res.status(400).send('Message is required.');
    }
    try {
        let status = manager.fetchMessageStatus(messageID);
        res.json(status);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/manager/startContainer', (req, res) => {
    const { message } = req.body;
    if (!message || !message.processID || !message.body) {
        return res.status(400).send('Complete message with processID and body is required.');
    }
    try {
        // Notice how message.body is passed along with the processID
        let container = new Container(message.body.cpus, message.body.memory, message.body.containerID, message.body.model);
        console.log(container.toString());
        manager.initializeContainer(message.processID, container); // Adjusted to pass message.body
        res.send('Container initialization started.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});


app.post('/manager/forward', async (req, res) => {
    const { processID, containerID, body } = req.body;
    if (!processID || !containerID || !body) {
        return res.status(400).send('Process ID and Container ID and body are required.');
    }
    try {
        console.log(`Forwarding request to container ${containerID} for process ${processID}.`)
        let data =  await manager.forward(processID, containerID, body);
        console.log(data);
         res.status(200).send(data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Kill endpoint
app.post('/manager/kill', (req, res) => {
    const { processID } = req.body;
    if (!processID) {
        return res.status(400).send('Process ID is required.');
    }
    try {
        manager.killProcessDaemon(processID);
        res.send('Process killed.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/manager/health', async (req, res) => {
    const {processID,containerID} = req.body;
    try{
        health = await manager.healthCheck(processID,containerID);
        console.log(health);
        res.json(health);
        res.status(200).send();
    }catch(error){
        res.status(500).send(error.message);
    }
    
});

//See manager queue
app.get('/manager/queue', (req, res) => {
    res.json(manager.queue);
});

// Start the server
const port = 3000;
app.listen(port, () => {
    manager = new PrometheusDaemonManager(4,4000,500,blocksPerTier = [40, 30, 50]);
    manager.startMonitoring(1000);
    console.log(`Server is running on port ${port}`);
});