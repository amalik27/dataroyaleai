/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>
 * @Description: Module containing server creation service
 */

const http = require('http');
const routes = require('./routes');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*')
    //res.setHeader('Access-Control-Max-Age', 2592000);
    routes.processRequest(req, res);
});

// Set server port
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    
    console.log(`Server running on port ${PORT}`);
});

module.exports = server;
