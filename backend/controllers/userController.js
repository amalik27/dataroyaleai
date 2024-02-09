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

async function addUser(username, password) {
    registerUser(username, password);
}

async function getUserByUsername(username) {
    try {
        const sql = 'SELECT * FROM users WHERE username = ?';
        const [user] = await db.query(sql, [username]);
        return user;
    } catch (error) {
        console.error('Error getting user by username:', error);
        throw error;
    }
}

async function getAllUsers() {
    try {
        const sql = 'SELECT * FROM users';
        const users = await db.query(sql);
        return users;
    } catch (error) {
        console.error('Error getting all users:', error);
        throw error;
    }
}


async function updateUserByUsername(username, newPassword) {
    try {
        const sql = 'UPDATE users SET password = ? WHERE username = ?';
        await db.query(sql, [newPassword, username]);
        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

async function deleteUserByUsername(username) {
    try {
        const sql = 'DELETE FROM users WHERE username = ?';
        await db.query(sql, [username]);
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

module.exports = {
    registerUser,
    authenticateUser,
    addUser,
    getUserByUsername,
    getAllUsers,
    updateUserByUsername,
    deleteUserByUsername
};
