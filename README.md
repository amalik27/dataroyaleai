# Data Royale 
<img src='https://github.com/Herxity/SWE2024/assets/34107608/1d779544-c823-4e7b-b249-07f2793e6651' width='250'>
<br>
<i>Group Project for 14:332:452 - Software Engineering</i>
<br>
<b> Demo Videos </b>
<br>
<a href="https://www.youtube.com/watch?v=_E6fqzHvxds">Demo 1</a>

## Initial Setup Steps 
- Open up an editor of your choice
- Make sure you have NPM, NodeJS, Git installed
- Also install MAMP (https://www.mamp.info) for the Database
- Open up your terminal and `cd \my\folder\directory\`
- Run `git init` followed by `git clone https://github.com/Herxity/SWE2024.git`
- Run `npm install`
- For all third-party services (Team 4), create a .env file in your current directory with the following format:\
    STRIPE_SECRET_API_KEY=\
    STRIPE_PUBLIC_API_KEY=\
    MJ_APIKEY_PUBLIC=\
    MJ_APIKEY_PRIVATE=
- Create accounts for both Stripe (https://stripe.com/) and Mailjet (https://app.mailjet.com/)
- You can find the stripe keys here: https://dashboard.stripe.com/test/apikeys
- You can find the Mailjet keys here: https://app.mailjet.com/account/apikeys

## Set Up Database
- Start up MAMP, and click "Start Servers".  Then, navigate to this link: http://localhost/phpMyAdmin/?lang=en 
- Click "Import", and upload the database found in database/swe2024. Press "go" at the bottom of the page to complete the action. This database contains all of the tables you'll need for this project
- Run `npm run server` to start up your server on port 3000
- Navigate to `http://localhost:3000/` in your browser and you should see a message
- Refer to the code in backend/routes and backend/controllers for more complex requests

 ## Set Up API Platform
 (MUST BE WORKING ON LINUX MACHINE, UBUNTU PREFERRED)
- Import ```tiers.sql``` file into php myadmin
- Verify that the 3 rows are correct inside the ```tiers.sql``` file
- Install docker - if docker is not started put command (```sudo systemctl start docker```) or (```sudo service docker start```)
- All file paths must be begin from root folder

## Set Up Payments/Subscriptions
- For testing: `npm run payment-test` (make sure to CTRL+C after to leave the asynchronous server loop)
- The API is also available for you to use according to the demo video.
- The Notifications system is currently being integrated into the API, to run it, you can find the file /backend/utils/. Ensure you change the email fields to valid ones, and please do not spam.

## Set up Competition Management
- For testing: `npm run competition-test` (make sure to CTRL+C after to leave the asynchronous server loop)
- The API is also available for use according to the demo video.
