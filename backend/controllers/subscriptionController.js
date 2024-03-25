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

var sql2 = "SELECT * FROM subscription_database";
var tableAsString = "";
const db = require('../db');
    db.query(sql2, (err, rows)=>{
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            return;
        }
        tableAsString = Object.entries(rows);
    });



//have user determine what they want to do with the database/progrm:
function selectOption(input, req, res){
    var parseInput = JSON.parse(input); //insert method for acquiring input from postman
    let tempSubscriber = new Object;
    switch (parseInput.request.select){
        case "PURCHASE":    //calls Nikhils sub credits function
            console.log("Purchasing a subscription (first time)");
            tempSubscriber.id = parseInput.request.id;
            tempSubscriber.tier = parseInput.request.tier;
            tempSubscriber.user = parseInput.request.user;
            tempSubscriber.email = parseInput.request.email;
            tempSubscriber.duration = parseInput.request.duration;
            tempSubscriber.credits = parseInput.request.credits;
            return checkNewSubscriber(tempSubscriber, tableAsString, req, res);
            //break;
        case "UPDATE":      //calls Nikhils sub credits function
            console.log("Update subscription");
            tempSubscriber.id = parseInput.request.id;
            tempSubscriber.tier = parseInput.request.tier;
            tempSubscriber.duration = parseInput.request.duration;
            tempSubscriber.credits = parseInput.request.credits;        //TODO:  CODE SHOULD INSTEAD CALL VALUE FROM EXISTING DATABASE RATHER THAN FROM THE CALL, REMOVE THIS LINE IN FINAL
            return updateSubscription(tempSubscriber, tableAsString, req, res);
            //break;
        case "GET":     //done
            console.log("Getting user/subscription info");
            tempSubscriber.id = parseInput.request.id;
            return getSubscriber(tempSubscriber.id, tableAsString, req, res);
            //break;
        case "CANCEL":    //done
            console.log("Cancelling subscription for a user");
            tempSubscriber.id = parseInput.request.id;
            return cancelSubscription(tempSubscriber.id, tableAsString, req, res);
            //break;
        case "AUTOCANCEL":
            console.log("Autocancel subscriptions");
            return autoCancelSubs(req, res);
            //break;
        default:
            error = true;
            console.log("INVALID SELECTION INPUT DETECTED, PLEASE TRY AGAIN");
            return ("INVALID SELECTION INPUT DETECTED, PLEASE TRY AGAIN");
        break;
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
    if(input.id.length != 8 || input.id.isNaN || hasInvalidVal(input.id)){
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
    if(input.credits.length < 0 || input.credits.isNaN || hasInvalidVal(input.credits)){
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
  let sql4 = `INSERT INTO subscription_database (id, user, email, purchase_date, expire_date, tier, cost, credits) VALUES (?,?,?,?,?,?,?,?)`;

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
  }
  let year2 = expDate.getFullYear();
  let month2 = String(expDate.getMonth() + 1).padStart(2, '0');
  let day2 = String(expDate.getDate()).padStart(2, '0');
  let hours2 = String(expDate.getHours()).padStart(2, '0');
  let minutes2 = String(expDate.getMinutes()).padStart(2, '0');
  let seconds2 = String(expDate.getSeconds()).padStart(2, '0');

  let formattedExpTime = `${year2}${month2}${day2}T${hours2}${minutes2}${seconds2}`;

  await db.query(sql4, [newUser.id, newUser.user, newUser.email, formattedStartTime, formattedExpTime, newUser.tier, costVal, newUser.credits], (err) =>{
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
  if(subscriber.id.length != 8 || subscriber.id.isNaN || hasInvalidVal(subscriber.id)){
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
    if(data[currentLine][1].id == subscriber.id){
      foundUser = true;
      let sql5 = `UPDATE subscription_database SET tier = ${subscriber.tier}, cost = ${costVal}, purchase_date = \'${formattedStartTime}\', expire_date = \'${formattedExpTime}\', credits = ${subscriber.credits} WHERE id = ?`;
      await db.query(sql5, [subscriber.id], (err) => {
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
async function getSubscriber(idValue, data, req, res){
  var arrLen = data.length;
  let currentLine = 0;
  var outputUser = new Object;
  var output = "";
  outputUser = "ERROR:  No user can be found with the given ID code."

  //ends early if the id value given is not valid
  if(idValue.length != 8 || idValue.isNaN || hasInvalidVal(idValue)){
    console.log("ERROR:  Given ID value is not a valid input.")
    output = "ERROR:  Given ID value is not a valid input."
    //res.end(output);
    return output;
  }
  //goes through all the items in the database table until it finds a user account that matches the given id, returning them
  while(currentLine<arrLen){
    if(data[currentLine][1].id == idValue){
      outputUser = data[currentLine][1];
      break;
    }
    currentLine++;
  }
  console.log(outputUser);
  //res.end(JSON.stringify(outputUser));
  return(JSON.stringify(outputUser));
}

//TODO:  CURRENTLY REQUIRES MANUAL CALLING/USE, DETERMINE HOW TO CREATE A SCHEDULE OR SOMETHING TO CHECK THE DATE AND CALL THE SUBSCRIPTION CANCELLATION PROCESS
async function cancelSubscription(idValue,data,req,res){
  var output = "";
      if(idValue.length != 8 || idValue.isNaN || hasInvalidVal(idValue)){
          console.log("ERROR:  Given ID value is not a valid input.")
          output = "ERROR:  Given ID value is not a valid input."
          //res.end(output);
          return output;
      }
  
  var arrLen = data.length;
  let currentLine = 0;
  var foundUser = false;
  
  while(currentLine<arrLen){
    if(data[currentLine][1].id == idValue){
      foundUser = true;
      let sql3 = `UPDATE subscription_database SET tier = 0, purchase_date = NULL, expire_date = NULL, cost = 0 WHERE id = ?`

      await db.query(sql3, [idValue], (err) => {
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
    console.log("\nERROR:  No user can be found with the given 8 digit ID code.\n")
    output = "ERROR:  No user can be found with the given 8 digit ID code."
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

  let sql6 = `UPDATE subscription_database SET tier = 0, purchase_date = NULL, expire_date = NULL, cost = 0 WHERE SUBSTR(expire_date, 1, 8) = SUBSTR(${formattedExpTime}, 1, 8)`;
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

function hasInvalidVal(s) {
    return s.indexOf(' ') + s.indexOf('.') +s.indexOf(',') >= 0;
}

function checkEmail(input){
    const email = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return (email.test(input));
}

module.exports = {selectOption, addToDatabase, updateSubscription, getSubscriber, cancelSubscription, autoCancelSubs};