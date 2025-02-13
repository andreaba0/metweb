const {calculate_hash, create_salt} = require('../../../utility/password')
const {v4: uuidv4} = require('uuid')
const {Database} = require('../../../utility/db_store')
const crypto = require('crypto')
const {KeyManager, KeySchema, KeyManagerError} = require('../../../utility/key_rotation')
const {parseJwt, JwtBadToken} = require('../../../utility/jwt_utility')
const {CustomDate} = require('../../../utility/date')
const {User} = require('../../../types/user')


function uploadUserTransactioon(id, first_name, last_name, date_of_birth, email, hashed_password, password_salt, gender, user_role) {
    return (db) => {
        return new Promise(async (resolve, reject) => {
            var query;
            var args;
            var errBegin = await Database.non_returning_query(db, 'BEGIN TRANSACTION', [])
            if (errBegin) {
                reject(errBegin)
                return
            }
            var errPragma = await Database.non_returning_query(db, 'PRAGMA foreign_keys = ON', [])
            if (errPragma) {
                reject(errPragma)
                return
            }
            query = `
                INSERT INTO user_account 
                (id, first_name, last_name, date_of_birth, email, hashed_password, password_salt, gender, user_role) 
                VALUES 
                (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                RETURNING id`
            args = [id, first_name, last_name, date_of_birth, email, hashed_password, password_salt, gender, user_role]
            var [errUserAccount, resUserAccount] = await Database.query(db, query, args)
            if (errUserAccount) {
                reject(errUserAccount)
                return
            }
            if (resUserAccount.length == 0) {
                reject(new Error('Account not created'))
                return
            }
            query = 'INSERT INTO user_customer (user_id, user_role) VALUES (?, ?)'
            args = [id, user_role]
            var [errUserCustomer, resUserCustomer] = await Database.query(db, query, args)
            if (errUserCustomer) {
                reject(errUserCustomer)
                return
            }
            var errCommit = await Database.non_returning_query(db, 'COMMIT', [])
            if (errCommit) {
                reject(errCommit)
                return
            }
            resolve(resUserAccount)
        })
    }
}


class SignupConfirmToken {
    static async Get(req, res) {
        const token = req.params.token
        if (!token) {
            res.status(400).send('Invalid token')
            return
        }
        res.render('confirm', {
            token: token
        })
    }

    static async Post(req, res) {
        console.log('confirming email')
        console.log(req.body)
        const formBody = req.body
        const token = req.params.token
        /*const first_name = formBody.first_name
        const last_name = formBody.last_name
        const password = formBody.password
        const confirm_password = formBody.confirm_password
        const email = formBody.email
        const birthdate = formBody.birthdate
        if (!token || !first_name || !last_name || !birthdate || !password || !confirm_password || !email) {
            res.status(400).send('All fields are required')
            return
        }
        console.log(birthdate)
        if (password != confirm_password) {
            res.status(400).send('Passwords do not match')
            return
        }*/

        var errorsCredentials = User.evaluateSigninCredentials(formBody)
        var errorsAnagraphic = User.evaluateAnagraphicData(formBody)
        var errors = [...errorsCredentials, ...errorsAnagraphic]

        if (errors.length > 0) {
            res.status(400).json(errors)
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
        const email = formBody.email
        const hash = crypto.createHash('sha256')
        hash.update(email)
        const email_hash_check = hash.digest('hex')
        if (email_hash != email_hash_check) {
            res.status(400).json([{
                field: 'email',
                message: 'Email does not match'
            }])
            return
        }
        const id = uuidv4()
        /*const query = 'INSERT INTO user_account (id, first_name, last_name, date_of_birth, email, hashed_password, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
        const salt = create_salt()
        const hashed_password = calculate_hash(password, salt)
        const args = [id, first_name, last_name, birthdate, email, hashed_password, salt]
        const [err, result] = await Database.query(query, args)
        if (err) {
            console.log(err.message)
            if (err.message.includes('UNIQUE constraint') && err.message.includes('user_account.email')) {
                res.status(400).send('Email already exists')
                return
            }
            res.status(500).send('Service temporarily unavailable')
            return
        }*/
        const salt = create_salt()
        const hashed_password = calculate_hash(formBody.password, salt)
        const birthdate = CustomDate.parse_from_frontend_date(formBody.date_of_birth)
        const uploadT = uploadUserTransactioon(
            id, 
            formBody.first_name, 
            formBody.last_name, 
            birthdate, 
            formBody.email,
            hashed_password,
            salt,
            formBody.gender,
            'usr'
        )
        var [err, result] = await Database.run_scoped_transaction(uploadT)
        if (err) {
            console.log(err)
            res.status(500).send('Service temporarily unavailable')
        } else {
            res.status(201).send('Account created')
        }
    }
}

module.exports = {
    SignupConfirmToken: SignupConfirmToken
}