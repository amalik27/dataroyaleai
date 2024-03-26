const crypto = require('crypto');

function encryptSHA1(password) {
    const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(password);
    return sha1Hash.digest('hex');
}

function encrypt(password, salt) {
    const concatenatedPassword = password + salt;
    const hash = crypto.createHash('sha256').update(concatenatedPassword).digest('hex');
    return hash;
}

module.exports = {
    encrypt,
    encryptSHA1
};

