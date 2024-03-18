const Mailjet = require('node-mailjet');
require('dotenv').config()
const mailjet = new Mailjet({
    apiKey: process.env.MJ_APIKEY_PUBLIC,
    apiSecret: process.env.MJ_APIKEY_PRIVATE
});

async function send_mail(sender_email, sender_name, receiver_email, receiver_name, subject, text, html) {
     /*
    RETURNS STATUS CODE, 200 = OK, ANYTHING ELSE = BAD

    SENDS EMAIL OF THE FORM:
    From: <sender_name> @ <sender_email>
    To: <receiver_name> @ <receiver_email>
    Subject: <subject>
    Metadat: <text>
    Body:
    <html>
    */
    return new Promise((resolve, reject) => {
        const request = mailjet
            .post('send', { version: 'v3.1' })
            .request({
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
                        HTMLPart: html
                    }
                ]
            });

        request.then((result) => {
                resolve(result.response.status);
            })
            .catch((err) => {
                reject(err.statusCode);
            });
    });
}