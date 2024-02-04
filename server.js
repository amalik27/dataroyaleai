// Run local server through 'node server' terminal command in project dir
const http = require('http');
const fs = require('fs'); 
const path = require('path'); 

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    // res.write('Hello world!');
    // res.end();

    const url = req.url.split('?')[0];

    if (url === '/') {
        loadHTML(res, 'views/main.html');
    } else if (url === '/competitions') {
        loadHTML(res, 'views/competitions.html');
    } else if (url === '/about'){
        loadHTML(res, 'views/about.html');
    } else if (url === '/subscription'){
        loadHTML(res, 'views/subscription.html');
    } else if (path.extname(url).slice(1) === 'css') {
        loadCSS(res, 'views/styles.css');
    }  else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
    }

});

// IP address is localhost:3001
const port = 3001;
server.listen(port, 'localhost', () => {
    console.log('listening for request at','localhost:', port);
});

// Loading HTML pages
function loadHTML(res, filepath){
    const fullPathToPage = path.join(__dirname, filepath); 
    
    fs.readFile(fullPathToPage, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 Internal Server Error</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    }); 
}

// Loading CSS file
function loadCSS(res, filepath) {
    const fullPathToFile = path.join(__dirname, filepath);

    fs.readFile(fullPathToFile, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 Internal Server Error</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        }
    });
}
