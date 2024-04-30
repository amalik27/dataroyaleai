/*
Author: Matthew Grimalovsky
Email: mg1803@scarletmail.rutgers
To get started: go to stripe.com, sign up, and get your secret and public key
Add these keys to your .env file
DON'T OVERUSE .... 6k email limit, 1.5k contacts limit
*/

require('dotenv').config();
const {getOrderAmount} = require('../utils/paymentUtils')
secret_key = process.env.STRIPE_SECRET_API_KEY
public_key = process.env.STRIPE_PUBLIC_API_KEY
//console.log(secret_key)
const Stripe = require('stripe');
const stripe = Stripe(secret_key);

async function checkPurchase(credits) { //helper function to be placed in /utils later
    if(credits <= 0 || credits > 999999) {
        return false;
    }
    return true;
}

const addCredits = (id, credits) => {
  return
}

const subtractCredits = (id, credits) => {
  return
}

async function createPaymentIntent(credits, id, currency) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: getOrderAmount(credits),
            currency: currency,
        });
        //console.log(paymentIntent.client_secret)
        return paymentIntent;
    } catch (err) {
        console.log(err)
        return false
    }
}

async function confirmPaymentIntent(client_id, payment_method) {
    try {
        const paymentIntent = await stripe.paymentIntents.confirm(client_id, {
            payment_method: payment_method,
            return_url: 'https://www.google.com', //TODO: replace with checkout HTML page
        });
        return paymentIntent;
    } catch (err) {
        //console.log(err)
        return false
    }
}

/**  THE FOLLOWING ARE CLIENT-SIDE SCRIPTS FOR THE FRONT-END, TO BE USED LATER */

// Call this to initialize payment setup for a particular user on the client side
async function initialize() {
    const response = await fetch("/create-payment-intent", { //endpoint for creating an intent, should be in /routes
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response}),
    });
    const { clientSecret } = await response.json();
    return clientSecret;
  }

// Sample Code for a "Pay" button on client side
async function handleSubmit(e) {
    e.preventDefault();
  
    const { error } = await stripe.confirmPayment({
      confirmParams: {
        // returns completion page
        return_url: "<checkout url>",
      },
    });
  
    // immediate error with payment
    if (error.type === "card_error" || error.type === "validation_error") {
      console.log(error.message); //replace with some sort of alert on the frontend
    } else { 
      console.log("An unexpected error occurred.");
    }
  }
  
  // Gets payment status after payment submission
  async function checkStatus(client_id) {
    // const clientSecret = new URLSearchParams(window.location.search).get(
    //   "payment_intent_client_secret" //client secret is stored in user's window
    // );
    try {
      if (!client_id) {
        return "Error with client secret. Please refresh.";
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(client_id);
      //console.log(paymentIntent.status);
      switch (paymentIntent.status) {
        case "succeeded":
          return "Payment succeeded!";
        case "processing":
          return "Payment is processing.";
        case "requires_payment_method":
          return "Payment has not been initiated or was unsuccessful.";
        default:
          return "Something went wrong.";
      }
    } catch {
      return false;
    }
  }

  module.exports = {
    addCredits,
    subtractCredits,
    createPaymentIntent,
    confirmPaymentIntent,
    initialize,
    checkStatus,
    checkPurchase,
    handleSubmit
  }
