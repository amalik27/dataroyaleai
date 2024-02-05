const db = require('../db');

function registerUser(username, password) {
    const sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
    db.query(sql, [username, password], (err, result) => {
        if (err) {
            console.error('Error registering user: ' + err.stack);
            return;
        }
        console.log('User registered successfully');
    });
}

function authenticateUser(username, password, callback) {
    const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error authenticating user: ' + err.stack);
            return;
        }
        callback(results.length > 0);
    });
}

module.exports = {
    registerUser,
    authenticateUser
};
