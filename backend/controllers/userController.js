const db = require('../db');

async function createUser(username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) {
    try {
        const sql = `INSERT INTO users (username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token]);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function readUserById(id) {
    try {
        const sql = 'SELECT * FROM users WHERE id = ?';
        return new Promise((resolve, reject) => {
            db.query(sql, id, function (err, result, fields) {
                if (err) {
                    console.error('Error getting user by id:', err);
                    return reject(err);
                }
                if (!result || result.length === 0) {
                    const error = new Error('User not found');
                    console.error(error.message);
                    return reject(error);
                }
                const output = Object.values(JSON.parse(JSON.stringify(result[0])));
                const user = {
                    id: output[0],
                    username: output[1],
                    email: output[2],
                    salt: output[3],
                    password_encrypted: output[4],
                    role: output[5],
                    tier: output[6],
                    credits: output[7],
                    reg_date: output[8],
                    api_token: output[9]
                };
                resolve(user);
            });
        });
    } catch (error) {
        console.error('Error getting user by id:', error);
        throw error;
    }
}

async function updateUserById(id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) {
    try {
        const sql = `UPDATE users
                     SET username = ?, email = ?, salt = ?, password_encrypted = ?,
                         role = ?, tier = ?, credits = ?, reg_date = ?, api_token = ?
                     WHERE id = ?`;
        await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token, id]);
        return { success: true, message: 'User updated successfully' };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}


async function deleteUserById(id) {
    try {
        const sql = 'DELETE FROM users WHERE id = ?';
        await db.query(sql, [id]);
        return { success: true, message: 'User deleted successfully' };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

module.exports = {
    createUser,
    readUserById,
    updateUserById,
    deleteUserById
};