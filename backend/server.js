// Run local server through 'node server' terminal command in project dir
const http = require('http');

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.write('Hello world!');
    res.end();
});

// IP address is localhost:3001
const port = 3001;
server.listen(port, 'localhost', () => {
    console.log('listening for request at','localhost:', port);
});