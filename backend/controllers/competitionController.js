const db = require('../db');

/**
 * Create a competition. 
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
