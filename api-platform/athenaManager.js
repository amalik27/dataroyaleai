const { PlatformDaemonManager, DaemonNotFoundError, DatabaseSystem } = require('./platformManager');

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
                
                //Check message type, do stuff
                //System Message Stuff Here...

                //Allocation Requests Here...

                //Start Container Request Here...
                if(message.type === "EVALUATE"){
                    //
                    this.evaluateModel(message.processID, message.competitionID, message.filePath, message.containerID, message.bodyMapper, message.columnNameX, message.columnNameY, message.metric);
                    
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
    addMessageToQueue(message) {
        //Add unique ID to message, make sure it is somehow unique.
        message.id = Math.random().toString(36).substr(2, 9) 
        message.status = "QUEUED";
        this.messageQueue.push(message);
        // Sort the queue first by tier and then by priority within each tier
        this.messageQueue.sort((a, b) => {
            if (a.tier === b.tier) {
                return a.priority - b.priority;
            }
            return a.tier - b.tier;
        });
        return message.id;
    }


    //New method for initializing container and immediately beginning evaluation
    async evaluateModel(processID, competitionID, filePath, containerID, bodyMapper, columnNameX, columnNameY, metric) {
        //If statement for if daemon exists
        if (!this.daemons.has(processID)) {
            throw new DaemonNotFoundError('Daemon does not exist');
        }

        //Get reference to daemon
        const daemon = this.getDaemon(processID);
        //Begin inferences
        let score = await daemon.evaluateModel(filePath, containerID, bodyMapper, columnNameX, columnNameY,metric);
        //ProcessId = userID. Add score to leaderboard
        this.databaseSystem.addScoreToLeaderboard(competitionID, processID, score);
    }


}

//Extend database system to include competition leaderboards and user submissions
//User submissions represented as filepaths + competitionID + userID
//Competitions represented as competitionID + competitionName + competitionDescription + competitionLeaderboard
//CompetitionLeaderboard represented as competitionID + userID + score
class AthenaDatabaseSystem extends DatabaseSystem {
    constructor() {
        super();
        this.competitions = new Map();
        this.userSubmissions = new Map();
    }
    //Get db state as json
    getDBState() {
        return {
            competitions: Array.from(this.competitions),
            userSubmissions: Array.from(this.userSubmissions)
        };
    }

    //Create competition
    createCompetition(competitionID, competitionName, competitionDescription) {
        this.competitions.set(competitionID, {
            competitionName,
            competitionDescription,
            competitionLeaderboard: new Map()
        });
    }

    //Add user submission
    addUserSubmission(competitionID, userID, filePath) {
        this.userSubmissions.set(filePath, {
            competitionID,
            userID
        });
    }

    //Add score to leaderboard
    addScoreToLeaderboard(competitionID, userID, score) {
        const competition = this.competitions.get(competitionID);
        competition.competitionLeaderboard.set(userID, score);
    }

    //Get leaderboard
    getLeaderboard(competitionID) {
        const competition = this.competitions.get(competitionID);
        return competition.competitionLeaderboard;
    }

    //Get user submissions
    getUserSubmissions(competitionID, userID) {
        const userSubmissions = [];
        for (let [filePath, submission] of this.userSubmissions) {
            if (submission.competitionID === competitionID && submission.userID === userID) {
                userSubmissions.push(filePath);
            }
        }
        return userSubmissions;
    }
}

module.exports = { AthenaManager, AthenaDatabaseSystem };