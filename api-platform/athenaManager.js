const AthenaDaemon = require('./athenaDaemon');
const { PlatformDaemonManager, DaemonNotFoundError, DatabaseSystem, GuaranteeResourceAllocationError } = require('./platformManager');
const chalk = require('chalk');
const util = require('util');
const db = require('../backend/db.js')
const mysql = require('mysql');
//Inherit from PrometheusManager
class AthenaManager extends PlatformDaemonManager {
    
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier) {
        super(maxCPU, maxMemory, portsAllowed, blocksPerTier, "Athena", new AthenaDatabaseSystem());
        
    }

    //Entrypoint for most actions in the system
    startMonitoring(intervalTime) {
        console.log(chalk.blue(`[${this.name}] Starting monitoring`));
        if (!this.interval) {
          this.interval = setInterval(async () => {
            if (this.messageQueue.length!=0) {
                //MAKE SURE TO DQ MESSAGE IF WE ACT ON IT
                
                let message = this.messageQueue[0];//Peek
                
                if(message.type === "START"){
                    try{
                        await this.spawnNewDaemon(message.body);
                         //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof GuaranteeResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                        } else{
                            console.log(chalk.red(e.message));
                            this.messageQueue.shift();
                            message.status = "FAILED";
                            this.messageHistory.push(message);
                        }
                    } 
                    
                } else if(message.type === "EVALUATE"){
                    handleEval(message);
                } 
                else{ 
                    //Dequeue if not a system message
                    this.messageQueue.shift();
                }
                //message queue length
                console.log(chalk.blue(`[${this.name}] Message queue length: ${this.messageQueue.length}`));
            }
          }, intervalTime);
        }
    }

    async handleEval(message){
        try{
            this.messageQueue.shift();
            await this.initializeContainer(message.body.processID,message.body);
            //Create body mapper....somehow
            await this.evaluateModel(message.body.processID, message.body.userID,await this.database.getCompetitionDataset(message.body.processID), message.body.containerID, message.body.inputs, message.body.outputs, message.body.metric);

            message.status = "SUCCESS";
            this.messageHistory.push(message);
        }
        catch (e){
            console.log(chalk.red(e.message));
            this.messageQueue.shift();
            message.status = "FAILED";
            this.messageHistory.push(message);
        }
    }
    addMessageToQueue(message) {
        //Add unique ID to message, make sure it is somehow unique.
        message.id = Math.random().toString(36).substr(2, 9) 
        message.status = "QUEUED";
        this.messageQueue.push(message);
        //Sort the queue so evaluate requests always come first, these are always assumed to be bounded and easiest to handle. It is also a non-blocking operation
        this.messageQueue.sort((a,b) => {
            if(a.type === "EVALUATE") return -1;
            if(b.type === "EVALUATE") return 1;
            return 0;
        });

        return message.id;
    }
     /**
     * Initializes a container for a specific process on a daemon.
     * @param {string} processID - The ID of the process.
     * @param {string} container - The container to be initialized.
     * @throws {DaemonNotFoundError} If no daemon is found with the specified process ID.
     */
     async initializeContainer(processID,container) {
        // Logic to start a process on a daemon
        if (this.daemons.get(processID)) {
            //Always set container specs to maximum for daemon
            let daemon = this.daemons.get(processID);
            container.cpu = daemon.containerStack.getMaxCPU();
            container.memory = daemon.containerStack.getMaxMemory();
            //Get user submission from database
            let userSubmission = await this.database.getUserSubmissions(container.processID, container.userID);
            container.model = userSubmission;
            
            this.daemons.get(processID).queue.push(container.containerID);
            while(this.daemons.get(processID).queue[0] != container.containerID){
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
            this.daemons.get(processID).initializeContainer(container);
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
     }

    //New method for initializing container and immediately beginning evaluation
    async evaluateModel(processID, userID, filePath, containerID, columnNameX, columnNameY) {

        // Check if the daemon exists
        if (!this.daemons.has(processID)) {
            throw new DaemonNotFoundError(`Daemon ${processID} does not exist`);
        }


        let metrics = await this.database.getCompetitionMetrics(processID);
        // Get reference to the daemon
        const daemon = this.daemons.get(processID);
        // Begin inferences and wait for the score
        const {score, AstatsData} = await daemon.evaluateModel(filePath, containerID, columnNameX, columnNameY,metrics).then(score => {
            // Log the score
            console.log(`Score for ${processID}: ${score}`);
            
            // Add score to leaderboard
            this.database.addScoreToLeaderboard(processID, userID, parseFloat(score));
        
            // Return the score to the caller
            return score;
        });
        
        
    }
    async spawnNewDaemon(parameters) {
        //Try allocations. If we fail, we deallocate and throw an error
        if (this.daemons.get(parameters.processID)) {
            throw new AlreadyRegisteredError(chalk.red(`Daemon with process ID ${parameters.processID} is already registered`));
        }
        
        let tier, resources, ports;
        parameters.ports = 1; 
        try{
            tier = await this.database.getUserTier(parameters.processID);
            resources = await this.database.getTierResources(tier);
            resources.processID = parameters.processID; //Terrible ik
            ports = await this.resourceMonitor.allocateProcess(resources);
        } catch(e){
            throw e;
        }
        //Allocations succeed, move on.
        //Create new daemon with the guarantee blocks asssigned to it based on its tier
        const daemon = new AthenaDaemon(ports, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockCPU, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockMemory, parameters.processID, parameters.uptime, 3);
        daemon.startMonitoring(parameters.interval);
        this.registerDaemon(parameters.processID, daemon);
        //Get submissions
        let submissions = await this.database.getSubmissions(parameters.processID);
        //Submit evaluate requests for each submission
        for(let submission of submissions){
            this.addMessageToQueue({
            type: "EVALUATE",
                body: {
                    processID: parameters.processID,
                    userID: submission.user_id,
                    containerID: submission.file_path,
                    inputs: submission.inputs_outputs.inputs,
                    outputs: submission.inputs_outputs.outputs,
                    }
                }
            );
        }
        //Set competition status to evaluating
        this.database.setCompetitionStatus(parameters.processID, 'evaluating');

        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[${this.name}] Daemon child ${parameters.processID} died with status ${code}`));
            //Print daemons
            
            console.log(chalk.gray(`[${this.name}] Daemons: ${Array.from(this.daemons.keys())}`));
            this.unregisterDaemon(parameters.processID);
            this.resourceMonitor.processExitCleanup(parameters.processID);
            //Set competition status to complete
            this.database.setCompetitionStatus(parameters.processID, 'complete');

          });
        //TODO:Overload callback function
        daemon.on('overload-exit', () => {
            console.log(chalk.red(`[${this.name}] Daemon child ${parameters.processID} has exited overload mode. THIS SHOULD NOT HAPPEN. WE SHOULD NOT BE HERE.`));
            this.resourceMonitor.overloadDeallocationQueue.push(parameters.processID);
          });
    }

}

//Extend database system to include competition leaderboards and user submissions
//User submissions represented as filepaths + competitionID + userID
//Competitions represented as competitionID + competitionName + competitionDescription + competitionLeaderboard
//CompetitionLeaderboard represented as competitionID + userID + score
class AthenaDatabaseSystem extends DatabaseSystem {
    constructor() {
        super();
        this.query = util.promisify(db.query).bind(db);
    }

    

    async createCompetition(id, title, description, file_path) {
        const sql = "INSERT INTO Competitions (id, title, description, file_path) VALUES (?, ?, ?, ?, ?)";
        await this.query(sql, [id, title, description, file_path]);
    }

    async getCompetitionDataset(id) {
        const sql = "SELECT file_path FROM Competitions WHERE id = ?";
        const results = await this.query(sql, [id]);
        return results.length ? results[0].file_path : null;
    }

    async getCompetitionMetrics(id) {
        const sql = "SELECT metrics FROM Competitions WHERE id = ?";
        const results = await this.query(sql, [id]);
        return results.length ? results[0].metrics : null;
    }

    async addUserSubmission(comp_id, user_id, file_path) {
        // Adjusted to match the Submissions table schema.
        // Note: Assuming `score` is to be updated separately.
        const sql = "INSERT INTO Submissions (comp_id, user_id, file_path) VALUES (?, ?, ?)";
        await this.query(sql, [comp_id, user_id, file_path]);
    }

    async addScoreToLeaderboard(comp_id, user_id, score) {
        // Find submissions where comp_id and user_id match, then update score in SUBMISSIONS table
        const sql = "UPDATE Submissions SET score = ? WHERE comp_id = ? AND user_id = ?"
        await this.query(sql, [score, comp_id, user_id]);
    }

    async getLeaderboard(comp_id) {
        const sql = "SELECT user_id, score FROM Leaderboard WHERE comp_id = ? ORDER BY score DESC";
        const results = await this.query(sql, [comp_id]);
        return results;
    }

    async getUserSubmissions(comp_id, user_id) {
        const sql = "SELECT file_path FROM Submissions WHERE comp_id = ? AND user_id = ?";
        const results = await this.query(sql, [comp_id, user_id]);
        return results.map(submission => submission.file_path);
    }

    //Get all submissions in competition
    async getSubmissions(comp_id) {
        const sql = "SELECT user_id, file_path FROM submissions WHERE comp_id = ?";
        const results = await this.query(sql, [comp_id]);
        return results;
    }

    async getUserTier(compID) {
        //First grab the prize amount from the competitions database
        const sql = "SELECT prize FROM competitions WHERE id = ?";
        const results = await this.query(sql, [compID]);
        if (results.length > 0) {
            //If prize pool is between 0-100, get tier 1
            if (results[0].prize <= 100) return 3;
            if (results[0].prize <= 1000) return 2;
            if (results[0].prize > 1000) return 1;
        } else {
            throw new Error('Competition not found');
        }
    }

    //Set a competition's status to 'evaluating'', 'pending', or 'complete'
    async setCompetitionStatus(compID, status) {
        const sql = "UPDATE competitions SET status = ? WHERE id = ?";
        await this.query(sql, [status, compID]);
    }


}


let Athena = new AthenaManager(4, 4000, 500, blocksPerTier = [40, 40, 40]);
Athena.startMonitoring(1000);
module.exports = { Athena, AthenaManager, AthenaDatabaseSystem };