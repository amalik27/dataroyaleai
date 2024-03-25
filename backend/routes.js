/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>, Deshna Doshi <deshna.doshi@gmail.com>
 * @Description: Module for handling HTTP requests and routing them to corresponding controllers.
 */

const url = require('url');
const fs = require('fs');
const path = require('path');
const userController = require('./controllers/userController');
const competitionController = require('./controllers/competitionController'); 
const { get } = require('http');
const courseController = require('./controllers/courseController');
const paymentController = require('./controllers/paymentController')

function processRequest(req, res){
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const path = parsedUrl.path;
    const api_token = req.headers['api_token'];
   
    const sendResponse = (statusCode, contentType, data) => {
        res.writeHead(statusCode, { 'Content-Type': contentType });
        res.end(data);
    };

    const sendErrorResponse = (statusCode, message) => {
        sendResponse(statusCode, 'application/json', JSON.stringify({ success: false, error: message }));
    };

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

    } else if (pathname === '/competitions/create'){ // Competitions Endpoint
        if (req.method === 'GET'){
            // View All Competitions
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                
                const allCompetitions = await competitionController.viewAllCompetitions();  

                if (!allCompetitions || allCompetitions.length == 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Competitions not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: allCompetitions }));
            });


        } else if (req.method === 'POST'){
            // Create Competition
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                const {userid, title, deadline, prize, metrics, desc, cap, inputs_outputs, filepath} = JSON.parse(body);

                if (!userid || !title || !deadline || !prize || !desc || !cap || !metrics || !inputs_outputs || !filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing competition fields in JSON body' }));
                    return;
                }

                try {
                    const getCreateResult = await competitionController.createCompetition(userid, title, deadline, prize, metrics, desc, cap, inputs_outputs, filepath); 
                    if (getCreateResult == true){
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Competition created successfully." }));    
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getCreateResult }));
    
                    }
                } catch (error){
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });



        } else if (req.method === 'PATCH'){
            // Update Competition Details
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                
                const {id, userid, prize, deadline} = JSON.parse(body);

                if (!id || !userid, !prize || !deadline) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing competition update fields in JSON body' }));
                    return;
                }

                try {
                    await competitionController.updateCompetition(id, userid, deadline, prize); 
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: "Competition updated." }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));

                }
            });

        }

    } else if (pathname === '/competitions/join'){
        if (req.method === 'POST'){
            // Join Competition
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                
                const {userid, compid} = JSON.parse(body);


                if (!userid || !compid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing join fields in JSON body' }));
                    return;
                }

                try {
                    const getJoinResult = await competitionController.joinCompetition(userid, compid); 
                    if (getJoinResult == true){
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Competition joined successfully." }));    
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getJoinResult }));
    
                    }
                } catch (error){
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });



        } else if (req.method === 'PATCH'){
            // Submit a Model 
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                
                const {userid, compid, filepath} = JSON.parse(body);

                if (!userid || !compid || !filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing submission fields in JSON body' }));
                    return;
                }

                try {
                    let submitResult = await competitionController.submitModel(userid, compid, filepath);  
                    if (submitResult == true){
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Model submitted." }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: "Please check your submission." }));
    
                    }

                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: submitResult }));

                }
            });



        } else if (req.method === 'DELETE'){
            // Leave a Competition

            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                
                const {userid, compid} = JSON.parse(body);


                if (!userid || !compid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing withdraw fields in JSON body' }));
                    return;
                }

                try {
                    const getLeaveResult = await competitionController.leaveCompetition(userid, compid); 
                    if (getLeaveResult == true){
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Withdraw successful." }));    
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getLeaveResult }));
    
                    }
                } catch (error){
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });



        } else if (req.method === 'GET'){
            // View Leaderboard
            let body = '';
            
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                const {compid} = JSON.parse(body);
                
                const allJoined = await competitionController.viewLeaderboard(compid);   

                if (!allJoined || allJoined.length == 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Competition does not exist/Nobody has joined this competition.' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: allJoined }));
            });



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
            req.on('end', async () => {
                const { username, email, password, role } = JSON.parse(body);
                try {
                    await userController.registerUser(username, email, password, role);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
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
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
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
