const {calculate_hash, create_salt} = require('../../utility/password')
const {v4: uuidv4} = require('uuid')
const {Database} = require('../../utility/db_store')
const crypto = require('crypto')
const {KeyManager, KeySchema, KeyManagerError} = require('../../utility/key_rotation')
const {parseJwt, JwtBadToken} = require('../../utility/jwt_utility')

class PasswordRecovery {

    static async Post(req, res) {
        const formBody = req.body
        const email = formBody.email
        if (!email) {
            res.status(400).send('Email is required')
            return
        }
        const jwt = require('jsonwebtoken')
        const keySchema = await KeyManager.schema()
        if (keySchema instanceof KeyManagerError) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        const signing_key = keySchema.signing
        const private_key = signing_key.private_key
        const kid = signing_key.kid
        const hash = crypto.createHash('sha256')
        hash.update(email)
        const email_hash = hash.digest('hex')
        const token = jwt.sign({
            hashed_email: email_hash,
            type: 'reset_password'
        }, private_key, {
            algorithm: 'RS256', 
            expiresIn: '6h',
            keyid: kid
        })
        const id = uuidv4()
        const content = {
            token: token
        }
        const content_string = JSON.stringify(content)
        const email_type = 'reset_password'
        const query = 'INSERT INTO email_inbox (id, email_type, content) VALUES (?, ?, ?)'
        const args = [id, email_type, content_string]
        const err = await Database.non_returning_query(query, args)
        if (err) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        res.render('email_sent', {
            action_title: 'Password Recovery',
            email: email
        })
    }
}

module.exports = {
    PasswordRecovery: PasswordRecovery
}