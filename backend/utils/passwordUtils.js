const bcrypt = require('bcrypt');

function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function encrypt(password){
    const randomString = generateRandomString(16);
    const concatenatedPassword = password + randomString;
    bcrypt.hash(concatenatedPassword, 10, function(err, hash) {
        if (err) {
            return [err, hash];
        } else {
            return [randomString, hash];
        }
    });
}

module.exports = {
    encrypt
};

