const crypto = require('crypto')

function calculate_hash(password, salt) {
    const res = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
    return res
}

function create_salt() {
    return crypto.randomBytes(11).toString('hex')
}

module.exports = {
    calculate_hash: calculate_hash,
    create_salt: create_salt
}