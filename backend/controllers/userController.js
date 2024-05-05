/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>
 * @Description: Module containing functions for user management and authentication in a MySQL database.
 * @Author: Neha Murthy <nnm53@scarletmail.rutgers.edu>
 * @Description: Functions (readUserByEmail, updateUserById, deleteUserById,generateRandomString,generatePasswordTokenReset, resetPassword, updateEmail, isValidEmail)
 * @Author: Gunjan Adya <gunjan.adya@rutgers.edu>
 * @Description: Functions (loginUser)  
 */

const db = require("../db");
const passwordUtils = require('../utils/passwordUtils');
var zxcvbn = require('zxcvbn');
const axios = require('axios');

const passwordResetTokens = {};

// Function to create a new user in the database.
async function createUser(username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) {
    const sql = `INSERT INTO users (username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token]);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Function to register a new user with validation checks.
async function registerUser(username, email, password, role) {
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (username.length < 4 || username.length > 30) {
        throw new Error('Invalid username, should be between 5 and 30 symbols');
    }
    if (!alphanumericRegex.test(username)) {
        throw new Error('Invalid username, should contain only alphanumeric characters');
    }
    if (!isValidEmail(email)) {
        throw new Error('Invalid email address');
    }
    if (zxcvbn(password).score < 2) {
        throw new Error('Weak password');
    }
    const salt = generateRandomString(16);
    const password_encrypted = passwordUtils.encrypt(password, salt);

    const credits = 50;
    const tier = 1;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    const reg_date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    let api_token = generateRandomString(16);
    const hashPrefix = passwordUtils.encryptSHA1(password).slice(0, 5);
    try {
        const count = await getPwnedPasswordCount(hashPrefix);
        if (count > 8000) {
            throw new Error('Password has been compromised. Please choose a different password');
        }
        await createUser(username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token);
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
}

// Function to log in a user with username and password.
async function loginUser(username, password) {
    try {
        const user = await readUserByUsername(username);
        const new_api_token = generateRandomString(16);
        const reg_date_utc = new Date(user.reg_date);
        reg_date_utc.setHours(reg_date_utc.getHours() - 4);
        const reg_date_utc_str = reg_date_utc.toISOString().slice(0, 19).replace('T', ' ');
        updateUserById(user.id, user.username, user.email, user.salt, user.password_encrypted, user.role, user.tier, user.credits, reg_date_utc_str, new_api_token);
        updateCourseProgressApiTokens(user.api_token, new_api_token);
        updateSubscriptionsApiTokens(user.api_token, new_api_token);
        return user.password_encrypted == passwordUtils.encrypt(password, user.salt);
    } catch (error) {
        console.error('Error logging in user:', error);
        throw error;
    }
}

// Function to retrieve a user by their ID.
async function readUserById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return new Promise((resolve, reject) => {
        db.query(sql, id, function (err, result, fields) {
            if (err) {
                console.error('Error getting user by id:', err);
                return reject(err);
            }
            if (!result || result.length === 0) {
                const error = new Error('User with id not found');
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
}

// Function to retrieve a user by their username.
async function readUserByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    return new Promise((resolve, reject) => {
        db.query(sql, username, function (err, result, fields) {
            if (err) {
                console.error('Error getting user by username:', err);
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
}

// Function to retrieve a user by their API token.
async function readUserByApiToken(api_token) {
    const sql = 'SELECT * FROM users WHERE api_token = ?';
    return new Promise((resolve, reject) => {
        db.query(sql, api_token, function (err, result, fields) {
            if (err) {
                console.error('Error getting user by api_token:', err);
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
}

// Function to retrieve a user by their email.
async function readUserByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return new Promise((resolve, reject) => {
        db.query(sql, email, function (err, result, fields) {
            if (err) {
                console.error("There was an error getting the user by their email: ", err);
                return reject(err);
            }
            if (!result || result.length === 0) {
                const error = new error("User with this email is not found");
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
}

// Function to update user information in the database.
async function updateUserById(id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) {
    try {
        const sql = `UPDATE users
                     SET username = ?, email = ?, salt = ?, password_encrypted = ?,
                         role = ?, tier = ?, credits = ?, reg_date = ?, api_token = ?
                     WHERE id = ?`;
        const reg_date_utc = new Date(reg_date);
        reg_date_utc.setHours(reg_date_utc.getHours() - 4);
        const reg_date_utc_str = reg_date_utc.toISOString().slice(0, 19).replace('T', ' ');
        await db.query(sql, [username, email, salt, password_encrypted, role, tier, credits, reg_date_utc_str, api_token, id]);
        return { success: true, message: 'User updated successfully' };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// Function to delete a user from the database by their ID.
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

// Function to generate a random string of a given length.
function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// Function to fetch the count of Pwned Passwords using a hash prefix.
async function getPwnedPasswordCount(hashPrefix) {
    try {
        const response = await axios.get(`https://api.pwnedpasswords.com/range/${hashPrefix}`);

        const lines = response.data.split('\n');
        let totalCount = 0;
        for (const line of lines) {
            const [, count] = line.split(':');
            if (count) {
                totalCount += parseInt(count, 10);
            }
        }
        return totalCount;
    } catch (error) {
        console.error('Error fetching Pwned Passwords:', error);
        throw error;
    }
}

// Function to generate a password reset token for a user.
async function generatePasswordTokenReset(email) {
    try {
        const user = await readUserByEmail(email);
        const token = generateRandomString(32);
        passwordResetTokens[token] = user.id;
        return token;
    } catch (error) {
        console.error("There was an error generating password reset token:", error);
        throw error;
    }
}

// Function to reset a user's password using a token and new password.
async function resetPassword(token, newPassword) {
    try {
        const user_id = passwordResetTokens[token];
        if (!user_id) {
            throw new error("This is an invalid or expired token");
        }
        const salt = generateRandomString(16);
        const password_encrypted = passwordUtils.encrypt(newPassword, salt);
        await updateUserById(user_id, undefined, undefined, salt, password_encrypted, undefined, undefined, undefined, undefined, undefined);
        delete passwordResetTokens[token];
        return { success: true, message: "Password was reset successfully" };
    } catch (error) {
        console.error("There was an error when resetting the password: ", error);
        throw error;
    }
}

// Function to update a user's email in the database.
async function updateEmail(id, newEmail) {
    try {
        const sql = 'UPDATE users SET email = ? WHERE id = ?';
        await db.query(sql, [newEmail, id]);
        return { success: true, message: "The new email given was updated successfully" };
    } catch (error) {
        console.error("Error updaing email: ", error);
        throw error;
    }
}

// Function to check if an email is valid.
function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Function to delete existing user account.
async function deleteAccount(username, password) {
    try {
        const loggedIn = await loginUser(username, password);
        if (!loggedIn) {
            throw new Error("Invalid username or password");
        }
        const user = await readUserByUsername(username);
        await deleteUserById(user.id);
        return { success: true, message: "Account deleted successfully" };
    } catch (error) {
        console.error("Error deleting account:", error);
        throw error;
    }
}

async function updateSubscriptionsApiTokens(old_api_token, new_api_token) {
    try {
        const sql = `UPDATE subscriptions SET api_token = ? WHERE api_token = ?`;
        await db.query(sql, [new_api_token, old_api_token]);
    } catch (error) {
        console.error('Error updating subscriptions:', error);
        throw error;
    }
}

// Function to update api token.
async function updateCourseProgressApiTokens(old_api_token, new_api_token) {
    try {
        const sql = `UPDATE course_progress SET api_token = ? WHERE api_token = ?`;
        await db.query(sql, [new_api_token, old_api_token]);
    } catch (error) {
        console.error('Error updating course progress:', error);
        throw error;
    }
}

module.exports = {
    createUser,
    readUserById,
    updateUserById,
    readUserByUsername,
    deleteUserById,
    readUserByApiToken,
    registerUser,
    loginUser,
    generatePasswordTokenReset,
    generateRandomString,
    resetPassword,
    generatePasswordTokenReset,
    readUserByEmail,
    updateEmail,
    isValidEmail,
    deleteAccount
};