const url = require('url');
const fs = require('fs');
const path = require('path');
const userController = require('./controllers/userController');
const courseController = require('./controllers/courseController');
const paymentController = require('./controllers/paymentController')

function processRequest(req, res){
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const path = parsedUrl.path;
    const api_token = req.headers['api_token'];

    if (pathname === '/') { //Test Endpoint
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: "Hi \ud83d\ude00" }));
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }
    
    /** 
    YOUR ENDPOINT HERE
    **/
    } else if (pathname === '/stripe_auth') { // endpoint to be called at the very beginning of a payment session to sent up Stripe Auth
        // Called once per purchase session
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const { credits_purchased, user_id, currency} = await JSON.parse(body);
                //console.log(credits_purchased, user_id, currency)
                if(!credits_purchased || !user_id || !currency) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Incomplete JSON' }));
                    return;
                }
                let isValid = await paymentController.checkPurchase(credits_purchased)
                if (!isValid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid Credit Amount' }));
                    return;
                }
                let payment_intent = await paymentController.createPaymentIntent(credits_purchased, user_id, currency);
                if (!payment_intent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Error creating payment intent' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: payment_intent.id})); //store in user window or in cookies
            });
        
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }

    } else if (pathname === '/payment') { //Payment Endpoint For Exchanging USD for Credits
        if (req.method === 'GET') { //get current status of payment
            //console.log("Checking status of a payment.")
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const {client_id} = await JSON.parse(body);
                const status = await paymentController.checkStatus(client_id);
                if (!status) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Server error with checking status' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: status }));
            });
        } else if (req.method === 'POST') { //actually submit the payment
            //console.log("Submitting/Confirming payment.")
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const {client_id, payment_method} = await JSON.parse(body);
                const status = await paymentController.checkStatus(client_id);
                if (!status) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Server error with checking status' }));
                    return;
                } else if (status === "processing") { //currently in payment processing mode
                    console.log("Can't do that!")
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Currently involved in payment process'}));
                    return;
                }
                
                const confirm = await paymentController.confirmPaymentIntent(client_id, payment_method);
                const status2 = await paymentController.checkStatus(client_id);
                //console.log(status2) //should output "success or something similar"
                if (!confirm) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Error with submitting purchase' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: confirm }));
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }
    } else if (pathname === '/users') { //Users Endpoint
        if (req.method === 'GET') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const { id } = JSON.parse(body);
                if (!id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing user ID in JSON body' }));
                    return;
                }
                const user = await userController.readUserById(id);
                if (!user) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'User not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: user }));
            });
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const { username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token } = JSON.parse(body);
                userController.createUser(username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else if (req.method === 'PATCH') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const { id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token } = JSON.parse(body);
                userController.updateUserById(id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else if (req.method === 'DELETE') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const id = JSON.parse(body).id;
                userController.deleteUserById(id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }
    }
    else if (pathname === '/register') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                const { username, email, password, role } = JSON.parse(body);
                userController.registerUser(username, email, password, role);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        }
    }
    else if (pathname === '/login') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const { username, password } = JSON.parse(body);
                try {
                    let status = await userController.loginUser(username, password);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: status }));
                } catch (error) {
                    console.error('Error occurred during login:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
                }
            });
        }
    }    
    else if (pathname.includes("/courses")) {
        if (req.method === 'GET') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const courseTitles = await courseController.readAllCoursesThatUserCanBuyOrAccessByApiToken(api_token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(courseTitles));
            });
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const course_id = JSON.parse(body).course_id;
                await courseController.createCourseProgress(api_token, course_id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        }
    }
    else if (pathname.includes("/dashboard/")) {
        const coursesRegex = /\/dashboard\/(.+)/;
        const match = pathname.match(coursesRegex);
        const api_token = match[1];
        if (req.method === 'GET') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const courseTitles = await courseController.readAllCoursesOfUserByApiToken(api_token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(courseTitles));
            });
        }
    }
    else if (pathname.includes("/course")) {
        const coursesRegex = /\/course(?:\?.*?api_token=(\w+).*?course=(\d+).*?(?:&page=(\d+))?)?/;
        const match = path.match(coursesRegex);
        const api_token = match[1];
        const course_id = match[2];
        const given_page_number = match[3];
        if (req.method === 'GET') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                let page_number;
                try {
                    page_number = await courseController.getDefaultPage(course_id, api_token);
                    if (given_page_number !== undefined) {
                        page_number = given_page_number;
                    }
                    const filePath = await courseController.openCourse(course_id, page_number, api_token);
                    let curDir = __dirname;
                    fs.readFile(curDir.replace('/backend', '') + filePath, (err, data) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('500 Internal Server Error: ' + err);
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data);
                    });
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + err.message);
                    return;
                }
            });
        }        
        else if (req.method === 'PATCH') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                await courseController.updateCourseProgress(given_page_number, api_token, course_id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Endpoint Not Found' }));
    }    
}

module.exports = {
    processRequest
};
