const express = require('express');
const { PlatformDaemonManager, getSystemState} = require('./platformManager');
const { AthenaManager } = require('./athenaManager');
const {Container} = require('./platformDaemon');
const app = express();
const multer = require('multer');

app.use(express.json());
let manager;
let AthenaManagerInstance;
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

//Manager get models
app.get('/manager/models', (req, res) => {
    res.json(manager.database.getAllModels());
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

//HOW TO DO IMAGES:
// Set up storage engine with multer for where and how to save files
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, './uploads'); // Set the destination where to save the uploaded files
    },
    filename: function(req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Name the file uniquely
    }
  });
  
const upload = multer({ storage: storage });
app.post('/upload-image', upload.single('file'), (req, res) => {
if (!req.file) {
    return res.status(400).send('No file uploaded.');
}
res.send(`File uploaded successfully. Filename: ${req.file.filename}`);
});

//Endpoints for Athena

//Display usage
app.get('/athena/displayUsage', (req, res) => {
    // Call the appropriate function from your manager.js file
    const result = getSystemState(AthenaManagerInstance);
    // Send the result as the response
    res.json(result);
});

//Add message
app.post('/athena/addMessage', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).send('Message is required.');
    }
    try {
        let id = AthenaManagerInstance.addMessageToQueue(message);
        res.json({ messageID: id });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Endpoints for the database system for athena
app.get('/athena/database', (req, res) => {
    res.json(AthenaManagerInstance.databaseSystem.getDBState());
});
//All the add endpoints
app.post('/athena/database/addCompetition', (req, res) => {
    const { competitionID, competitionName, competitionDescription, competitionDataset} = req.body;
    if (!competitionID || !competitionName || !competitionDescription || !competitionDataset) {
        return res.status(400).send('Competition ID, name and description are required.');
    }
    try {
        AthenaManagerInstance.databaseSystem.createCompetition(competitionID, competitionName, competitionDescription,competitionDataset);
        res.send('Competition added.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/athena/database/addUserSubmission', (req, res) => {
    const { competitionID, userID, filePath } = req.body;
    if (!competitionID || !userID || !filePath) {
        return res.status(400).send('Competition ID, user ID and file path are required.');
    }
    try {
        AthenaManagerInstance.databaseSystem.addUserSubmission(competitionID, userID, filePath);
        res.send('User submission added.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/athena/database/addScoreToLeaderboard', (req, res) => {
    const { competitionID, userID, score } = req.body;
    if (!competitionID || !userID || !score) {
        return res.status(400).send('Competition ID, user ID and score are required.');
    }
    try {
        AthenaManagerInstance.databaseSystem.addScoreToLeaderboard(competitionID, userID, score);
        res.send('Score added to leaderboard.');
    } catch (error) {
        res.status(500).send(error.message);
    }
}
);

//Get leaderboard
app.get('/athena/database/getLeaderboard', (req, res) => {
    const { competitionID } = req.body;
    if (!competitionID) {
        return res.status(400).send('Competition ID is required.');
    }
    try {
        const leaderboard = AthenaManagerInstance.databaseSystem.getLeaderboard(competitionID);
        res.json(leaderboard);
    } catch (error) {
        res.status(500).send(error.message);
    }
});




// Start the server
const port = 3000;
app.listen(port, () => {
    manager = new PlatformDaemonManager(4,4000,500,blocksPerTier = [40, 30, 50]);
    manager.startMonitoring(1000);
    AthenaManagerInstance = new AthenaManager(4,4000,500,blocksPerTier = [40, 40, 40]);
    AthenaManagerInstance.startMonitoring(1000);
    console.log(`Server is running on port ${port}`);
});