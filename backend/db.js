/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>
 * @Description: Module for establishing connection to MySQL database
 */

const mysql = require('mysql');

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: 'tester', // changed to work locally
    password: 'tester', // changed to work locally
    database: 'swe2024',
    port: process.env.DB_PORT || '8889' //If you want to run tests we assume this 3001:3306 mapping
});

    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to database: ' + err.stack);
            return;
        }
        console.log('Connected to database as id ' + connection.threadId);
    });

module.exports = connection;
