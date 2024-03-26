/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>
 * @Description: Module for establishing connection to MySQL database
 */

const mysql = require('mysql');

async function test() {
const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'tester', 
    password: 'tester', 
    database: 'swe2024',
    port: '8889' 
});

    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to database: ' + err.stack);
            return;
        }
        console.log('Connected to database as id ' + connection.threadId);
    });

    module.exports = connection;
}
test();