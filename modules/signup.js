const crypto = require('crypto')
const {Database} = require('../utility/db_store')
const {KeyManager, KeySchema, KeyManagerError} = require('../utility/key_rotation')
const {v4: uuidv4} = require('uuid')
const {calculate_hash} = require('../utility/password')

class Signup {
    static async Get(req, res) {
        res.sendFile(__dirname + '/views/signup.html')
    }
    
    static async Post(req, res) {
        //get email from request body
        const email = (req.body.email) ? req.body.email : null
        if (email == null) {
            res.status(400).send('Email is required')
            return
        }
        
        var keySchema = await KeyManager.schema()
        if (keySchema instanceof KeyManagerError) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        //get public key from keys
        const signing_key = keySchema.signing
        const private_key = signing_key.private_key
        const kid = signing_key.kid

        //generate sha256 hash of email
        const hash = crypto.createHash('sha256')
        hash.update(email)
        const email_hash = hash.digest('hex')

        //generate jwt token
        const jwt = require('jsonwebtoken')
        const token = jwt.sign({
            hashed_email: email_hash,
        }, private_key, {
            algorithm: 'RS256', 
            expiresIn: '6h',
            keyid: kid
        })

        //generate uuid
        const uuid = uuidv4()

        const content = {
            token: token
        }
        const content_string = JSON.stringify(content)
        const email_type = 'verify_email'
        const id = uuid

        //store email in db
        const db = Database.database()
        const query = 'INSERT INTO email_inbox (id, email_type, content) VALUES (?, ?, ?)'
        const args = [id, email_type, content_string]
        const err = await Database.non_returning_query(query, args)
        if (err != null) {
            res.status(500).send('Service temporarily unavailable')
            return
        }

        res.render('email_sent', {
            email: email,
            action_title: 'Conferma email',
        })
    }
}

module.exports = {
    Signup: Signup
}