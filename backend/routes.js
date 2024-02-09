const url = require('url');
const userController = require('./controllers/userController');

function processRequest(req, res){
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET') {
        // Handle GET requests for querying the database
        if (pathname === '/users') {
            userController.getUsers((users) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(users));
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    } else if (req.method === 'POST') {
        if (pathname === '/register') {
            // Handle user registration
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const { username, password } = JSON.parse(body);
                userController.registerUser(username, password);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else if (pathname === '/login') {
            // Handle user login
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const { username, password } = JSON.parse(body);
                userController.authenticateUser(username, password, (authenticated) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: authenticated }));
                });
            });
        }
    } else if (req.method === 'DELETE') {
        // Handle DELETE requests for deleting users
        if (pathname === '/users') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const username = JSON.parse(body).username;
                userController.deleteUserByUsername(username);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
};

module.exports = {
    processRequest
};