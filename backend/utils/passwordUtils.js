const crypto = require('crypto');

function encrypt(password, salt) {
    const concatenatedPassword = password + salt;
    const hash = crypto.createHash('sha256').update(concatenatedPassword).digest('hex');
    return hash;
}

module.exports = {
    encrypt
};

