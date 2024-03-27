/*
To get started: go to mailjet.com, sign up, and get your public and private key
Add these keys to your .env file
*/

const Mailjet = require('node-mailjet');
require('dotenv').config()
const mailjet = new Mailjet({
    apiKey: process.env.MJ_APIKEY_PUBLIC,
    apiSecret: process.env.MJ_APIKEY_PRIVATE
});

function checkEmail(email) { // Evaluates whether an email address is in the correct format, as MailJet does not provide this endpoint
    var emailFormat = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/; //https://regex101.com/r/lHs2R3/1 for the regex
    if (email !== '' && email.match(emailFormat)) { 
        return true; 
    }
    return false;
}

async function send_mail(sender_email, sender_name, receiver_email, receiver_name, subject, text, html=false) {
     /*
    RETURNS STATUS CODE, 200 = OK, ANYTHING ELSE = BAD

    SENDS EMAIL OF THE FORM:
    From: <sender_name> @ <sender_email>
    To: <receiver_name> @ <receiver_email>
    Subject: <subject>
    Body:
    <text> or <html> //IF YOU PUT SOMETHING IN HTML, IT WILL OVERRIDE THE TEXT
    */
    return new Promise((resolve, reject) => {
        json_body = {
            Messages: [
                {
                    From: {
                        Email: sender_email,
                        Name: sender_name
                    },
                    To: [
                        {
                            Email: receiver_email,
                            Name: receiver_name
                        }
                    ],
                    Subject: subject,
                    TextPart: text,
                    ...html && {HTMLPart: html}
                }
            ]
        };
        console.log(json_body)
        const request = mailjet
            .post('send', { version: 'v3.1' })
            .request(json_body);

        request.then((result) => {
                resolve(result.response.status);
            })
            .catch((err) => {
                reject(err.statusCode);
            });
    });
}

send_mail("email@gmail.com", "John Appleseed", "Email@gmail.com", "Another P. Erson", "A Subject Line", "Test Notification", false)
module.exports = {
    checkEmail,
    send_mail
}