const http = require('http');
const routes = require('./routes');

const server = http.createServer((req, res) => {
    routes.processRequest(req, res);
});

// Set server port
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = server