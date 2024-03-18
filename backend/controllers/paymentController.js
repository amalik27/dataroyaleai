require('dotenv').config();
const {getOrderAmount} = require('../utils/paymentUtils')
secret_key = process.env.STRIPE_SECRET_API_KEY
public_key = process.env.STRIPE_PUBLIC_API_KEY
console.log(secret_key)
const Stripe = require('stripe');
const stripe = Stripe(secret_key);

async function checkPurchase(credits) { //helper function to be placed in /utils later
    if(credits <= 0 || credits > 999999) {
        return false;
    }
    return true;
}

async function createPaymentIntent(credits, id, currency) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: getOrderAmount(credits),
            currency: currency,
        });
        //console.log(paymentIntent.id)
        return paymentIntent;
    } catch (err) {
        console.log(err)
        return false
    }
}

async function confirmPaymentIntent(client_id) {
    try {
        const paymentIntent = await stripe.paymentIntents.confirm(client_id, {
            payment_method: 'pm_card_visa',
            return_url: 'https://www.google.com',
            receipt_email: 'mgrimalovsky@gmail.com'
        });
        
        return paymentIntent;
    } catch (err) {
        console.log(err)
        return false
    }
}

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

// Sample Code for a "Pay" button
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
  
    if (!client_id) {
      return "Error with client secret. Please refresh.";
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(client_id);
    console.log(paymentIntent.status);
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
  }

  module.exports = {
    createPaymentIntent,
    confirmPaymentIntent,
    initialize,
    checkStatus,
    checkPurchase,
    handleSubmit
  }