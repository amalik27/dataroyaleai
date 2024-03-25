/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>
 * @Description: Module for establishing connection to MySQL database
 */

const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // changed to work locally
    password: 'root', // changed to work locally
    database: 'swe2024',
    port: '3306' // changed to work locally
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database as id ' + connection.threadId);
});

module.exports = connection;