/**
 * @authors @deshnadoshi @aartirao419 @Emboar02
 * Competition Management Controller
 * This file contains all the required methods necessary to join, create, and manage competitions in Data Royale.
 */
const db = require('../db');
const fs = require('fs');
const unzipper = require('unzipper');
const csv = require('csv-parser');
const path = require('path');
const defaultClient = require('cloudmersive-virus-api-client');

const { readUserById } = require('./userController');
const { addCredits, subtractCredits } = require('./paymentController');



// Create Competition (Main Functions)

/**
 * Create a competition. 
 * @author @deshnadoshi @aartirao419
 * @param {*} userid User ID of the organizer. 
 * @param {*} title Title of the competition. 
 * @param {*} deadline Due date of the competition. 
 * @param {*} prize Prize credits for the competition. 
 * @param {*} desc Description for the competition. 
 * @param {*} cap Maximum player capacity for the competition. 
 */ 
async function createCompetition (userid, title, deadline, prize, metrics, desc, cap, inputs_outputs, filepath){
    let emptyResult = emptyFolder("../extractedCompDatasets"); 

    let validUser = await checkValidUser(userid); 

    if (validUser && await authenticateAccess('organizer', userid)){
        let id = generateCompetitionID(); 
        let datecreated = new Date(); 

        let isValidCompetition = true; 
        let errorMessage = ""; 

        if (!(await processCompetitionDatsets(filepath))){
            isValidCompetition = false;
            errorMessage +=  "Check competition datasets. "; 
        }
        if (!validateTitle(title)){
            isValidCompetition = false;
            errorMessage += "Title must be within 60 characters. "; 
        }

        if (!validateDescription(desc)){
            isValidCompetition = false; 
            errorMessage += "Description must be within 1000 words. "; 
        }

        let organizerCredits = await fetchOrganizerCredits(userid);

        if (!validatePrize(prize, organizerCredits)) {
            isValidCompetition = false;
            errorMessage += "Prize must not exceed available credits. ";
        }
        if(!validatePlayerCap(cap)){
            isValidCompetition = false; 
            errorMessage += "Player capacity must not exceed 500. "; 
        }
        if(!validateDeadline(deadline)){
            isValidCompetition = false; 
            errorMessage += "Deadline must be at least 1 month away. "; 
        }

        if (!metrics || !inputs_outputs){
            isValidCompetition = false; 
            errorMessage += "Missing metrics/inputs/outputs"; 
        }

        if (!isValidCompetition){
            return `Error creating competition: ${errorMessage}`; 
        }

        if (isValidCompetition){
            try {
                const query = 'INSERT INTO competitions (id, userid, title, deadline, prize, metrics, description, player_cap, date_created, inputs_outputs, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'; 
                const params = [id, userid, title, deadline, prize, JSON.stringify(metrics), desc, cap, datecreated, JSON.stringify(inputs_outputs), filepath]; 
                await db.query(query, params); 
                // Call payments team's function here to deduct the credits
                await subtractCredits(userid, prize);
                return true; 
            } catch (error) {
                return `Error creating competition: ${error}`; 
            }
        } else {
            return `Invalid entries for competition creation: ${errorMessage}`; 
        }
    } else if (!validUser) {
        return `Error creating competition: Invalid User ID`;
    } else {
        return `Error creating competition: User is not an organizer.`;
    }
    
}
/**
 * Determine the credits a given user has.
 * @author @deshnadoshi
 * @param {*} userid user ID. 
 */
async function fetchOrganizerCredits(userid) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT credits FROM users WHERE id = ?';
        const params = [userid];
        db.query(query, params, function (err, result) {
            if (err) {
                console.error("Error retrieving prize credits:", err);
                reject(err);
            } else {
                if (result.length === 0 || !result) {
                    console.error("No prize credits.");
                    resolve(0); // Assuming default credits is 0 if not found
                } else {
                    resolve(result[0].credits);
                }
            }
        });
    });
}

/**
 * Determine if any of the competitions have reached their deadline. 
 * Helper function for Model Evaluation Team.
 * @author @deshnadoshi
 */
function listenForCompetitionDeadline() {
    setInterval(async () => {
      try {
        const now = new Date();
        
        const query = 'SELECT id FROM competitions WHERE deadline = ?';
        const params = [now];
        const results = await queryDatabase(query, params);
        
        if (results.length > 0) {
          const competitionIDs = results.map(result => result.id);
          console.log('Deadline met for competitions:', competitionIDs);
          return competitionIDs;
        } else {
            return false; 
        }
      } catch (error) {
        console.error('Error listening for competition deadlines:', error);
      }
    }, 60 * 60 * 1000); // check every hour for a competition that is completed
}
    
/**
 * Determine if a competition exists based on the competition ID and organizer ID. 
 * @author @deshnadoshi
 * @param {*} id competition ID. 
 * @param {*} userid user ID. 
 */
async function findCompetitionByID(id, userid){
    try {
        const query = 'SELECT * from `competitions` WHERE `id` = ? AND `userid` = ?'; 
        const params = [id, userid]; 
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result){
                if (err){
                    console.error("Error finding competition:", err); 
                    return resolve(null); 
                }

                // Selected competition does not exist. 
                if (result.length === 0 || !result){
                    console.error("Competition does not exist."); 
                    return resolve(null); 
                } else {
                    // Selected competition exists. 
                    return resolve(true); 
                }

            }); 
        }); 

    } catch (error){
        console.error("Error finding competition:", error); 
        throw error;
    }
}

/**
 * Update competition information.
 * @author @deshnadoshi
 * @param {*} id competition ID. 
 * @param {*} userid user ID. 
 * @param {*} deadline Competition submission due date. 
 * @param {*} prize Competition prize credits. 
 * @returns 
 */
async function updateCompetition (id, userid, deadline, prize){

    const competitionExists = await findCompetitionByID(id, userid); 
    let allowedPrizeUpdate = await updatePrizeEligibility(id, userid, prize); 
    let allowedDeadlineUpdate = await updateDeadlineEligibility(id, userid, deadline); 
    return new Promise((resolve, reject) =>{

        try {
                if (competitionExists){
                    
                    if (pairCompetitionToID(userid, id)){

                        if (allowedDeadlineUpdate && allowedPrizeUpdate){

                            const query = 'UPDATE `competitions` SET deadline = ?, prize = ? WHERE id = ? AND userid = ?';
                            const params = [deadline, prize, id, userid]; 
                            db.query(query, params, function(err, result){
                                if (err){
                                    console.error("Error updating competition:", err); 
                                    return resolve(null); 
                                }
                
                                // Selected competition does not exist. 
                                if (result.length === 0 || !result){
                                    console.error("Competition does not exist."); 
                                    return resolve(null); 
                                } else {
                                    // Selected competition exists. 
                                    return resolve(true); 
                                }
                
                            }); 
                        } else {
                            reject("Requirements to update competition parameters are not met (timeframe or value error)."); 
                        }

                }
        
                } else {
                    reject("Competition does not exist."); 
                }
                
        } catch (error) {

        }

}); 

}

/**
 * Determine if the new prize credits are acceptable.
 * @author @deshnadoshi
 * @param {*} id competition ID.
 * @param {*} userid user ID. 
 * @param {*} newPrize Proposed new prize amount.
 */
async function updatePrizeEligibility(id, userid, newPrize) {
    let organizerCredits = await fetchOrganizerCredits(userid);

    const existingCompetition = await findCompetitionByID(id, userid);
    if (!existingCompetition) {
        return false;
    }

    return new Promise((resolve, reject) => {
        const prizeQuery = 'SELECT prize FROM competitions WHERE id = ? AND userid = ?';
        const prizeParams = [id, userid];

        db.query(prizeQuery, prizeParams, (err, results) => {
            if (err) {
                console.error("Error retrieving prize credits.");
                reject(err);
            } else {
                if (results.length > 0) {
                    const originalPrize = results[0].prize;

                    const allowablePrize = newPrize > originalPrize && originalPrize != -1;
                    const allowableAmount = newPrize < organizerCredits; 

                    resolve(allowablePrize && allowableAmount);
                } else {
                    resolve(false);
                }
            }
        });
    });
}

/**
 * Determine if the new deadline is acceptable.
 * @author @deshnadoshi
 * @param {} id competition ID.
 * @param {*} userid user ID. 
 * @param {*} newDeadline Proposed deadline change
 */
async function updateDeadlineEligibility(id, userid, newDeadline) {
    const existingCompetition = await findCompetitionByID(id, userid);
    if (!existingCompetition) {
        return false;
    }

    return new Promise((resolve, reject) => {
        const deadlineQuery = 'SELECT deadline FROM competitions WHERE id = ? AND userid = ?';
        const deadlineParams = [id, userid];
        const today = new Date();
        const newDate = new Date(newDeadline);

        db.query(deadlineQuery, deadlineParams, (err, results) => {
            if (err) {
                console.error("Error retrieving deadline.");
                reject(err);
            } else {
                if (results.length > 0) {
                    const originalDeadline = results[0].deadline;
                    let allowableExtension = false;
                    let allowableUpdateTimeframe = false;

                    allowableUpdateTimeframe = overOneWeek(today, originalDeadline);

                    if (newDate.getTime() > originalDeadline.getTime()) {
                        allowableExtension = true;
                    }


                    resolve(allowableExtension && allowableUpdateTimeframe);
                } else {
                    resolve(false);
                }
            }
        });
    });
}

/**
 * Determine if the competition datasets are appropriate, as per requirements.
 * @author @deshnadoshi
 * @param {*} filepath .zip File's path
 */
async function processCompetitionDatsets(filepath) {

    try {

        if (!fs.existsSync(filepath)) {
            console.error(`File "${filepath}" does not exist.`);
            return false;
        }

        await fs.createReadStream(filepath)
            .pipe(unzipper.Extract({ path: 'extractedCompDatasets' }))
            .promise();

        const files = fs.readdirSync('extractedCompDatasets');

        if (files.length !== 2) {
            console.error("Not enough files.");
            return false;
        }
        const expectedFiles = ['training.csv', 'testing.csv'];


        for (const file of files) {

            if (!expectedFiles.includes(file)) {
                console.error(`Unexpected file "${file}" found.`);
                return false;
            }


            const individualFilePath = `extractedCompDatasets/${file}`;
            const rowCount = await countRows(individualFilePath);

            if (rowCount < 10) { // Changed to 10 rows for testing
                console.error("Not enough rows.");
                return false; 
            }

            const headers = await getCSVHeaders(individualFilePath);

            for (const header of headers) {
                if (!/<[a-zA-Z]+>/.test(header)) {
                    console.error(`Invalid format for header "${header}". Header should contain angle brackets with letters inside.`);
                    return false; 
                }
            }
            
        }

        return true;
    } catch (error) {
        console.error("Error processing competition datasets:", error);
        return false;
    }
}

/**
 * Helper function for SQL queries.
 * @author @deshnadoshi
 * @param {*} query SQL query.
 * @param {*} params Parameters passed to the SQL query.
 */
function queryDatabase(query, params) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }


/**
 * Helper function to determine CSV file headers.
 * @param {*} filepath CSV filepath
 */
async function getCSVHeaders(filepath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('headers', (headers) => resolve(headers))
            .on('error', reject);
    });
}


/**
 * Filter competitions by given prize amounts.
 * @param {*} min Minimum prize credits. 
 * @param {*} max Maximum prize credits. 
 */
async function filterByPrize(min, max){
    // Assumptions: If min or max is -1, then it will be assumed that there is no lower/upper bound on the filtering.
    try {
        let query = 'SELECT * FROM competitions WHERE 1=1';
        const params = [];

        if (min !== -1) {
            query += ' AND prize >= ?';
            params.push(min);
        }

        if (max !== -1) {
            query += ' AND prize <= ?';
            params.push(max);
        }

        const results = await db.query(query, params);
        return results; 
    } catch (error) {
        throw new Error(`Error filtering competitions by prize: ${error.message}`);
    }

}

/**
 * Filter competitions by given dates. 
 * @param {} min Minimum date of deadline.
 * @param {*} max Maximum date of deadline. 
 */ 
async function filterByDeadline(min, max){
    // Assumptions: If min or max is -1, then it will be assumed that there is no lower/upper bound on the filtering.
    try {
        let query = 'SELECT * FROM competitions WHERE 1=1';
        const params = [];

        if (min !== -1) {
            query += ' AND deadline >= ?';
            params.push(new Date(min));
        }

        if (max !== -1) {
            query += ' AND deadline <= ?';
            params.push(new Date(max));
        }

        const results = await db.query(query, params);
        return results; 
    } catch (error) {
        throw new Error(`Error filtering competitions by deadline: ${error.message}`);
    }

}


// Create Competition (Validation Functions)

/**
 * Determines if the competition title is of the correct type and within 60 characters.
 * @author @aartirao419
 * @param {*} title Competition title. 
 */
function validateTitle(title){
    if (typeof title != 'string'){
        return false;
    } 
    // title must have 60 character limit and be a string
    if (title.length > 60){
        return false;
    }

    return true;

}

/**
 * Determines if the description is within the 1000 word limit.
 * @author @aartirao419
 * @param {} desc Competition description. 
 */
function validateDescription(desc){ 
    //description has a 1000 word limit cannot exceed 1000
    let words = desc.trim().split(/\s+/);
    if (words.length > 1000){
        desc = words.slice(0,1000);
        return false; 
    }
    return true;
}

/**
 * Determine if the prize credits selected is of a valid amount. 
 * @author @aartirao419
 * @param {*} prize Competition prize credits.
 */
function validatePrize(prize, organizerCredits){
    let mincreds = 100;
    
    if (prize < mincreds){
        return false;
    } else if (prize > organizerCredits){
        return false;
    } else{
        return true;
    }
}


/**
 * Determine if the player capacity is within 500 people.
 * @author @aartirao419 @deshnadoshi
 * @param {} cap Competition player capacity. 
 */
function validatePlayerCap(cap){ 
    //only a max of 500 players are allowed per competition
    if (cap > 500){
        return false; 
    }

    return true; 

}

/**
 * Determine if the competition deadline is at least one month away from the date of creation.
 * @author @aartirao419
 * @param {*} deadline Competition deadline. 
 */
function validateDeadline(deadline) {
    let compDeadline = new Date(deadline);
    let currDate = new Date();

    let oneMonthFromNow = new Date(currDate);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    if (compDeadline < oneMonthFromNow) {
        return false; 
    } else {
        return true; 
    }
}


/**
 * Determine if a given user ID exists in the database of registered users.
 * @author @deshnadoshi
 * @param {*} user_id user ID. 
 */
async function checkValidUser(user_id) {
    try {
        const query = `SELECT * FROM users WHERE id = ?`;
        const params = [user_id];
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result) {
                if (err) {
                    console.error("Error finding user:", err); 
                    return resolve(null); 
                }

                if (result.length === 0 || !result) {
                    console.error("User does not exist."); 
                    return resolve(null); 
                } else {
                    return resolve(true); 
                }
            }); 
        }); 
    } catch (err) {
        console.error("Error finding user:", err);
        return err;
    }
}



// Create Competition (Helper Functions)

/**
 * Determine if the deadline of a competition is over one week away from today. 
 * @author @deshnadoshi
 * @param {*} today Today's date. 
 * @param {*} deadline Competition deadline.
 */
function overOneWeek(today, deadline){
    let todayTimestamp = today.getTime();
    let deadlineTimestamp = deadline.getTime(); 

    let timeDifference = Math.abs(todayTimestamp - deadlineTimestamp);
    let daysDifference = timeDifference / (1000 * 3600 * 24);
  
    return daysDifference >= 7;
  
}

/**
 * Generate a randomized 11-digit competition ID. 
 * @author @deshnadoshi
 */
function generateCompetitionID(){
    const min = 1; 
    const max = 2147483647; 
    const uniqueRandomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

    return uniqueRandomNumber;

}

/**
 * Determine if a given file is a .csv file or not.
 * @author @deshnadoshi
 * @param {} filepath .csv file path.
 */
function countRows(filepath) {
    return new Promise((resolve, reject) => {
        let count = 0;
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', () => count++)
            .on('end', () => resolve(count))
            .on('error', reject);
    });
}



// Participate in Competition (Main Functions)
/**
 * @author Haejin Song
 * @param {*} user_id 
 * @param {*} competition_id 
 * @returns 
 */
async function joinCompetition(user_id, competition_id) {
    let validUserID = await checkValidUser(user_id); 
    const validCompetition = await checkValidCompetition(competition_id, user_id);
    const validUser = await authenticateAccess('competitor', user_id); 

    if (validUserID == null) {
        return "Error joining competition: User ID doesn't exist."
    }

    if (validCompetition == null) {
        return "Error joining competition: Invalid competition.";
    }

    if (!validUser) {
        return "Error joining competition: User is not a competitor.";
    }

    let id = generateCompetitionID(); 
    const query = "INSERT INTO submissions (comp_id, submission_id, score, file_path, user_id) VALUES (?, ?, ?, ?, ?)";
    const params = [competition_id, id, 0, "", user_id]
    return new Promise((resolve, reject) => {
        try {
            db.query(query, params, function(err, result) {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY'){
                        return resolve("User has already joined the competition."); 
                    }
                    console.error(err);
                    return resolve(null); 
                }
                if (result.length === 0 || !result) {
                    console.error("User_id is invalid"); 
                    return resolve("User_id is invalid");
                } else {
                    return resolve(true);
                }
            });
        } catch (error){

            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error("Duplicate entry error"); 
            } else {
                throw new Error("Error in joining competition"); 
            }


        }
    });
}

/**
 * Remove user from a competition
 * @author Haejin Song
 * @param {*} user_id 
 * @param {*} competition_id 
 * @returns 
 */
async function leaveCompetition(user_id, competition_id) {

    const query = "DELETE FROM submissions WHERE comp_id = ? AND user_id = ?";
    const params = [competition_id, user_id]
    try {
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result) {
                if (err) {
                    console.error("Error deleting competition:", err);
                    return resolve(null);
                }
                if (result.length === 0 || !result || result.affectedRows == 0) {
                    console.error("There is an invalid id");
                    return resolve("There is an invalid id");
                } else {
                    return resolve(true);
                }
            });
        });
    } catch (err) {
        console.error("Error deleting competition:", err);
        return resolve("Error deleting competition"); 
    }
}

/**
 * Submitting model to submissions database
 * @author Haejin Song @deshnadoshi
 * @param {*} user_id 
 * @param {*} competition_id 
 * @param {*} submission_file 
 */
async function submitModel(user_id, competition_id, submission_file) {
    try {
        if (!fs.existsSync(submission_file)) {
            console.error(`File "${submission_file}" does not exist.`);
            return "File does not exist";
        }

        let emptyResult = emptyFolder("../extractedSubmissionFiles");
        let current_date = new Date();

        const query = "UPDATE submissions SET file_path = ? WHERE user_id = ? AND comp_id = ?";
        const params = [submission_file, user_id, competition_id];

        // Assuming these are valid dates that can be compared, can be changed if not
        if (checkDeadline(competition_id) > current_date) {
            console.error("The deadline has passed.");
            return false;
        }

        const containsAllFiles = await validateSubmissionFile(submission_file);
        if (!(containsAllFiles)) {
            console.error("The submission file is invalid.");
            return false;
        }

        
        const virusScanApiClient = defaultClient.ApiClient.instance;
        const apiInstance = new defaultClient.ScanApi();
        const apiKey = virusScanApiClient.authentications['Apikey'];
        apiKey.apiKey = 'a387af42-5160-46d1-ac1a-480f2938c964';

        const file = fs.readFileSync(submission_file);

        const scanFilePromise = new Promise((resolve, reject) => {
            apiInstance.scanFile(file, (error, data, response) => {
                if (error) {
                    console.error('Error:', error);
                    reject(error);
                } else {
                    console.log('API called successfully. Returned data: ', data);
                    if (data['ContainsViruses']) {
                        console.error("The submission file contains viruses.");
                        return resolve(false); 
                    } else {
                        resolve(true); 
                    }
                }
            });
        });

        const malwareScanResult = await scanFilePromise;

        if (malwareScanResult === false) {
            return false;
        }

        const databaseUpdatePromise = new Promise((resolve, reject) => {
            db.query(query, params, (err, result) => {
                if (err) {
                    console.error("Error submitting model:", err);
                    reject(err);
                }
                if (result.length === 0 || !result || result.affectedRows == 0) {
                    console.error("There is an invalid id or file. User may not be registered for the competition.");
                    return resolve("There is an invalid id or file. User may not be registered for the competition.");
                } else {
                    return resolve(true);
                }
            });
        });

        const databaseUpdateResult = await databaseUpdatePromise;

        return databaseUpdateResult;

    } catch (err) {
        console.error("Error submitting model:", err);
        return false;
    }
}


// Participate in Competition (Validation Functions)
/**
 * Determine if it is a valid competition, checking if user is in it already as well
 * @author Haejin Song
 * @param {*} competition_id 
 * @param {*} competitor_id | id of competitor who wants to join
 * @returns 
 */
async function checkValidCompetition(competition_id) {
    try {
        const query = `SELECT * FROM competitions WHERE id = ?`;
        const params = [competition_id];
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result) {
                if (err) {
                    console.error("Error finding competition:", err); 
                    return resolve(null); 
                }
                // Selected competition does not exist. 
                if (!result || result.length == 0) {
                    console.error("Competition does not exist."); 
                    return resolve(null); 
                } else {
                    // Selected competition exists. 
                    return resolve(true); 
                }
            }); 
        }); 
    } catch (err) {
        console.error("Error finding competition:", err);
        return null;
    }
}

/**
 * Check for whether competition exists or not.
 * @author Haejin Song
 * @param {*} comp_id 
 * @returns 
 */
async function checkDeadline(comp_id) {
    const query = "SELECT deadline FROM competitions WHERE id = ?";
    const params = [comp_id];
    try {
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result) {
                if (err) {
                    console.error("Error finding competition:", err); 
                    return resolve(null); 
                }
                // Selected competition does not exist. 
                if (result.length === 0 || !result) {
                    console.error("Competition does not exist."); 
                    return resolve(null); 
                } else {
                    // Selected competition exists. 
                    return resolve(result);
                }
            }); 
        });
    } catch (err) {
        console.error("Error finding competition:", err);
        return err;
    }
}

/**
 * Withdraw credits if a user attempts to leave with 1 month left to the competition deadline. 
 * @author @deshnadoshi
 * @param {*} comp_id competition ID. 
 * @param {*} user_id user ID. 

 */
async function validateWithdrawDeadline(comp_id, user_id){
    let today = new Date(); 
    let oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(today.getMonth() + 1);

    const query = "SELECT deadline FROM competitions WHERE id = ?";
    const params = [comp_id];
    try {
        return new Promise((resolve, reject) => {
            db.query(query, params, function(err, result) {
                if (err) {
                    console.error("Error finding competition:", err); 
                    return resolve(null); 
                }
                // Selected competition does not exist. 
                if (result.length === 0 || !result) {
                    console.error("Competition does not exist."); 
                    return resolve(null); 
                } else {
                    
                    let competitionDeadline = new Date(result[0].deadline);
                    if (competitionDeadline.getTime() === oneMonthFromNow.getTime()) {
                        subtractCredits(user_id, 1);
                    }
                    return resolve(true);

                }
            }); 
        });
    } catch (err) {
        console.error("Error finding competition:", err);
        return err;
    }


}

// Join Competition (Helper Functions)

/**
 * Validate the submission files to ensure that they are of the correct type.
 * @author @deshnadoshi 
 * @param {*} submission_file Submisison files path.
 */
// async function validateSubmissionFile(submission_file){
    
    
//     const extractionPath = './extractedSubmissionFiles';
//     if (!fs.existsSync(extractionPath)) {
//         fs.mkdirSync(extractionPath);
//     }

//     try {
//         await fs.createReadStream(submission_file)
//             .pipe(unzipper.Extract({ path: extractionPath }))
//             .promise();

//         const files = fs.readdirSync(extractionPath);
//         const csvFilePath = files.find(file => file === 'dataset.csv');
//         if (!csvFilePath) {
//             console.error("No 'dataset.csv' file found.");
//             return false;
//         }

//         const allowedExtensions = ['.csv', '.py', '.js', '.dockerfile', '.txt'];
//         const extraFiles = files.filter(file => {
//             return !allowedExtensions.includes(file.substr(file.lastIndexOf('.')));
//         });
//         if (extraFiles.length > 0) {
//             console.error("Extra non-code files found:", extraFiles);
//             return false;
//         }

//         const referencedFiles = [];
//         await new Promise((resolve, reject) => {
//             fs.createReadStream(`${extractionPath}/${csvFilePath}`)
//                 .pipe(csv())
//                 .on('data', (row) => {
//                     for (const key in row) {
//                         if (row.hasOwnProperty(key)) {
//                             const filePath = row[key];
//                             if (!fs.existsSync(filePath)) {
//                                 console.error(`Invalid file path referenced in dataset.csv: ${filePath}`);
//                                 return resolve(false);
//                             }
//                             referencedFiles.push(filePath);
//                         }
//                     }
//                 })
//                 .on('end', () => {
//                     resolve(true);
//                 });
//         });


//         await new Promise((resolve, reject) => {
//             const dockerfile = files.find(file => file.toLowerCase().includes('dockerfile'));

//         if (!dockerfile) {
//             console.error("No 'Dockerfile' found.");
//             return resolve("No 'dockerfile' found.");
//         } else {
//             console.log("here"); // delete later
//             return resolve(true);
//         }
    
//         });
//     } catch (error) {
//         console.error("Error validating submission files:", error);
//         return false;
//     }

// }
async function validateSubmissionFile(submission_file) {
    const extractionPath = './extractedSubmissionFiles';

    if (!fs.existsSync(extractionPath)) {
        fs.mkdirSync(extractionPath);
    }

    try {
        await fs.createReadStream(submission_file)
            .pipe(unzipper.Extract({ path: extractionPath }))
            .promise();

        const files = fs.readdirSync(extractionPath);
        const csvFilePath = files.find(file => file === 'dataset.csv');

        if (!csvFilePath) {
            console.error("No 'dataset.csv' file found.");
            return false;
        }

        const allowedExtensions = ['.csv', '.py', '.js', '.dockerfile', '.txt'];
        const extraFiles = files.filter(file => {
            return !allowedExtensions.includes(file.substr(file.lastIndexOf('.')));
        });

        if (extraFiles.length > 0) {
            console.error("Extra non-code files found:", extraFiles);
            return false;
        }

        const referencedFiles = [];

        await new Promise((resolve, reject) => {
            const csvParser = fs.createReadStream(`${extractionPath}/${csvFilePath}`)
                .pipe(csv())
                .on('data', (row) => {
                    for (const key in row) {
                        if (row.hasOwnProperty(key)) {
                            const filePath = row[key];
                            if (!fs.existsSync(filePath)) {
                                console.error(`Invalid file path referenced in dataset.csv: ${filePath}`);
                                csvParser.close();
                                return resolve(false);
                            }
                            referencedFiles.push(filePath);
                        }
                    }
                })
                .on('end', () => {
                    resolve(true);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });

        const dockerfile = files.find(file => file.toLowerCase().includes('dockerfile'));

        if (!dockerfile) {
            console.error("No 'Dockerfile' found.");
            return false;
        }

        console.log("Validation successful.");
        return true;
    } catch (error) {
        console.error("Error validating submission files:", error);
        return false;
    }
}


// Manage Competition (Main Functions)

/**
 * Determine if a given competition can be created/joined by a given userid's role.  
 * @author @deshnadoshi
 * @param {*} role 
 * @param {*} userid 
 */
async function authenticateAccess(role, userid){
    try {
        const user = await readUserById(userid);
        const userRole = user.role;

        if (role.toLowerCase() === 'competitor' && userRole.toLowerCase() === 'competitor') {
            return true;
        } else if (role.toLowerCase() === 'organizer' && userRole.toLowerCase() === 'organizer') {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }

}

/**
 * Determine if a given competition ID belongs to a given user ID. 
 * @author @deshnadoshi
 * @param {*} userid user ID. 
 * @param {*} compid competition ID. 
 */
async function pairCompetitionToID(userid, compid){
    
    return new Promise((resolve, reject) => {
        try {
            query = 'SELECT * FROM competitions WHERE id = ? AND userid = ?'; 
            params = [compid, userid]; 
        
            db.query(query, params, function (err, result, fields) {
                if (err) {
                    reject('Error executing query:', err);
                } else {
                    resolve(true); 
                }
            });
            

        } catch (error){
            reject("User ID does not own the given Competition ID."); 
        }

    });
}

/**
 * View all open and running competitions. 
 * @author @deshnadoshi
 */
async function viewAllCompetitions(){
    return new Promise((resolve, reject) => {

        try {
            
            const today = new Date().toISOString().split('T')[0];
            const queryStr = `SELECT * FROM competitions WHERE deadline > ?`;
    
            db.query(queryStr, [today], (err, competitions) => {
                if (err) {
                    console.error("Error executing query:", err);
                    reject("Error in retrieving all competitions.");
                } else {
                    const formattedCompetitions = competitions.map(competition => {
                        return {
                            id: competition.id,
                            userid: competition.userid,
                            title: competition.title,
                            deadline: competition.deadline,
                            prize: competition.prize,
                            metrics: competition.metrics,
                            desc: competition.description,
                            player_cap: competition.player_cap,
                            date_created: competition.date_created,
                            inputs_outputs: competition.inputs_outputs,
                            file_path: competition.file_path
                        };
                    });

                    resolve(formattedCompetitions);
                }
            });

        } catch (error){
            reject("Error in retrieving all competitions."); 
            throw new Error('Error in retrieving all competitions'); 
        }
    
    });
}

/**
 * View all the user scores for a given competition.  
 * @author @deshnadoshi 
 * @param {*} compid competition ID.
 */
async function viewLeaderboard(compid){

    return new Promise((resolve, reject) => {

        try {
            
            const queryStr = `SELECT * FROM submissions WHERE comp_id = ? ORDER BY score DESC`;
    
            db.query(queryStr, [compid], (err, leaderboard) => {
                if (err) {
                    console.error("Error executing query:", err);
                    return reject("Error in retrieving leaderboard.");
                } else {
                    const formattedLeaderboard = leaderboard.map(stats => {
                        return {
                            user_id: stats.user_id,
                            score: stats.score
                        };
                    });

                    return resolve(formattedLeaderboard);
                }
            });

        } catch (error){
            return resolve("Error in retrieving leaderboard."); 
        }
    
    });

}

/**
 * Delete folder contents after each iteration.
 * @author @deshnadoshi
 * @param {*} filepath Location of file to delete.
 */
function emptyFolder(filepath) {
    fs.readdir(filepath, (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(filepath, file);

            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('Error getting file stats:', err);
                    return;
                }

                if (stats.isFile()) {
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error('Error deleting file:', err);
                        }
                    });
                }
                else if (stats.isDirectory()) {
                    console.log("emptied directory."); 
                    emptyFolder(filePath);
                }
            });
        });
    });
}


// Exports

module.exports = {
    createCompetition,
    findCompetitionByID,
    updateCompetition, 
    viewAllCompetitions, 
    filterByDeadline, 
    filterByPrize,
    joinCompetition, 
    leaveCompetition, 
    submitModel, 
    viewLeaderboard
};
