
const {AthenaDatabaseSystem} = require('../athenaManager.js');
const db = require('../../backend/db.js');
const util = require('util');

async function runEvaluations() {
    const athenaDB = new AthenaDatabaseSystem();

    try {
        console.log('Creating a competition...');
        await athenaDB.createCompetition(1, 'Data Science Challenge', 'Predict the future.', 'dataset.csv');

        console.log('Fetching competition dataset...');
        const dataset = await athenaDB.getCompetitionDataset(1);
        console.log(`Dataset: ${dataset}`);

        console.log('Adding a user submission...');
        await athenaDB.addUserSubmission(1, 'user123', 'submission.csv');

        console.log('Adding score to leaderboard...');
        await athenaDB.addScoreToLeaderboard(1, 'user123', 95.5);

        console.log('Getting leaderboard...');
        const leaderboard = await athenaDB.getLeaderboard(1);
        console.log(leaderboard);

        console.log('Getting user submissions...');
        const submissions = await athenaDB.getUserSubmissions(1, 'user123');
        console.log(submissions);
    } catch (err) {
        console.error('An error occurred:', err.message);
    }
}

runEvaluations();
