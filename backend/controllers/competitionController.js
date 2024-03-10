const db = require('../db');



/**
 * Create a competition. 
 * @author @deshnadoshi
 * @param {*} id Generated unique competition ID. 
 * @param {*} userid User ID of the organizer. 
 * @param {*} title Title of the competition. 
 * @param {*} deadline Due date of the competition. 
 * @param {*} prize Prize credits for the competition. 
 * @param {*} desc Description for the competition. 
 * @param {*} cap Maximum player capacity for the competition. 
 */ 
async function createCompetition (id, userid, title, deadline, prize, desc, cap, datecreated){
    try {
        const query = 'INSERT INTO competitions (id, userid, title, deadline, prize, description, player-cap, date-created) VALUES (?, ?, ?, ?, ?, ?)'; 
        const params = [id, userid, title, deadline, prize, desc, cap, datecreated]; 
        await db.query(query, params); 
    } catch (error) {
        console.error("Error creating competition:", error); 
        throw error; 

    }
    
}

/**
 * Find a competition based on the compeititon ID and user ID. 
 * @author @deshnadoshi
 * @param {*} id competition ID. 
 * @param {*} userid user ID. 
 */
async function findCompetitionByID(id, userid){
    try {
        const query = 'SELECT * from `competitions` where `id` = ? AND `userid` = ?'; 
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
    try {
        return new Promise((resolve, reject) =>{
            if (competitionExists){
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
                reject("Competition does not exist."); 
            }

        }); 
    } catch (error) {

    }
}


// Note: Might need to split these into 2 separate functions (one for deadline and one for prize money). 
/**
 * Determines if a certain competition is eligible for updates and if competition parameters are valid. 
 * @author @deshnadoshi
 * @param {*} id competition ID. 
 * @param {*} userid user ID. 
 * @param {*} newPrize New prize credits. 
 * @param {*} newDeadline New competition deadline. 
 */
async function updateEligibility(id, userid, newPrize, newDeadline){
    // Assumptions: deadline is a Date. newPrize is an int. newDeadline is a Date. 
    // Date Assumptions: all dates are 0-indexed. 
    // Changes may only be made if there is > 1 week (7 days) left to the deadline of a competition. 
    // Competition deadline may only be extended. 
    // Prize money may only be increased.

    const existingCompetition = await findCompetitionByID(id, userid); 
    if (!existingCompetition){
        return false; 
    }
    
    let today = new Date(); 

    let allowableExtension = false; 
    let allowableTimeFrame = false; 
    
    deadlineQuery = 'SELECT deadline FROM competitions WHERE id = ? AND userid = ?'; 
    deadlineParams = [id, userid]; 

    db.query(deadlineQuery, deadlineParams, (err, results) => {
        if (err){
            console.error("Error retrieving deadline."); 
        } else {
            if (results.length > 0){
                originalDeadline = results[0].deadline; 
            } else {
                originalDeadline = -1; 
            }
        }
    }); 

    if (originalDeadline != -1){
        // Determine if there is more than 1 week left to the competition deadline.
        allowableTimeFrame = overOneWeek(today, originalDeadline); 

        if (newDeadline > originalDeadline){
            allowableExtension = true; 
        }
    }


    let allowablePrize = false;
    
    prizeQuery = 'SELECT prize FROM competitions WHERE id = ? AND userid = ?'; 
    prizeParams = [id, userid]; 

    db.query(prizeQuery, prizeParams, (err, results) => {
        if (err){
            console.error("Error retrieving prize credits."); 
        } else {
            if (results.length > 0){
                originalPrize = results[0].prize; 
            } else {
                originalPrize = -1; 
            }
        }
    }); 
    

    if (newPrize > originalPrize && originalPrize != -1){
        allowablePrize = true; 
    }

    return (allowableExtension && allowableTimeFrame && allowablePrize); 
    
}

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