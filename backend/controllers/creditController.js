/**
 * @Author: Nikhil Chandra <nikhil.chandra@rutgers.edu>
 * @Description: Manages the credits of the users
 */


const mysql = require('mysql');

// Create a connection to your MySQL database
const db = require('../db');

// db.connect((err) => {
//     if (err) {
//         console.error('Error connecting to the database: ', err);
//         process.exit(1);
//     }
//     console.log('Connected to the database');
// });

async function addCredits(input){
    return new Promise((resolve, reject) => {
        const parsedBody = JSON.parse(input);
        // const { id, credits } = parsedBody;
        // const message = await creditController.addCredits(id, credits);
        let user10 = new Object;
        user10.id = parsedBody.id;
        user10.cost = parsedBody.cost;
        //db.connect((err) => {
            db.query('UPDATE users SET credits = credits + ? WHERE id = ?', [user10.cost, user10.id], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    reject('No user found with the provided id');
                } else {
                    resolve('Credits added successfully');
                }
            });
            db.query('UPDATE subscription_database SET credits = credits + ? WHERE id = ?', [user10.cost, user10.id], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    reject('No user found with the provided id');
                } else {
                    resolve('Credits added successfully');
                }
                // db.end();
            });
        });
    //}).catch(error => console.error(error));
}

async function subtractCredits(input) {
    return new Promise((resolve, reject) => {
        const parsedInput = JSON.parse(input);
        let user10 = new Object;
        user10.id = parsedInput.id;
        user10.cost = parsedInput.cost;
        console.log(user10.id);
        console.log(user10.cost);
        //db.connect((err) => {
            db.query('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?', [user10.cost, user10.id, user10.cost], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    reject('Not enough credits or no user found with the provided id');
                } else {
                    resolve('Credits subtracted successfully');
                }   
                //db.end();
            });
            db.query('UPDATE subscription_database SET credits = credits - ? WHERE id = ? AND credits >= ?', [user10.cost, user10.id, user10.cost], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    reject('No user found with the provided id');
                } else {
                    resolve('Credits added successfully');
                }
                // db.end();
            });
        });
    //}).catch(error => console.error(error));
}

module.exports = { addCredits, subtractCredits };