/**
 * @Author: Michael Finke <michael.finke@rutgers.edu>
 * @Description: Module for handling subscription related requests:  user's acquiring subs, updating subs, getting sub details, cancelling subs (manual and automatic)
 */

//const mysql = require('mysql');
//////const db = require('../db');

// Define the SQL query to select values from the row
//////var sql2 = "SELECT * FROM subscription_database";
//////var tableAsString = "";

//Execute the select query to pull all datapoints
// db.query(sql2, (err, rows)=>{
//     if (err) {
//         console.error(`Error executing query: ${err.message}`);
//         return;
//     }
//     tableAsString = Object.entries(rows);
// });

var sql2 = "SELECT * FROM `subscription_database`";
//var tableAsString = "";
const db = require('../db');
const util = require('util');
const creditController = require('./creditController.js')

//const asyncQuery = util.promisify(db.query).bind(db);

//have user determine what they want to do with the database/progrm:
async function selectOption(input, req, res){
  // Define a function to query the database and return a promise
  function queryDatabase(sql) {
      return new Promise((resolve, reject) => {
          db.query(sql, (err, rows) => {
              if (err) {
                  reject(err);
              } else {
                  resolve(rows);
              }
          });
      });
  }

  try {
      // Query the database to get the rows
      const rows = await queryDatabase(sql2);

      // Convert rows to tableAsString
      const tableAsString = rows.map(row => {
          const rowData = {};
          for (const [key, value] of Object.entries(row)) {
              rowData[key] = value;
          }
          return rowData;
      });
      //console.log(tableAsString);
      // Parse input from JSON
      const parseInput = JSON.parse(input);

      // Process based on input request
      switch (parseInput.request.select){
          case "PURCHASE":
              console.log("Purchasing a subscription (first time)");
              const tempSubscriber = {
                  id: parseInput.request.id,
                  tier: parseInput.request.tier,
                  user: parseInput.request.user,
                  email: parseInput.request.email,
                  duration: parseInput.request.duration,
                  credits: parseInput.request.credits,
                  api_token: parseInput.request.api_token
              };
              return checkNewSubscriber(tempSubscriber, tableAsString, req, res);

          case "UPDATE":
              console.log("Update subscription");
              const tempSubscriberUpdate = {
                  id: parseInput.request.id,
                  tier: parseInput.request.tier,
                  duration: parseInput.request.duration,
                  credits: parseInput.request.credits,
                  api_token: parseInput.request.api_token
              };
              return updateSubscription(tempSubscriberUpdate, tableAsString, req, res);

          case "GET":
              console.log("Getting user/subscription info");
              //console.log(tableAsString);
              const tempSubscriberGet = {
                  id: parseInput.request.id,
                  api_token: parseInput.request.api_token
              };
              return getSubscriber(tempSubscriberGet.id, tempSubscriberGet.api_token, tableAsString, req, res);

          case "CANCEL":
              console.log("Cancelling subscription for a user");
              const tempSubscriberCancel = {
                  id: parseInput.request.id,
                  api_token: parseInput.request.api_token
              };
              return cancelSubscription(tempSubscriberCancel.id, tempSubscriberCancel.api_token, tableAsString, req, res);

          case "AUTOCANCEL":
              console.log("Autocancel subscriptions");
              return autoCancelSubs(req, res);

          default:
              console.log("INVALID SELECTION INPUT DETECTED, PLEASE TRY AGAIN");
              return "INVALID SELECTION INPUT DETECTED, PLEASE TRY AGAIN";
      }
  } catch (error) {
      console.error(`Error: ${error.message}`);
      // Handle error appropriately
  }
}



//checks the inputs for the new subscriber, and if valid runs them through the process to add them to the table
function checkNewSubscriber(input, data, req, res){
    var errorMessage = "\nERROR:  There is an issue with the following property inputs:";
    let error = false;
    //check email
    if(!(checkEmail(input.email))){
        errorMessage = errorMessage + " email";
        error = true;
    }
    //check id
    //if(input.id.length != 8 || input.id.isNaN || hasInvalidVal(input.id)){
    if((isInteger(input.id))){
      errorMessage = errorMessage + " id";
      error = true;
    }
    //check username
    //if(input.user ){        //TODO:  DETERMINE WHAT PARAMETERS ARE EXPECTED FOR USERNAME, CHANGE LINE
    if(false){
      errorMessage = errorMessage + " user";
      error = true;
    }
    //check tier
    if(!(input.tier == 1 || input.tier == 2 || input.tier == 0)){
      errorMessage = errorMessage + " tier";
      error = true;
    }
    //check duration
    if(input.duration.toLowerCase() != 'month' && input.duration.toLowerCase() != 'year'){
      errorMessage = errorMessage + " duration";
      error = true;
    }
    //check credits
    //if(input.credits.length < 0 || input.credits.isNaN || hasInvalidVal(input.credits)){
    if(input.credits.length < 0 || isInteger(input.credits)){
      errorMessage = errorMessage + " credits";
      error = true;
    }
    
    //if an error occured, write an error message to the new event file, otherwise write the info in a given format to the new event file
    if(error){
        console.log(errorMessage+"\n");
        //res.end(output);
        return errorMessage;
    } else {
        let output = addToDatabase(input, data, req, res); 
        return output;
    }
}


async function addToDatabase(newUser, data, req, res){    //NOTE:  THE ID VALUE USED SHOULD BE PULLED FROM THE LARGER DATABASE WHEN CALLING THIS FUNCTION
  console.log("test3");
  var output = "";
  let sql4 = `INSERT INTO subscription_database (id, user, email, purchase_date, expire_date, tier, cost, credits, api_token) VALUES (?,?,?,?,?,?,?,?,?)`;

  let currentDate = new Date();
  console.log(currentDate);
  let year = currentDate.getFullYear();
  let month = String(currentDate.getMonth() + 1).padStart(2, '0');
  let day = String(currentDate.getDate()).padStart(2, '0');
  let hours = String(currentDate.getHours()).padStart(2, '0');
  let minutes = String(currentDate.getMinutes()).padStart(2, '0');
  let seconds = String(currentDate.getSeconds()).padStart(2, '0');

  //gets the current date in the YYYYMMDDTHHMMSS format
  let formattedStartTime = `${year}${month}${day}T${hours}${minutes}${seconds}`;

  let expDate = new Date(currentDate);
  let currentDayOfMonth = currentDate.getDate();
  let costVal = 0;

  //calculates the expiration date and the price associated with the subscription being purchased
  if(newUser.duration.toLowerCase() === "month"){
    expDate.setDate(currentDayOfMonth+31);
    if(newUser.tier === "1")
      costVal = 100;
    else if (newUser.tier === "2")
      costVal = 200;
  } else if(newUser.duration.toLowerCase() === "year"){         //TODO: TRANSACTION INTEGRATION WILL BE NEEDED HERE, CHECK CURRENT
    expDate.setDate(currentDayOfMonth+365);
    if(newUser.tier === "1")
      costVal = 1000;
    else if (newUser.tier === "2")
      costVal = 1500;
  }

  if(newUser.credits < costVal){
    console.error(`Error insufficient funds in user wallet for transaction.`);
    output = `Error insufficient funds in user wallet for transaction.`;
    //res.end(output);
    return output;
  } else {
    newUser.cost = costVal;
    let jsonUser = {id: newUser.id, cost: newUser.cost};
    jsonUser = JSON.stringify(jsonUser);
    creditController.subtractCredits(jsonUser);                   //calls nikhils subtract credits function
    console.log("Credit substraction process completed");
  }


  let year2 = expDate.getFullYear();
  let month2 = String(expDate.getMonth() + 1).padStart(2, '0');
  let day2 = String(expDate.getDate()).padStart(2, '0');
  let hours2 = String(expDate.getHours()).padStart(2, '0');
  let minutes2 = String(expDate.getMinutes()).padStart(2, '0');
  let seconds2 = String(expDate.getSeconds()).padStart(2, '0');

  let formattedExpTime = `${year2}${month2}${day2}T${hours2}${minutes2}${seconds2}`;

  await db.query(sql4, [newUser.id, newUser.user, newUser.email, formattedStartTime, formattedExpTime, newUser.tier, costVal, newUser.credits-costVal, newUser.api_token], (err) =>{
    if (err) {
        console.error(`Error executing query: ${err.message}`);
        return;
    } else {
      console.log(`New user has been added to the database with the id ${newUser.id}`);
    }
  });

  await db.query(sql2, (err, rows) => {
    if (err) {
        console.error(`Error executing query: ${err.message}`);
        return;
    }
    tableAsString = Object.entries(rows);     //updates the tableAsString value
  });

  console.log("\nNo complications detected, adding user with ID #"+newUser.id+" to database and completing the transaction.\n");
  output = "No complications detected, adding user with ID #"+newUser.id+" to database and completing the transaction.";
  //res.end(output);
  return output;
}




//takes in the user info (utilizing just the user-subscription dataset)
async function updateSubscription(subscriber, data, req, res){
  var output = "";
  //if(subscriber.id.length != 8 || subscriber.id.isNaN || hasInvalidVal(subscriber.id)){
  if((isInteger(subscriber.id))){
    console.log("ERROR:  Given ID value is not a valid input.")
    output = "ERROR:  Given ID value is not a valid input."
    //res.end(output);
    return output;
  }

  var arrLen = data.length;
  let currentLine = 0;
  var foundUser = false;

  let currentDate = new Date();

  let year = currentDate.getFullYear();
  let month = String(currentDate.getMonth() + 1).padStart(2, '0');
  let day = String(currentDate.getDate()).padStart(2, '0');
  let hours = String(currentDate.getHours()).padStart(2, '0');
  let minutes = String(currentDate.getMinutes()).padStart(2, '0');
  let seconds = String(currentDate.getSeconds()).padStart(2, '0');

  //gets the current date in the YYYYMMDDTHHMMSS format
  let formattedStartTime = `${year}${month}${day}T${hours}${minutes}${seconds}`;
  console.log(formattedStartTime);

  let expDate = new Date(currentDate);
  let currentDayOfMonth = currentDate.getDate();
  let costVal = 0;

  //calculates the expiration date and the price associated with the subscription being purchased
  if(subscriber.duration.toLowerCase() === "month"){
    expDate.setDate(currentDayOfMonth+31);
    if(subscriber.tier === "1")
      costVal = 100;
    else if (subscriber.tier === "2")
      costVal = 200;
  } else if(subscriber.duration.toLowerCase() === "year"){         //TODO: TRANSACTION INTEGRATION WILL BE NEEDED HERE, CHECK CURRENT
    expDate.setDate(currentDayOfMonth+365);
    if(subscriber.tier === "1")
      costVal = 1000;
    else if (subscriber.tier === "2")
      costVal = 1500;
  }

  if(subscriber.credits < costVal){
    console.error(`Error insufficient funds in user wallet for transaction.`);
    output = `Error insufficient funds in user wallet for transaction.`;
    //res.end(output);
    return output;
  } else {
    subscriber.cost = costVal;
    let jsonUser = {id: subscriber.id, cost: subscriber.cost};
    jsonUser = JSON.stringify(jsonUser);
    creditController.subtractCredits(jsonUser);                   //calls nikhils subtract credits function
    console.log("Credit substraction process completed");
  }

  let year2 = expDate.getFullYear();
  let month2 = String(expDate.getMonth() + 1).padStart(2, '0');
  let day2 = String(expDate.getDate()).padStart(2, '0');
  let hours2 = String(expDate.getHours()).padStart(2, '0');
  let minutes2 = String(expDate.getMinutes()).padStart(2, '0');
  let seconds2 = String(expDate.getSeconds()).padStart(2, '0');

  let formattedExpTime = `${year2}${month2}${day2}T${hours2}${minutes2}${seconds2}`;
  console.log(formattedExpTime);
  
  while(currentLine<arrLen){
    if(data[currentLine].id == subscriber.id){
      foundUser = true;
      //let sql5 = `UPDATE subscription_database SET tier = ${subscriber.tier}, cost = ${costVal}, purchase_date = \'${formattedStartTime}\', expire_date = \'${formattedExpTime}\', credits = ${subscriber.credits} WHERE id = ? AND api_token = ?`;
      let sql5 = `UPDATE subscription_database AS sub
      JOIN users AS u ON sub.id = u.id
      SET sub.tier = ${subscriber.tier},
          sub.cost = ${costVal},
          sub.purchase_date = '${formattedStartTime}',
          sub.expire_date = '${formattedExpTime}'
      WHERE sub.id = ? 
        AND sub.api_token = ?
        AND sub.tier = u.tier
        AND sub.user = u.username
        AND sub.email = u.email
        AND sub.credits = u.credits;
      `;
      await db.query(sql5, [subscriber.id, subscriber.api_token], (err) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            return;
        } else {
            console.log(`Updated user subscription for id #${subscriber.id}`);
        }
      });

      await db.query(sql2, (err, rows) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            return;
        }
        tableAsString = Object.entries(rows);
      });
      break;
    }
    currentLine++;
  }

  if(!foundUser){      //output messages are returned to Postman
    console.log("\nERROR:  No user can be found with the given 8 digit ID code.\n")
    output = "ERROR:  No user can be found with the given 8 digit ID code."
  } else {
    console.log(`\nThe user's subscription has been successfully updated, with the tier value being changed to ${subscriber.tier} with it's duration being a ${subscriber.duration}.\n`);
    output = `The user's subscription has been successfully updated, with the tier value being changed to ${subscriber.tier} with it's duration being a ${subscriber.duration}.`
  }
  //res.end(output);
  return(output);
}





//acquires and returns the relevant info pertaining to the subscription info belonging to a given user
async function getSubscriber(idValue, api_token_val, data, req, res){
  var arrLen = data.length;
  let currentLine = 0;
  var outputUser = new Object;
  var output = "";
  outputUser = "ERROR:  No user can be found with the given ID code and its matching api_token value."

  //ends early if the id value given is not valid
  //if(idValue.length != 8 || idValue.isNaN || hasInvalidVal(idValue)){
  if((isInteger(idValue))){
    console.log("ERROR:  Given ID value is not a valid input.")
    output = "ERROR:  Given ID value is not a valid input."
    //res.end(output);
    return output;
  }
  // console.log(currentLine);
  // console.log(arrLen);
  //goes through all the items in the database table until it finds a user account that matches the given id, returning them
  while(currentLine<arrLen){
    // console.log(currentLine);
    // console.log(data[currentLine].api_token);
    // console.log(api_token_val);
    if(data[currentLine].id == idValue && data[currentLine].api_token == api_token_val){
      outputUser = data[currentLine];
      break;
    }
    currentLine++;
  }
  console.log(outputUser);
  //res.end(JSON.stringify(outputUser));
  return(JSON.stringify(outputUser));
}

//TODO:  CURRENTLY REQUIRES MANUAL CALLING/USE, DETERMINE HOW TO CREATE A SCHEDULE OR SOMETHING TO CHECK THE DATE AND CALL THE SUBSCRIPTION CANCELLATION PROCESS
async function cancelSubscription(idValue, api_token_val, data,req,res){
  var output = "";
      //if(idValue.length != 8 || idValue.isNaN || hasInvalidVal(idValue)){
      if((isInteger(idValue))){
          console.log("ERROR:  Given ID value is not a valid input.")
          output = "ERROR:  Given ID value is not a valid input."
          //res.end(output);
          return output;
      }
  
  var arrLen = data.length;
  let currentLine = 0;
  var foundUser = false;
  
  while(currentLine<arrLen){
    if(data[currentLine].id == idValue){
      foundUser = true;
      //let sql3 = `UPDATE subscription_database SET tier = 0, purchase_date = NULL, expire_date = NULL, cost = 0 WHERE id = ? AND api_token = ?`
      let sql3 = `UPDATE subscription_database AS sub
      JOIN users AS u ON sub.id = u.id
      SET sub.tier = 0,
          sub.purchase_date = NULL,
          sub.expire_date = NULL,
          sub.cost = 0
      WHERE sub.id = ? 
        AND sub.api_token = ?
        AND sub.tier = u.tier
        AND sub.user = u.username
        AND sub.email = u.email
        AND sub.credits = u.credits;
      `;
      await db.query(sql3, [idValue, api_token_val], (err) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            return;
        } else {
            console.log(`Subscription has been CANCELLED for id #${idValue} and the tier has been set to 0.`);
        }

      });

      await db.query(sql2, (err, rows) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            return;
        }
        tableAsString = Object.entries(rows);
      });
      break;
    }
    currentLine++;
  }

  if(!foundUser){      //output messages are returned to Postman
    console.log("\nERROR:  No user can be found with the given ID code.\n")
    output = "ERROR:  No user can be found with the given ID code."
  } else {
    console.log("\nThe user's subscription has been successfully updated, with the tier value being changed to 0.\n");
    output = "The user's subscription has been successfully updated, with the tier value being changed to 0."
  }
  //res.end(output);
  return(output);
}

async function autoCancelSubs(req, res){
  let expDate = new Date();
  
  let year = expDate.getFullYear();
  let month = String(expDate.getMonth() + 1).padStart(2, '0');
  let day = String(expDate.getDate()).padStart(2, '0');

  let formattedExpTime = `${year}${month}${day}`;

  //let sql6 = `UPDATE subscription_database SET tier = 0, purchase_date = NULL, expire_date = NULL, cost = 0 WHERE SUBSTR(expire_date, 1, 8) = SUBSTR(${formattedExpTime}, 1, 8)`;
  let sql6 = `UPDATE subscription_database AS sub
  JOIN users AS u ON sub.id = u.id
  SET sub.tier = 0,
      sub.purchase_date = NULL,
      sub.expire_date = NULL,
      sub.cost = 0
  WHERE SUBSTR(sub.expire_date, 1, 8) = SUBSTR(${formattedExpTime}, 1, 8)
    AND sub.id = u.id 
    AND sub.api_token = u.api_token
    AND sub.tier = u.tier
    AND sub.user = u.username
    AND sub.email = u.email
    AND sub.credits = u.credits;
  `;
  await db.query(sql6, (err) => {
    if (err) {
        console.error(`Error executing query: ${err.message}`);
        return;
    } else {
        console.log(`All subscriptions set to expire on ${formattedExpTime} have been properly cancelled.`);
    }

  });

  await db.query(sql2, (err, rows) => {
    if (err) {
        console.error(`Error executing query: ${err.message}`);
        return;
    }
    tableAsString = Object.entries(rows);
  });

  ////res.end(`All subscriptions set to expire on ${formattedExpTime} have been properly cancelled.`);
  return(`All subscriptions set to expire on ${formattedExpTime} have been properly cancelled.`);
}

function hasInvalidVal(s) {  //may not be used/necessary
    return s.indexOf(' ') + s.indexOf('.') +s.indexOf(',') >= 0;
}

function checkEmail(input){
    const email = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return (email.test(input));
}

function isInteger(value) {
  // Check if the value is a number and has no decimal part
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

module.exports = {selectOption, addToDatabase, updateSubscription, getSubscriber, cancelSubscription, autoCancelSubs};