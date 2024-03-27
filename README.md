# Data Royale 
<img src='https://github.com/Herxity/SWE2024/assets/34107608/1d779544-c823-4e7b-b249-07f2793e6651' width='250'>
<br>
<i>Group Project for 14:332:452 - Software Engineering</i>
<br>
<b> Demo Videos </b>
<br>
<a href="https://www.youtube.com/watch?v=_E6fqzHvxds">link text</a>

## Initial Setup Steps 
- Open up an editor of your choice
- Make sure you have NPM, NodeJS, Git installed
- Also install MAMP (https://www.mamp.info) for the Database
- Open up your terminal and `cd \my\folder\directory\`
- Run `git init` followed by `git clone https://github.com/Herxity/SWE2024.git`
- Run `npm install`

## Set Up Database
- Start up MAMP, and click "Start Servers".  Then, navigate to this link: http://localhost/phpMyAdmin/?lang=en 
- Create a new database by going to Database -> Create and name it "swe2024"
- Click on your database, click on "Import", and import the database/users.sql file in this folder. Click "Go" at the bottom of your screen to add to your swe2024 database.  Do not collect 200. 
- You should now have a swe2024 database with a "users" table.
- Here, you can also add your own tables
- Run `npm run server` to start up your server on port 3000
- Navigate to `http://localhost:3000/` in your browser and you should see your message.
- Refer to the code in backend/routes and backend/controllers for more complex requests

 ## Set Up API Platform
 (MUST BE WORKING ON LINUX MACHINE, UBUNTU PREFERRED)
- Import ```tiers.sql``` file into php myadmin
- Verify that the 3 rows are correct inside the ```tiers.sql``` file
- Install docker - if docker is not started put command (```sudo systemctl start docker```) or (```sudo service docker start```)
- All file paths must be begin from root folder



## Note
All worries, complaints, errors, annoyances, and tribulations will only be accepted in written form.
