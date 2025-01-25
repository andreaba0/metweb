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

    static sanitizeSigninData(req, res, next) {
        const body = req.body
        const email = body.email
        const password = body.password
        var old_data = {}
        if (email) {
            old_data.email = email
        }
        if (!email || !password) {
            res.status(400).render('signin', {
                old: {...old_data},
                error: 'All fields are required'
            })
            return
        }
        next()
    }
}

module.exports = {
    Signin: Signin
}