const {calculate_hash, create_salt} = require('../../../utility/password')
const {v4: uuidv4} = require('uuid')
const {Database} = require('../../../utility/db_store')
const crypto = require('crypto')
const {KeyManager, KeySchema, KeyManagerError} = require('../../../utility/key_rotation')
const {parseJwt, JwtBadToken} = require('../../../utility/jwt_utility')

class SignupConfirmToken {
    static async Get(req, res) {
        const token = req.params.token
        if (token == null) {
            res.status(400).send('Invalid token')
            return
        }
        res.render('confirm', {
            token: token
        })
    }

    static async Post(req, res) {
        console.log('confirming email')
        const formBody = req.body
        const token = formBody.token
        const first_name = formBody.first_name
        const last_name = formBody.last_name
        const password = formBody.password
        const confirm_password = formBody.confirm_password
        const email = formBody.email
        if (token == null || first_name == null || last_name == null || password == null || confirm_password == null || email == null) {
            res.status(400).send('All fields are required')
            return
        }
        if (password != confirm_password) {
            res.status(400).send('Passwords do not match')
            return
        }
        const jwt = require('jsonwebtoken')
        const keySchema = await KeyManager.schema()
        if (keySchema instanceof KeyManagerError) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        const groups = parseJwt(token)
        if (groups instanceof JwtBadToken) {
            res.status(400).send('Invalid token')
            return
        }
        const kid = groups.header?.kid
        if (kid == null) {
            res.status(400).send('Invalid token')
            return
        }
        const validatingKey = keySchema.validation(kid)
        const public_key = validatingKey.public_key
        let decoded = null
        try {
            decoded = jwt.verify(token, public_key, {
                algorithms: ['RS256']
            })
        } catch(e) {
            console.log(e)
            if (e instanceof jwt.TokenExpiredError) {
                res.status(400).send('Token expired')
                return
            }
            res.status(400).send('Invalid token')
            return
        }
        const email_hash = decoded.hashed_email
        const hash = crypto.createHash('sha256')
        hash.update(email)
        const email_hash_check = hash.digest('hex')
        if (email_hash != email_hash_check) {
            res.status(400).send('Invalid email')
            return
        }
        const id = uuidv4()
        const query = 'INSERT INTO user_account (id, first_name, last_name, email, hashed_password, password_salt) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
        const salt = create_salt()
        const hashed_password = calculate_hash(password, salt)
        const args = [id, first_name, last_name, email, hashed_password, salt]
        const [err, result] = await Database.query(query, args)
        if (err) {
            console.log(err.message)
            if (err.message.includes('UNIQUE constraint') && err.message.includes('user_account.email')) {
                res.status(400).send('Email already exists')
                return
            }
            res.status(500).send('Service temporarily unavailable')
            return
        }
        res.status(201).send('Account created')
    }
}

module.exports = {
    SignupConfirmToken: SignupConfirmToken
}