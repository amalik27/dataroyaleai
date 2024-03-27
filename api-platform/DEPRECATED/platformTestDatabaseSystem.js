//test database system here, database systems
const mysql = require('mysql');
const util = require('util');
const db = require('../../backend/db.js')

class DatabaseSystem {
    constructor() {
        this.query = util.promisify(db.query).bind(db);

        //Add tiers automatiically
        //tier 1 = 20 Guarantee, 10 Overload, 60 seconds uptime, 10 seconds overload time
        //tier 2 = 30 Guarantee, 15 Overload, 45 seconds uptime, 5 seconds overload time
        //tier 3 = 40 Guarantee, 20 Overload, 35 seconds uptime, 0 seconds overload time
        //Add to db via sql
        const query = `INSERT INTO tiers (TierLevel, Guarantee, Overload, Uptime, OverloadUptime) VALUES (1, 20, 10, 60, 10), (2, 30, 15, 45, 5), (3, 40, 20, 35, 0)`;
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error adding tiers:', err.code);
            } else {
                console.log('Tiers added successfully');
            }
        });
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
        const query = 'SELECT Guarantee, Overload, Uptime FROM tiers WHERE TierLevel = ?';
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
        const username = 'testuser4';
        const tier = await db.getUserTier(username);
        console.log(`Tier of user '${username}':`, tier);

        const resources = await db.getTierResources(tier);
        console.log(`Resources for tier ${tier}:`, resources);
    } catch (error) {
        console.error('An error occurred:', error);
    }
})();

