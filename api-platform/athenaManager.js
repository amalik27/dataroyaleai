const AthenaDaemon = require('./athenaDaemon');
const { PlatformDaemonManager, DaemonNotFoundError, DatabaseSystem, GuaranteeResourceAllocationError,AlreadyRegisteredError, PlatformResourceMonitor} = require('./platformManager');
const chalk = require('chalk');
const util = require('util');
const db = require('../backend/db.js')
const mysql = require('mysql');
//Inherit from PrometheusManager
class AthenaManager extends PlatformDaemonManager {
    
    constructor(maxCPU, maxMemory, portsAllowed, blocksPerTier) {
        super(maxCPU, maxMemory, portsAllowed, blocksPerTier, "Athena", new AthenaDatabaseSystem(), AthenaResourceMonitor);
        
    }

    //Entrypoint for most actions in the system
    startMonitoring(intervalTime) {
        console.log(chalk.blue(`[${this.name}] Starting monitoring`));
        if (!this.interval) {
          this.interval = setInterval(async () => {
            if (this.messageQueue.length!=0) {
                //MAKE SURE TO DQ MESSAGE IF WE ACT ON IT
                //console.log(chalk.blue(`[${this.name}] Processing message`));
                let message = this.messageQueue[0];//Peek
                //console.log(message);
                if(message.type === "START"){
                    try{
                        await this.spawnNewDaemon(message.body);
                        //Find index of message with ID and remove it. Due to sorting we cannot guarantee the message remains in the same place.
                        let index = this.messageQueue.indexOf(message);
                        message = this.messageQueue.splice(index, 1); 
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
                    this.handleEval(message);
                } 
                else{ 
                    //Dequeue if not a system message
                    console.log(chalk.red(`[${this.name}] Invalid message type`));
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
            console.log(message.body);
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
        console.log(chalk.blue(`[${this.name}] Adding message to queue`));
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
        //print all messages
        console.log(chalk.blue(`[${this.name}] Messages: ${this.messageQueue}`));
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
            
            while (true) {
                //Spinlock for ensuring proper resource usage. We wait until the container is at the front of the queue
                let conditionMet = this.daemons.get(processID).queue[0] == container.containerID;
                if (conditionMet) {
                    break;
                }
                // Wait for a bit before checking again (e.g., 3000 milliseconds)
                await new Promise(resolve => setTimeout(resolve, 3000));
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
            tier = await this.database.getUserTier(parameters.processID); //Calculate off of prize money
            resources = await this.database.getTierResources(tier); //Get resources for tier determined by prize money
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
        let competitionIO = await this.database.getCompetitionIO(parameters.processID);
        competitionIO = JSON.parse(competitionIO);
        //Submit evaluate requests for each submission
        for(let submission of submissions){
            console.log(submission);
            this.addMessageToQueue({
            type: "EVALUATE",
                body: {
                    processID: parameters.processID,
                    userID: submission.user_id,
                    containerID: submission.user_id +  parameters.processID,
                    inputs: competitionIO.inputs,
                    outputs: competitionIO.outputs,
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
        daemon.on('queueEmpty', () => {
            console.log(chalk.red(`[${this.name}] Daemon child ${parameters.processID} has completed testing of models. The daemon will now exit.`));
            this.killProcessDaemon(parameters.processID);
            //Set competition status to complete
            this.database.setCompetitionStatus(parameters.processID, 'complete');
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
        const sql = "INSERT INTO competitions (id, title, description, file_path) VALUES (?, ?, ?, ?, ?)";
        await this.query(sql, [id, title, description, file_path]);
    }

    async getCompetitionDataset(id) {
        const sql = "SELECT file_path FROM competitions WHERE id = ?";
        const results = await this.query(sql, [id]);
        return results.length ? results[0].file_path : null;
    }

    async getCompetitionMetrics(id) {
        const sql = "SELECT metrics FROM competitions WHERE id = ?";
        const results = await this.query(sql, [id]);
        return results.length ? results[0].metrics : null;
    }

    //get competiton inputs and outputs
    async getCompetitionIO(id) {
        const sql = "SELECT inputs_outputs FROM competitions WHERE id = ?";
        const results = await this.query(sql, [id]);
        console.log(results);
        return results.length ? results[0].inputs_outputs : null;
    }

    async addUserSubmission(comp_id, user_id, file_path) {
        // Adjusted to match the Submissions table schema.
        // Note: Assuming `score` is to be updated separately.
        const sql = "INSERT INTO submissions (comp_id, user_id, file_path) VALUES (?, ?, ?)";
        await this.query(sql, [comp_id, user_id, file_path]);
    }

    async addScoreToLeaderboard(comp_id, user_id, score) {
        // Find submissions where comp_id and user_id match, then update score in SUBMISSIONS table
        const sql = "UPDATE submissions SET score = ? WHERE comp_id = ? AND user_id = ?"
        await this.query(sql, [score, comp_id, user_id]);
    }

    async getLeaderboard(comp_id) {
        const sql = "SELECT user_id, score FROM Leaderboard WHERE comp_id = ? ORDER BY score DESC";
        const results = await this.query(sql, [comp_id]);
        return results;
    }

    async getUserSubmissions(comp_id, user_id) {
        const sql = "SELECT file_path FROM submissions WHERE comp_id = ? AND user_id = ?";
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

    // async getCompResources(id) {
    //     const query = 'SELECT prize FROM competitions WHERE id = ?';
    //     try {
    //         const results = await this.query(query, [id]);
    //         if (results.length > 0) {
    //             //Convert from rowdatapacket to object where Guarantee param becomes guarantee and Overload becomes overload
    //             if(results[0].prize <= 100){
    //                 const query = 'SELECT * FROM tiers WHERE TierLevel = 3';
    //                 const results = await this.query(query);
    //                 let resources = {guaranteed: results[0].Guarantee, overload: results[0].Overload, time: results[0].Uptime, ports: results[0].ports};
    //                 return resources;
    //             }
    //             else if(results[0].prize <= 500){
    //                 const query = 'SELECT * FROM tiers WHERE TierLevel = 2';
    //                 const results = await this.query(query);
    //                 let resources = {guaranteed: results[0].Guarantee, overload: results[0].Overload, time: results[0].Uptime, ports: results[0].ports};
    //                 return resources;
    //             }
    //             else {
    //                 const query = 'SELECT * FROM tiers WHERE TierLevel = 1';
    //                 const results = await this.query(query);
    //                 let resources = {guaranteed: results[0].Guarantee, overload: results[0].Overload, time: results[0].Uptime, ports: results[0].ports};
    //                 return resources;
    //             }

    //         } else {
    //             throw new Error('Competition not found '+ id);
    //         }
    //     } catch (err) {
    //         throw err;
    //     }
    // }


}

class AthenaResourceMonitor extends PlatformResourceMonitor{
    // async allocateBlocks(isSpawn = false, processID) {
    //     const userTierInfo = await this.database.getCompResources(processID);
    //     if (!userTierInfo) {
    //         throw new ResourceNotFoundError(`User tier information for process ID ${processID} not found.`);
    //     }

    //     // For spawning, allocate all G blocks. Successful spawn will return processID.
    //     if (isSpawn) {
    //         let blocksToAllocate = userTierInfo.guaranteed;
    //         // Check if sufficient blocks are available in user tier
            
    //         //Calculate blocks used by same tier users
    //         let sameTierUsers = Array.from(this.usage)
    //         .filter(async ([key, _]) => 
    //             await this.database.getUserTier(processID) === await this.database.getUserTier(key)
    //         )
    //         .map(([key, _]) => key);
    //         let blocksUsedBySameTier = 0;
    //         sameTierUsers.forEach((id) => {
    //             blocksUsedBySameTier += this.usage.get(id).guaranteed;
    //             blocksUsedBySameTier += this.usage.get(id).overload;
    //         });
            


    //         if (this.blocksPerTier[await this.database.getUserTier(processID)-1] - blocksUsedBySameTier < blocksToAllocate && this.canAllocateResources(processID,blocksToAllocate)) {
    //             let sameTierUsersInOverload = this.overloadDeallocationQueue.filter(async (id) => 
    //                 await this.database.getUserTier(processID) === await this.database.getUserTier(id)
    //             )
    //             if(sameTierUsersInOverload.length == 0){
    //                 throw new GuaranteeResourceAllocationError(`Not enough blocks available to spawn process ID ${processID}`);
    //             } else {
                    
    //                 //We keep deallocating overload blocks until we have enough to spawn the process
    //                 while(sameTierUsersInOverload.length > 0 && blocksToAllocate > 0){
    //                     blocksToAllocate = this.deallocateOverloadBlocks(sameTierUsersInOverload[0],blocksToAllocate);
    //                     sameTierUsersInOverload.shift();
    //                 }
    //                 //If we could not deallocate enough blocks, we throw an error
    //                 if(blocksToAllocate > 0){
    //                     throw new GuaranteeResourceAllocationError(`Not enough blocks available to spawn process ID ${processID}`);
    //                 } else {
    //                     this.usage.set(processID, { guaranteed: userTierInfo.guaranteed, overload: 0 });
    //                     return processID;
    //                 }
    //             }
    //         } else{
    //             this.usage.set(processID, { guaranteed: blocksToAllocate, overload: 0 });
    //             console.log(this.usage);
    //             return processID;
    //         }  
    //     } else { //For Overload. Successful allocation will return processID.
    //         let blocksToAllocate = userTierInfo.overload;
    //         // Check if sufficient blocks are available in user tier or below
    //         //Calculate blocks used by same tier users or lower tier users by calling getTierIDs, filter by tiers lower than user tier.
    //         let sameOrLowerUsers = Array.from(this.usage)
    //         .filter(async ([key, _]) => {
    //             await this.database.getUserTier(processID) >= await this.database.getUserTier(key);
    //         })
    //         .map(([key, _]) => key);
    //         //Calculate blocks used by users whose tiers are in usableTiers
    //         let blocksUsedByUsableTiers = 0;
    //         sameOrLowerUsers.forEach((id) => {
    //             blocksUsedByUsableTiers += this.usage.get(id).guaranteed;
    //             blocksUsedByUsableTiers += this.usage.get(id).overload;
    //         });
    //         //Do we have enough?
    //         console.log(`WE HAVE ENOUGH BLOCKS: ${this.blocks - blocksUsedByUsableTiers >= blocksToAllocate}, ${this.blocks}, ${blocksUsedByUsableTiers}, ${blocksToAllocate}`)
    //         console.log(sameOrLowerUsers);
    //         console.log(blocksUsedByUsableTiers);
    //         if (this.blocks - blocksUsedByUsableTiers < blocksToAllocate) {
    //             let sameOrLowerUsersInOverload = this.overloadDeallocationQueue.filter(async (id) => {
    //                 await this.database.getUserTier(processID) >= await this.database.getUserTier(id);
    //             });
    //             if(sameOrLowerUsersInOverload.length == 0){
    //                 throw new OverloadResourceAllocationError(`Not enough blocks available to allocate overload for process ID ${processID}`);
    //             } else {
    //                 //We keep deallocating overload blocks until we have enough to allocate all of the overload blocks
    //                 while(sameOrLowerUsersInOverload.length > 0 && blocksToAllocate > 0){
    //                     blocksToAllocate = this.deallocateOverloadBlocks(sameOrLowerUsersInOverload[0],blocksToAllocate);
    //                     sameOrLowerUsersInOverload.shift();
    //                 }
    //                 //If we could not deallocate enough blocks, we throw an error
    //                 if(blocksToAllocate > 0){
    //                     throw new OverloadResourceAllocationError(`Not enough blocks available to allocate overload for process ID ${processID}`);
    //                 } else {
    //                     this.usage.get(processID).overload += userTierInfo.overload;
    //                     return processID;
    //                 }  
    //             }
    //         } else{
    //             this.usage.get(processID).overload += userTierInfo.overload;
    //             return processID;
    //         }   
            
    //     }

    // }
}


let Athena = new AthenaManager(4, 4000, 500, blocksPerTier = [40, 40, 40]);
Athena.startMonitoring(1000);
module.exports = { Athena, AthenaManager, AthenaDatabaseSystem };