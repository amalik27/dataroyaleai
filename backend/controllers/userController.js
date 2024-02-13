const db = require('../db');

async function createUser(username, email, salt, password_encrypted, role, tier, credits, reg_date) {
    try {
        const sql = `INSERT INTO users (username, email, salt, password_encrypted, role, tier, credits, reg_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date]);
        console.log(result);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function readUserById(id) {
    try {
        const sql = 'SELECT * FROM users WHERE id = ?';
        const result = await db.query(sql, id);
        console.log(id);
        console.log(result);
        if (!Array.isArray(result) || result.length === 0) {
            return null;
        }

        const user = {
            id: result[0].id,
            username: result[0].username,
            email: result[0].email,
            salt: result[0].salt,
            password_encrypted: result[0].password_encrypted,
            role: result[0].role,
            tier: result[0].tier,
            credits: result[0].credits,
            reg_date: result[0].reg_date
        };

        return user;
    } catch (error) {
        console.error('Error getting user by id:', error);
        throw error;
    }
}

async function updateUserById(id, username, email, salt, password_encrypted, role, tier, credits, reg_date) {
    try {
        const sql = `UPDATE users
                     SET username = ?, email = ?, salt = ?, password_encrypted = ?,
                         role = ?, tier = ?, credits = ?, reg_date = ?
                     WHERE id = ?`;
        await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date, id]);
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
