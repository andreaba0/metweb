const {Database} = require('../utility/db_store')
const { FrontendError } = require('../utility/error')
const {KeyManager, KeySchema, KeyManagerError} = require('../utility/key_rotation')
const crypto = require('crypto')
const {parseJwt, JwtBadToken} = require('../utility/jwt_utility')
const {calculate_hash} = require('../utility/password')

class Signin {
    static async Get(req, res) {
        res.render('signin')
    }
    static async Post(req, res) {
        const body = req.body
        const email = body.email
        const password = body.password
        if (email == null || password == null) {
            res.status(400).render('signin', {
                error: 'All fields are required'
            })
            return
        }
        const query = 'SELECT id, first_name, last_name, email, hashed_password, password_salt, user_role FROM user_account WHERE email = ?'
        const [err, result] = await Database.query(query, [email])
        if (err) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        if (result.length == 0) {
            res.status(400).render('signin', {
                old: {
                    email: email
                },
                error: 'Invalid credentials'
            })
            return
        }
        const user = result[0]
        const salt = user.password_salt
        const hashed_password = calculate_hash(password, salt)
        if (hashed_password != user.hashed_password) {
            res.status(400).render('signin', {
                old: {
                    email: email
                },
                error: 'Invalid credentials'
            })
            return
        }
        const keySchema = await KeyManager.schema()
        if (keySchema instanceof KeyManagerError) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        const signing_key = keySchema.signing
        const private_key = signing_key.private_key
        const kid = signing_key.kid
        const jwt = require('jsonwebtoken')
        const token = jwt.sign({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            authenticated_till: (new Date()).getTime() + 10 * 60 * 1000,
            role: user.user_role,
            aud: process.env.TOKEN_AUD,
            iss: process.env.TOKEN_ISS
        }, private_key, {
            algorithm: 'RS256',
            expiresIn: '30d',
            keyid: kid
        })
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // only for testing. Change to true in production
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        res.redirect(302, '/profile')
    }
}

module.exports = {
    Signin: Signin
}