const url = require('url');
const userController = require('./controllers/userController');
const competitionController = require('./controllers/competitionController'); 
const { get } = require('http');

function processRequest(req, res){
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
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
                        res.end(JSON.stringify({ success: false, message: submitResult }));
    
                    }

                } catch (error) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
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
                    res.end(JSON.stringify({ success: false, message: 'Joined competitions not found' }));
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
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Endpoint Not Found' }));
    }    
}

module.exports = {
    processRequest
};
