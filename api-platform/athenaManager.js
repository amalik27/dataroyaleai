const AthenaDaemon = require('./athenaDaemon');
const { PlatformDaemonManager, DaemonNotFoundError, DatabaseSystem, GuaranteeResourceAllocationError } = require('./platformManager');
const chalk = require('chalk');
const util = require('util');
const db = require('../backend/db.js')
const mysql = require('mysql');
//Inherit from PrometheusManager
class AthenaManager extends PlatformDaemonManager {
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier) {
        super(maxCPU, maxMemory, portsAllowed, blocksPerTier, "Athena")
        this.databaseSystem = new AthenaDatabaseSystem();
    }
    startMonitoring(intervalTime) {
        if (!this.interval) {
          this.interval = setInterval(() => {
            if (this.messageQueue.length!=0) {
                //MAKE SURE TO DQ MESSAGE IF WE ACT ON IT
                
                let message = this.messageQueue[0];//Peek
                
                if(message.type === "START"){
                    try{
                        this.spawnNewDaemon(message.body);
                         //Dequeue if prior succeeeds
                        this.messageQueue.shift();
                        message.status = "SUCCESS";
                        this.messageHistory.push(message);
                    } catch (e){
                        if(e instanceof GuaranteeResourceAllocationError){
                            message.status = "WAITING FOR RESOURCES";
                        } else{
                            console.log(e.message);
                            this.messageQueue.shift();
                            message.status = "FAILED";
                            this.messageHistory.push(message);
                        }
                    } 
                    
                } else if(message.type === "EVALUATE"){
                    try{
                    this.initializeContainer(message.body.processID,message.body);
                    //Create body mapper....somehow

                    


                    this.evaluateModel(message.body.processID, message.body.competitionID,this.databaseSystem.getCompetitionDataset(message.body.competitionID), message.body.containerID, message.body.inputs, message.body.outputs, message.body.metric);

                    this.messageQueue.shift();
                    message.status = "SUCCESS";
                    this.messageHistory.push(message);
                    }
                    catch (e){
                        console.log(e.message);
                        this.messageQueue.shift();
                        message.status = "FAILED";
                        this.messageHistory.push(message);
                    }

                    
                } else{ 
                    //Dequeue if not a system message
                    this.messageQueue.shift();
                }
                //message queue length
                console.log(chalk.blue(`[${this.name}] Message queue length: ${this.messageQueue.length}`));
            }
          }, intervalTime);
        }
    }
    // addMessageToQueue(message) {
    //     //Add unique ID to message, make sure it is somehow unique.
    //     message.id = Math.random().toString(36).substr(2, 9) 
    //     message.status = "QUEUED";
    //     this.messageQueue.push(message);
    //     // Sort the queue first by tier and then by priority within each tier
    //     this.messageQueue.sort((a, b) => {
    //         if (a.tier === b.tier) {
    //             return a.priority - b.priority;
    //         }
    //         return a.tier - b.tier;
    //     });
    //     return message.id;
    // }
     /**
     * Initializes a container for a specific process on a daemon.
     * @param {string} processID - The ID of the process.
     * @param {string} container - The container to be initialized.
     * @throws {DaemonNotFoundError} If no daemon is found with the specified process ID.
     */
     initializeContainer(processID,container) {
        // Logic to start a process on a daemon
        if (this.daemons.get(processID)) {
            //Always set container specs to maximum for daemon
            let daemon = this.daemons.get(processID);
            container.cpu = daemon.containerStack.getMaxCPU();
            container.memory = daemon.containerStack.getMaxMemory();
            //Get user submission from database
            let userSubmission = this.databaseSystem.getUserSubmissions(container.competitionID, container.userID);
            container.model = userSubmission;
            this.daemons.get(processID).initializeContainer(container);
        } else {
            throw new DaemonNotFoundError(`No daemon found with process ID ${processID}`);
        }
     }

    //New method for initializing container and immediately beginning evaluation
    async evaluateModel(processID, competitionID, filePath, containerID, columnNameX, columnNameY, metric) {
        // Check if the daemon exists
        if (!this.daemons.has(processID)) {
            throw new DaemonNotFoundError(`Daemon ${processID} does not exist`);
        }
    
        // Get reference to the daemon
        const daemon = this.daemons.get(processID);
        
        // Begin inferences and wait for the score
        const score = await daemon.evaluateModel(filePath, containerID, columnNameX, columnNameY, metric).then(score => {
            // Log the score
            console.log(`Score for ${processID}: ${score.score}`);
            
            // Add score to leaderboard
            this.databaseSystem.addScoreToLeaderboard(competitionID, processID, score.score);
        
            // Return the score to the caller
            return score;
        });
        
        
    }
    

    spawnNewDaemon(parameters) {
        //Try allocations. If we fail, we deallocate and throw an error
        if (this.daemons.get(parameters.processID)) {
            throw new AlreadyRegisteredError(chalk.red(`Daemon with process ID ${parameters.processID} is already registered`));
        }
        
        let ports = [];
        parameters.ports = 1; 
        try{
            ports = this.resourceMonitor.allocateProcess(parameters);
        } catch(e){
            throw e;
        }
        //Allocations succeed, move on.
        //Create new daemon with the guarantee blocks asssigned to it based on its tier
        const daemon = new AthenaDaemon(ports, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockCPU, this.resourceMonitor.usage.get(parameters.processID).guaranteed * this.blockMemory, parameters.processID, parameters.uptime, 3);
        daemon.startMonitoring(parameters.interval);
        this.registerDaemon(parameters.processID, daemon);

        //Callback functions for various needs. We use event emitters for asynchronous work rather than function calls which force the program counter to move.
        daemon.on('exit', (code) => {
            console.log(chalk.gray(`[${this.name}] Daemon child ${parameters.processID} died with status ${code}`));
            //Print daemons
            
            console.log(chalk.gray(`[${this.name}] Daemons: ${Array.from(this.daemons.keys())}`));
            this.unregisterDaemon(parameters.processID);
            this.resourceMonitor.processExitCleanup(parameters.processID);
          });
        //TODO:Overload callback function
        daemon.on('overload-exit', () => {
            console.log(chalk.blue(`[${this.name}] Daemon child ${parameters.processID} has exited overload mode. Awaiting resource reassignment.`));
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

    async addUserSubmission(comp_id, user_id, file_path) {
        // Adjusted to match the Submissions table schema.
        // Note: Assuming `score` is to be updated separately.
        const sql = "INSERT INTO Submissions (comp_id, user_id, file_path) VALUES (?, ?, ?)";
        await this.query(sql, [comp_id, user_id, file_path]);
    }

    async addScoreToLeaderboard(comp_id, user_id, score) {
        // Note: Assuming Leaderboard updates or inserts are handled externally since PRIMARY KEY is `user_id`.
        const sql = "INSERT INTO Leaderboard (comp_id, user_id, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = ?";
        await this.query(sql, [comp_id, user_id, score, score]);
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
}



module.exports = { AthenaManager, AthenaDatabaseSystem };