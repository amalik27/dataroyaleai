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
                    console.log('No user found with the provided id : ' + user10.id);
                    reject('No user found with the provided id: ' + user10.id);
                } else {
                    console.log('Credits added successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                    resolve('Credits added successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                }
            });
            db.query('UPDATE subscription_database SET credits = credits + ? WHERE id = ?', [user10.cost, user10.id], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    reject('No user found with the provided id');
                } else {
                    console.log('Credits added successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                    resolve('Credits added successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
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
                    console.log('Not enough credits or no user found with the provided id');
                    reject('Not enough credits or no user found with the provided id');
                } else {
                    console.log('Credits subtracted successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                    resolve('Credits subtracted successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                }   
                //db.end();
            });
            db.query('UPDATE subscription_database SET credits = credits - ? WHERE id = ? AND credits >= ?', [user10.cost, user10.id, user10.cost], (err, result) => {
                if (err) reject(err);
                
                if (result.affectedRows === 0) {
                    console.log('Not enough credits or no user found with the provided id');
                    reject('Not enough credits or no user found with the provided id');
                } else {
                    console.log('Credits subtracted successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                    resolve('Credits subtracted successfully to user with id: ' + user10.id + ' and cost: ' + user10.cost + ' credits');
                }
                // db.end();
            });
        });
    //}).catch(error => console.error(error));
}

module.exports = { addCredits, subtractCredits };