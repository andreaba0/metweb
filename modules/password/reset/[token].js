const {calculate_hash, create_salt} = require('../../../utility/password')
const {v4: uuidv4} = require('uuid')
const {Database} = require('../../../utility/db_store')
const crypto = require('crypto')
const {KeyManager, KeySchema, KeyManagerError} = require('../../../utility/key_rotation')
const {parseJwt, JwtBadToken} = require('../../../utility/jwt_utility')

class PasswordReset {
    static async Get(req, res) {
        const token = req.params.token
        if (token == null) {
            res.status(400).send('Invalid token')
            return
        }
        res.render('password/reset', {
            token: token
        })
    }

    static async Post(req, res) {
        const formBody = req.body
        const token = req.params.token
        const password = formBody.password
        const confirm_password = formBody.confirm_password
        const email = formBody.email
        if (!token || !password || !confirm_password || !email) {
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
            res.status(400).send('Token non valido o scaduto')
            return
        }
        const kid = groups.header?.kid
        if (kid == null) {
            res.status(400).send('Token non valido')
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
        const iat = decoded.iat
        const email_hash = decoded.hashed_email
        const hash = crypto.createHash('sha256')
        hash.update(email)
        const email_hash_check = hash.digest('hex')
        if (email_hash != email_hash_check) {
            res.status(400).send('Invalid email')
            return
        }
        const id = uuidv4()
        const query = `
            update 
                user_account 
            set 
                hashed_password = ?, 
                password_salt = ?, 
                account_barrier = ? 
            where 
                email = ? and
                account_barrier < ?
            returning id
        `
        const salt = create_salt()
        const hashed_password = calculate_hash(password, salt)
        const account_barrier = iat * 1000
        const date_from_iat_epoch = new Date(account_barrier).toUTCString()
        const args = [hashed_password, salt, date_from_iat_epoch, email, date_from_iat_epoch]
        const [err, result] = await Database.query(query, args)
        if (err) {
            console.log(err)
            res.status(500).send('Impossibile modificare la password')
            return
        }
        if (result.length == 0) {
            res.status(400).send('Il token potrebbe essere scaduto')
            return
        }
        console.log(result)
        res.status(201).send('Password modificata con successo')
    }
}

module.exports = {
    PasswordReset: PasswordReset
}