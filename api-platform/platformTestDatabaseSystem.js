//test database system here, database systems
const mysql = require('mysql');
const util = require('util');
const db = require('../backend/db.js')

class DatabaseSystem {
    constructor() {
        this.query = util.promisify(db.query).bind(db);
    }

    async getUserTier(username) {
        const query = 'SELECT tier FROM users WHERE username = ?';
        try {
            const results = await this.query(query, [username]);
            if (results.length > 0) { 
                return results[0].tier;
            } else {
                throw new Error('User not found');
            }
        } catch (err) {
            throw err;
        }
    }

    async getTierResources(tier) {
        const query = 'SELECT Guarantee, Overload, Uptime FROM tiers WHERE tierLevel = ?';
        try {
            const results = await this.query(query, [tier]);
            if (results.length > 0) {
                return results[0];
            } else {
                throw new Error('Tier not found');
            }
        } catch (err) {
            throw err;
        }
    }
}

// Example usage
(async () => {
    const db = new DatabaseSystem();
    try {
        const username = 'ruben';
        const tier = await db.getUserTier(username);
        console.log(`Tier of user '${username}':`, tier);

        const resources = await db.getTierResources(tier);
        console.log(`Resources for tier ${tier}:`, resources);
    } catch (error) {
        console.error('An error occurred:', error);
    }
})();

