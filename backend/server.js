const http = require('http');
const url = require('url');
const userController = require('./controllers/userController');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Parse request URL
    const parsedUrl = url.parse(req.url, true);

    // Get the pathname (route)
    const pathname = parsedUrl.pathname;

    // Handle POST requests
    if (req.method === 'POST') {
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
        } else {
            // Handle invalid routes
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    } else {
        // Handle invalid request methods
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
});

// Set server port
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
