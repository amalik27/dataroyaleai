/**
 * @Author: Nikita Filippov <nikfilippov1@gmail.com>, Deshna Doshi <deshna.doshi@gmail.com>
 * @Description: Module for handling HTTP requests and routing them to corresponding controllers.
 */

const url = require('url');
const fs = require('fs');
const pathModule = require('path');
const userController = require('./controllers/userController');
const competitionController = require('./controllers/competitionController');
const courseController = require('./controllers/courseController');
const paymentController = require('./controllers/paymentController');
const creditController = require('./controllers/creditController');

const subscriptionController = require('./controllers/subscriptionController');
const { parse } = require('querystring');

const { Prometheus, PlatformDaemonManager, getSystemState } = require('../api-platform/platformManager.js');
const { Athena, AthenaManager } = require('../api-platform/athenaManager.js');
const { Container } = require('../api-platform/platformDaemon');
var chalk = require(`chalk`);
const {subtractCredits} = require('./controllers/creditController');



competitionController.listenForCompetitionDeadline();


async function processRequest(req, res){
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const path = parsedUrl.path;

    if (pathname === '/') { //Test Endpoint
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: "Hi \ud83d\ude00" }));
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }
    } else if (pathname === '/stripe_auth') { // endpoint to be called at the very beginning of a payment session to sent up Stripe Auth
        // Called once per purchase session
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const { credits_purchased, user_id, currency } = await JSON.parse(body);
                //console.log(credits_purchased, user_id, currency)
                if (!credits_purchased || !user_id || !currency) {
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
                res.end(JSON.stringify({ success: true, message: payment_intent.id })); //store in user window or in cookies
            });

        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }

    } else if (pathname === '/competitions/create') { // Competition Creation and Management
        if (req.method === 'GET') {
            // View All Competitions
            // let body = '';

            // req.on('data', (chunk) => {
            //     body += chunk.toString();
            // });

            // req.on('end', async () => {

            //     const allCompetitions = await competitionController.viewAllCompetitions();

            //     if (!allCompetitions || allCompetitions.length == 0) {
            //         res.writeHead(404, { 'Content-Type': 'application/json' });
            //         res.end(JSON.stringify({ success: false, message: 'Competitions not found' }));
            //         return;
            //     }
            //     res.writeHead(200, { 'Content-Type': 'application/json' });
            //     res.end(JSON.stringify({ success: true, message: allCompetitions }));
            // });
            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'create_competition.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading create_competition.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });


        } else if (req.method === 'POST') {
            // Create Competition
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                const {username, password, userid, title, deadline, prize, metrics, desc, cap, inputs_outputs, filepath } = JSON.parse(body);

                if (!username || !password || !userid || !title || !deadline || !prize || !desc || !cap || !metrics || !inputs_outputs || !filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing competition fields in JSON body' }));
                    return;
                }

                try {
                    const getCreateResult = await competitionController.createCompetition(username, password, userid, title, deadline, prize, metrics, desc, cap, inputs_outputs, filepath);
                    if (getCreateResult == true) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Competition created successfully." }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getCreateResult }));

                    }
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });

        } else if (req.method === 'PATCH') {
            // Update Competition Details
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {

                const { id, userid, deadline, prize } = JSON.parse(body);

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
    } else if (pathname === '/competitions'){ // Viewing All Competitions
        if (req.method === 'GET') {
            // View All Competitions
            competitionController.viewAllCompetitions()
            .then(allCompetitions => {
                if (!allCompetitions || allCompetitions.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Competitions not found');
                    return;
                }
        
                // Serve the HTML file with competition data inserted
                const filePath = pathModule.join(__dirname, '../frontend/public/view_competition.html');
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        console.error('Error loading view_competition.html:', err);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error loading view_competition.html');
                    } else {
                        const htmlWithData = data.toString().replace('<!-- Competitions will be dynamically inserted here -->', generateCompetitionHTML(allCompetitions));
        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(htmlWithData);
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching competitions:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            });
        }
    } else if (pathname === '/competitions/join/leaderboard'){ // View Leaderboard
        // if (req.method === 'GET'){
        //     // let body = '';

        //     // req.on('data', (chunk) => {
        //     //     body += chunk.toString();
        //     // });

        //     // req.on('end', async () => {
        //     //     const { compid } = JSON.parse(body);

        //     //     const allJoined = await competitionController.viewLeaderboard(compid);

        //     //     if (!allJoined || allJoined.length == 0) {
        //     //         res.writeHead(404, { 'Content-Type': 'application/json' });
        //     //         res.end(JSON.stringify({ success: false, message: 'Competition does not exist/Nobody has joined this competition.' }));
        //     //         return;
        //     //     }
        //     //     res.writeHead(200, { 'Content-Type': 'application/json' });
        //     //     res.end(JSON.stringify({ success: true, message: allJoined }));
        //     // });


        // }

        // const handleLeaderboardRequest = async () => {
        //     if (req.method === 'GET'){
        //         const urlParams = new URLSearchParams(req.url);
        //         const compid = urlParams.get('compid');
    
        //         if (!compid) {
        //             res.writeHead(400, { 'Content-Type': 'application/json' });
        //             res.end(JSON.stringify({ success: false, message: 'Competition ID is required.' }));
        //             return;
        //         }
    
        //         const allJoined = await competitionController.viewLeaderboard(compid);
    
        //         if (!allJoined || allJoined.length == 0) {
        //             res.writeHead(404, { 'Content-Type': 'application/json' });
        //             res.end(JSON.stringify({ success: false, message: 'Competition does not exist/Nobody has joined this competition.' }));
        //             return;
        //         }
    
        //         res.writeHead(200, { 'Content-Type': 'application/json' });
        //         res.end(JSON.stringify({ success: true, message: allJoined }));
        //     } else {
        //         res.writeHead(405, { 'Content-Type': 'application/json' });
        //         res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        //     }
        // };
    
        // // Call the async function
        // handleLeaderboardRequest();
        if (req.method === 'POST') {
            let body = '';

            req.on('data', chunk => {
                body += chunk.toString(); // Accumulate incoming data
            });
            req.on('end', async () => {
                // Parse the URL to extract query parameters

                competitionController.viewLeaderboard(body)
                .then(leaderboard => {
                    // Serve the HTML file with competition data inserted
                    const filePath = pathModule.join(__dirname, '../frontend/public/view_leaderboard.html');
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            console.error('Error loading view_leaderboard.html:', err);
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Error loading view_leaderboard.html');
                        } else {
                            const htmlWithData = data.toString().replace('<!-- Leaderboard items will be dynamically added here -->', generateLeaderboardHTML(leaderboard));
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(htmlWithData);
                        }
                    });
                })
                .catch(error => {
                    console.error('Error fetching competitions:', error);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                });
            });
        } else if (req.method === "GET") {
            const filePath = pathModule.join(__dirname, '../frontend/public/view_leaderboard.html');
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        console.error('Error loading view_leaderboard.html:', err);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error loading view_leaderboard.html');
                    } else {
                        const htmlWithData = data.toString();
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(htmlWithData);
                    }
                });
        } 
        else {
            // If the method is not POST, send a 405 Method Not Allowed response
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
        }
    

    
    } else if (pathname === '/competitions/join') { // Joining a Competition, Submitting a Model
        if (req.method === 'POST') {
            // Join Competition
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {

                const { userid, compid } = JSON.parse(body);


                if (!userid || !compid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing join fields in JSON body' }));
                    return;
                }

                try {
                    const getJoinResult = await competitionController.joinCompetition(userid, compid);
                    if (getJoinResult == true) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Competition joined successfully." }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getJoinResult }));

                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });

        } else if (req.method === 'PATCH') {
            // Submit a Model 
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {

                const { userid, compid, filepath } = JSON.parse(body);

                if (!userid || !compid || !filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing submission fields in JSON body' }));
                    return;
                }

                try {
                    let submitResult = await competitionController.submitModel(userid, compid, filepath);
                    if (submitResult == true) {
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

        } else if (req.method === 'DELETE') {
            // Leave a Competition

            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {

                const { userid, compid } = JSON.parse(body);


                if (!userid || !compid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing withdraw fields in JSON body' }));
                    return;
                }

                try {
                    const getLeaveResult = await competitionController.leaveCompetition(userid, compid);
                    if (getLeaveResult == true) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Withdraw successful." }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: getLeaveResult }));

                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error }));
                }
            });

        } else if (req.method === 'GET') {
            // View Leaderboard
            // let body = '';

            // req.on('data', (chunk) => {
            //     body += chunk.toString();
            // });

            // req.on('end', async () => {
            //     const { compid } = JSON.parse(body);

            //     const allJoined = await competitionController.viewLeaderboard(compid);

            //     if (!allJoined || allJoined.length == 0) {
            //         res.writeHead(404, { 'Content-Type': 'application/json' });
            //         res.end(JSON.stringify({ success: false, message: 'Competition does not exist/Nobody has joined this competition.' }));
            //         return;
            //     }
            //     res.writeHead(200, { 'Content-Type': 'application/json' });
            //     res.end(JSON.stringify({ success: true, message: allJoined }));
            // });

            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'submit_model.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading submit_model.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        }
    } else if (pathname === '/competitions/join/new'){
        if (req.method === 'GET') {
            // View Leaderboard
            // let body = '';

            // req.on('data', (chunk) => {
            //     body += chunk.toString();
            // });

            // req.on('end', async () => {
            //     const { compid } = JSON.parse(body);

            //     const allJoined = await competitionController.viewLeaderboard(compid);

            //     if (!allJoined || allJoined.length == 0) {
            //         res.writeHead(404, { 'Content-Type': 'application/json' });
            //         res.end(JSON.stringify({ success: false, message: 'Competition does not exist/Nobody has joined this competition.' }));
            //         return;
            //     }
            //     res.writeHead(200, { 'Content-Type': 'application/json' });
            //     res.end(JSON.stringify({ success: true, message: allJoined }));
            // });

            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'join_competition.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading submit_model.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else if (req.method === 'POST'){
                        // Join Competition
                        let body = '';

                        req.on('data', (chunk) => {
                            body += chunk.toString();
                        });
            
                        req.on('end', async () => {
            
                            const { userid, compid } = JSON.parse(body);
            
            
                            if (!userid || !compid) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, message: 'Bad Request: Missing join fields in JSON body' }));
                                return;
                            }
            
                            try {
                                const getJoinResult = await competitionController.joinCompetition(userid, compid);
                                if (getJoinResult == true) {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ success: true, message: "Competition joined successfully." }));
                                } else {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ success: false, message: getJoinResult }));
            
                                }
                            } catch (error) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, message: error }));
                            }
                        });
            
        }
    } else if (pathname === '/payment') { //Payment Endpoint For Exchanging USD for Credits
        if (req.method === 'GET') { //get current status of payment
            //console.log("Checking status of a payment.")
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                const { client_id } = await JSON.parse(body);
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
                const { client_id, payment_method } = await JSON.parse(body);
                const status = await paymentController.checkStatus(client_id);
                if (!status) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Server error with checking status' }));
                    return;
                } else if (status === "processing") { //currently in payment processing mode
                    console.log("Can't do that!")
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Currently involved in payment process' }));
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
    } else if (pathname === '/welcome') {
        const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else if (pathname === '/users') {
        if (req.method === 'GET') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            const api_token = req.headers.api_token;
            req.on('end', async () => {
                const user = await userController.readUserByApiToken(api_token);
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
        else if (req.method === 'GET') {
            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'register.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading register.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
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
                    let out;
                    if (status) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        let user = await userController.readUserByUsername(username);
                        out = { success: status, api_token: user.api_token }
                    }
                    else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        out = { success: status }
                    }
                    res.end(JSON.stringify(out));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
        }
        else if (req.method === 'GET') {
            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'login.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading login.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        }
    }
    else if (pathname.includes("/courses")) {
        const api_token = req.headers.api_token;
        if (req.method === 'POST') {
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
        else if (req.method === 'GET') {
            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'courses.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading courses.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        }
    }
    else if (pathname.includes("/dashboard")) {
        const api_token = req.headers.api_token;
        if (req.method === 'POST') {
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
        else if (req.method === 'GET') {
            const filePath = pathModule.join(__dirname, '..', 'frontend', 'public', 'dashboard.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading login.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        }
    }
    else if (pathname.includes("/course")) {
        if (req.method === 'GET') {
            const urlParams = new URLSearchParams(req.url);
            const api_token = urlParams.get("api_token");
            const course_id = urlParams.get("id");
            const given_page_number = urlParams.get("page");
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                let page_number;
                try {
                    page_number = await courseController.getDefaultPage(course_id, api_token) || given_page_number;
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
            const urlParams = new URLSearchParams(req.url);
            const api_token = urlParams.get("api_token");
            const course_id = urlParams.get("id");
            const given_page_number = urlParams.get("page") || 1;
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
        else if (req.method === 'POST') {
            const api_token = req.headers.api_token;
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
    } //subscriptions
    else if (pathname.includes("/subscription")) {
        const supportedContentTypes = { 'application/json': JSON.parse, 'text/plain': parse };
        if (req.method === 'POST' || req.method === 'GET' || req.method === 'PATCH') {
            const contentType = req.headers['content-type'];
            if (!contentType) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Content-Type header is required');
            }
            if (!supportedContentTypes[contentType]) {
                res.writeHead(415, { 'Content-Type': 'text/plain' });
                return res.end(`Unsupported Content-Type. Supported types: ${Object.keys(supportedContentTypes).join(', ')}`);
            }
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    let parsedBody;
                    if (contentType === 'application/json') {
                        parsedBody = JSON.parse(body);
                    } else if (contentType === 'text/plain') {
                        parsedBody = body;
                    }
                    var output = await subscriptionController.selectOption(body, req, res);
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(output);
                } catch (error) {
                    console.error(error);
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Error parsing the request body');
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
          }
      
    } //api platform
    else if (pathname.includes("/prometheus/displayUsage")) {
        const displayUsageRegex = /\/manager\/displayUsage(?:\?.*?)?/;
        const match = path.match(displayUsageRegex);
        if (req.method === 'GET') {
            try {
                const result = getSystemState(Prometheus);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error: ' + error.message);
            }
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/addMessage")) {
        const addMessageRegex = /\/manager\/addMessage(?:\?.*?)?/;
        const match = path.match(addMessageRegex);
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    console.log(body);
                    const { message, api_token } = JSON.parse(body);
                    if (!message || !api_token || !message.body || !message.body.processID || !message.type) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Complete message and api token are required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    if(!(await Prometheus.database.checkUserOwnership(message.body.processID, api_token))){
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end('403 Forbidden: Your ProcessID must be equal to your username. Your API key must match the one for your account.');
                        return;
                    }

                    const id = Prometheus.addMessageToQueue(message);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ messageID: id }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/messageStatus")) {
        const messageStatusRegex = /\/manager\/messageStatus(?:\?.*?)?/;
        const match = path.match(messageStatusRegex);
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const { messageID } = JSON.parse(body);
                    if (!messageID) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Message ID is required.');
                        return;
                    }
                    const status = Prometheus.fetchMessageStatus(messageID);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(status));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/startContainer")) {
        const startContainerRegex = /\/manager\/startContainer(?:\?.*?)?/;
        const match = path.match(startContainerRegex);
        if (req.method === 'POST') {
            let postData = '';
            req.on('data', (chunk) => {
                postData += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { message, api_token} = JSON.parse(postData);
                    if (!message || !message.processID || !message.body|| !api_token) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Complete message with processID, api token, and body is required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    const { processID, body } = message;
                    if(processID === undefined || body === undefined){
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('400 Bad Request: Process ID and Body are required.');
                        return;
                    }
                    if(!(await Prometheus.database.checkUserOwnership(processID, api_token))){
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end('403 Forbidden: Your ProcessID must be equal to your username. Your API key must match the one for your account.');
                        return;
                    }

                    let { cpus, memory, containerID, model } = body;
                    let file_path = await Prometheus.database.getContainerFilePath(model, api_token) 
                    if(file_path === null){
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('404 Not Found: Model not found');
                        return;
                    }    
                    cpus = parseFloat(cpus);
                    memory = parseFloat(memory);
                    const container = new Container(cpus, memory, containerID, file_path);
                    console.log(container.toString());
                    Prometheus.initializeContainer(processID, container);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Container initialization started.');
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/forward")) {
        const forwardRegex = /\/manager\/forward(?:\?.*?)?/;
        const match = path.match(forwardRegex);
        if (req.method === 'POST') {
            let postMsg = '';
            req.on('data', (chunk) => {
                postMsg += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { processID, containerID, body, api_token } = JSON.parse(postMsg);
                    if (!processID || !containerID || !body || !api_token) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Process ID, Container ID, and Body are required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    let hascredits =  await Prometheus.database.checkUserCredits(processID);
                    if(!hascredits){
                        res.writeHead(402, { 'Content-Type': 'text/plain' });
                        res.end('402 Payment Required: You do not have enough credits to run this process.');
                        return;
                    }


                    console.log(`Forwarding request to container ${containerID} for process ${processID}.`);
                    const health = await Prometheus.healthCheck(processID, containerID);
                    if (!(health.status==="healthy")) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('500 Internal Server Error: Container is not healthy.');
                        return;
                    }

                    const data = await Prometheus.forward(processID, containerID, body);
                    console.log(data);

                    let id = await Prometheus.database.getID(processID);
                    JSON.stringify({id: id, cost: 10});
                    const req = JSON.stringify({id: id, cost: 10});
                    await subtractCredits(req);

 	
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/getAllPublishedSubmissions")) {
        const submissionsRegex = /\/manager\/getAllPublishedSubmissions(?:\?.*?)?/;
        const match = path.match(submissionsRegex);
        if (req.method === 'GET') {
            try {
                const models = await Prometheus.database.getAllPublishedSubmissions();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(models));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error: ' + error.message);
            }
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/updatePublishedStatus")) {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString(); // Convert Buffer to string
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const api_token = data.api_token;
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    const submission_id = parseInt(data.submission_id);
                    const published = typeof data.published === 'boolean' ? data.published : (data.published === 'true');
    
                    // Validate submission_id and published
                    if (!Number.isInteger(submission_id) || typeof published !== 'boolean') {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "Invalid submission ID or published status" }));
                        return;
                    }

                    let isOwnedByRequester = await Prometheus.database.checkSubmissionOwnership(submission_id, api_token);

                    if(!isOwnedByRequester){
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end('403 Forbidden: You do not have permission to update this submission');
                        return;
                    }
    
                    await Prometheus.database.updatePublishedStatus(submission_id, published);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: `Successfully updated submission ${submission_id} to published status ${published}` }));
                } catch (error) {
                    console.error(error);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/kill")) {
        const killRegex = /\/manager\/kill(?:\?.*?)?/;
        const match = path.match(killRegex);
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { processID,api_token } = JSON.parse(body);
                    if (!processID|| !api_token) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Process ID is required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    Prometheus.killProcessDaemon(processID);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Process killed.');
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/containerKill")) {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { processID, containerID ,api_token } = JSON.parse(body);
                    if (!processID || !containerID || !api_token) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Process ID, Container ID, and api key are required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    Prometheus.killContainer(processID,containerID);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Container killed.');
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else if (pathname.includes("/prometheus/health")) {
        const healthRegex = /\/manager\/health(?:\?.*?)?/;
        const match = path.match(healthRegex);
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { processID, containerID, api_token  } = JSON.parse(body);
                    if (!processID || !containerID) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Process ID and Container ID are required.');
                        return;
                    }
                    if(!(await Prometheus.database.validateUserAPIKey(api_token))){
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('401 Unauthorized: Invalid API Key');
                        return;
                    }
                    const health = await Prometheus.healthCheck(processID, containerID);
                    console.log(health);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(health));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error: ' + error.message);
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    // else if (pathname.includes("/prometheus/queue")) {
    //     const queueRegex = /\/manager\/queue(?:\?.*?)?/;
    //     const match = path.match(queueRegex);
    //     if (req.method === 'GET') {
    //         try {
    //             res.writeHead(200, { 'Content-Type': 'application/json' });
    //             res.end(JSON.stringify(Prometheus.queue));
    //         } catch (error) {
    //             res.writeHead(500, { 'Content-Type': 'text/plain' });
    //             res.end('500 Internal Server Error: ' + error.message);
    //         }
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/displayUsage")) {
    //     const athenaUsageRegex = /\/athena\/displayUsage(?:\?.*?)?/;
    //     const match = path.match(athenaUsageRegex);
    //     if (req.method === 'GET') {
    //         try {
    //             const result = getSystemState(Athena);
    //             res.writeHead(200, { 'Content-Type': 'application/json' });
    //             res.end(JSON.stringify(result));
    //         } catch (error) {
    //             res.writeHead(500, { 'Content-Type': 'text/plain' });
    //             res.end('500 Internal Server Error: ' + error.message);
    //         }
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/addMessage")) {
    //     const addMessageRegex = /\/athena\/addMessage(?:\?.*?)?/;
    //     const match = path.match(addMessageRegex);
    //     if (req.method === 'POST') {
    //         let body = '';
    //         req.on('data', (chunk) => {
    //             body += chunk.toString();
    //         });
    //         req.on('end', () => {
    //             try {
    //                 const { message } = JSON.parse(body);
    //                 if (!message) {
    //                     res.writeHead(400, { 'Content-Type': 'text/plain' });
    //                     res.end('Message is required.');
    //                     return;
    //                 }
    //                 const id = Athena.addMessageToQueue(message);
    //                 res.writeHead(200, { 'Content-Type': 'application/json' });
    //                 res.end(JSON.stringify({ messageID: id }));
    //             } catch (error) {
    //                 res.writeHead(500, { 'Content-Type': 'text/plain' });
    //                 res.end('500 Internal Server Error: ' + error.message);
    //             }
    //         });
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/database")) {
    //     const databaseRegex = /\/athena\/database(?:\?.*?)?/;
    //     const match = path.match(databaseRegex);
    //     if (req.method === 'GET') {
    //         try {
    //             const dbState = Athena.databaseSystem.getDBState();
    //             res.writeHead(200, { 'Content-Type': 'application/json' });
    //             res.end(JSON.stringify(dbState));
    //         } catch (error) {
    //             res.writeHead(500, { 'Content-Type': 'text/plain' });
    //             res.end('500 Internal Server Error: ' + error.message);
    //         }
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/database/addCompetition")) {
    //     const addCompetitionRegex = /\/athena\/database\/addCompetition(?:\?.*?)?/;
    //     const match = path.match(addCompetitionRegex);
    //     if (req.method === 'POST') {
    //         let body = '';
    //         req.on('data', (chunk) => {
    //             body += chunk.toString();
    //         });
    //         req.on('end', () => {
    //             try {
    //                 const { competitionID, competitionName, competitionDescription, competitionDataset } = JSON.parse(body);
    //                 if (!competitionID || !competitionName || !competitionDescription || !competitionDataset) {
    //                     res.writeHead(400, { 'Content-Type': 'text/plain' });
    //                     res.end('Competition ID, name, description, and dataset are required.');
    //                     return;
    //                 }
    //                 Athena.databaseSystem.createCompetition(competitionID, competitionName, competitionDescription, competitionDataset);
    //                 res.writeHead(200, { 'Content-Type': 'text/plain' });
    //                 res.end('Competition added.');
    //             } catch (error) {
    //                 res.writeHead(500, { 'Content-Type': 'text/plain' });
    //                 res.end('500 Internal Server Error: ' + error.message);
    //             }
    //         });
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/database/addUserSubmission")) {
    //     const addUserSubmissionRegex = /\/athena\/database\/addUserSubmission(?:\?.*?)?/;
    //     const match = path.match(addUserSubmissionRegex);
    //     if (req.method === 'POST') {
    //         let body = '';
    //         req.on('data', (chunk) => {
    //             body += chunk.toString();
    //         });
    //         req.on('end', () => {
    //             try {
    //                 const { competitionID, userID, filePath } = JSON.parse(body);
    //                 if (!competitionID || !userID || !filePath) {
    //                     res.writeHead(400, { 'Content-Type': 'text/plain' });
    //                     res.end('Competition ID, user ID, and file path are required.');
    //                     return;
    //                 }
    //                 Athena.databaseSystem.addUserSubmission(competitionID, userID, filePath);
    //                 res.writeHead(200, { 'Content-Type': 'text/plain' });
    //                 res.end('User submission added.');
    //             } catch (error) {
    //                 res.writeHead(500, { 'Content-Type': 'text/plain' });
    //                 res.end('500 Internal Server Error: ' + error.message);
    //             }
    //         });
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    // else if (pathname.includes("/athena/database/addScoreToLeaderboard")) {
    //     const addScoreToLeaderboardRegex = /\/athena\/database\/addScoreToLeaderboard(?:\?.*?)?/;
    //     const match = path.match(addScoreToLeaderboardRegex);
    //     if (req.method === 'POST') {
    //         let body = '';
    //         req.on('data', (chunk) => {
    //             body += chunk.toString();
    //         });
    //         req.on('end', () => {
    //             try {
    //                 const { competitionID, userID, score } = JSON.parse(body);
    //                 if (!competitionID || !userID || !score) {
    //                     res.writeHead(400, { 'Content-Type': 'text/plain' });
    //                     res.end('Competition ID, user ID, and score are required.');
    //                     return;
    //                 }
    //                 Athena.databaseSystem.addScoreToLeaderboard(competitionID, userID, score);
    //                 res.writeHead(200, { 'Content-Type': 'text/plain' });
    //                 res.end('Score added to leaderboard.');
    //             } catch (error) {
    //                 res.writeHead(500, { 'Content-Type': 'text/plain' });
    //                 res.end('500 Internal Server Error: ' + error.message);
    //             }
    //         });
    //     } else {
    //         res.writeHead(405, { 'Content-Type': 'text/plain' });
    //         res.end('405 Method Not Allowed');
    //     }
    // }
    else if (pathname.includes("/athena/database/getLeaderboard")) {
        const getLeaderboardRegex = /\/athena\/database\/getLeaderboard(?:\?.*?)?/;
        const match = path.match(getLeaderboardRegex);
        if (req.method === 'GET') {
            const { competitionID } = req.query;
            if (!competitionID) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Competition ID is required.');
                return;
            }
            try {
                const leaderboard = Athena.databaseSystem.getLeaderboard(competitionID);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(leaderboard));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error: ' + error.message);
            }
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('405 Method Not Allowed');
        }
    }
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Endpoint Not Found' }));
    }
}
module.exports = {
    processRequest,
};

function generateCompetitionHTML(competitions) {
    let html = '';
    competitions.forEach(competition => {
        html += `
            <div class="competition-card">
                <h2>${competition.title}</h2>
                <p><strong>Deadline:</strong> ${competition.deadline}</p>
                <p><strong>Prize:</strong> ${competition.prize}</p>
                <p><strong>Description:</strong> ${competition.desc}</p>
                <p><strong>Player Capacity:</strong> ${competition.player_cap}</p>
            </div>
        `;
    });
    return html;
}

function generateLeaderboardHTML(leaderboard) {
    let html = '';
    leaderboard.forEach(submission => {
        html += `
        <div class="submission-card">
            <p><strong>UserID:</strong> ${submission.user_id}</p>
            <p><strong>Score:</strong> ${submission.score}</p>
        </div>
    `;
    });
    return html;
}


