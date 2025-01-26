const {parseJwt, JwtBadToken} = require('../utility/jwt_utility')
const {Cache, CacheHit, CacheMiss, CacheError, CacheEmpty, SharedCache} = require('../utility/cache')
const {Database, SessionDatabase} = require('../utility/db_store')
const {KeyManager, KeySchema, KeyManagerError} = require('../utility/key_rotation')
const {calculate_hash} = require('../utility/password')
require('dotenv').config()

async function renew_expired_token(req, res, next) {
    if (!req.user.expired) {
        next()
        return
    }
}

async function authenticate(req, res, next) {
    const token = req.cookies.token
    if (token == null || token == "") {
        res.redirect(302, '/signin')
        return
    }
    const cache_id = 'auth_key_store'
    const cache = SharedCache.cache(cache_id)
    const parsedTokenGroups = parseJwt(token)
    if (parsedTokenGroups instanceof JwtBadToken) {
        return res.sendStatus(401).send('Invalid token')
    }
    const kid = parsedTokenGroups.header?.kid
    if (kid == null) {
        return res.sendStatus(401).send('Invalid token')
    }
    const keySchema = await KeyManager.schema()
    if (keySchema instanceof KeyManagerError) {
        return res.sendStatus(500).send('Service temporarily unavailable')
    }
    const validation_key = keySchema.validation(kid)
    if (validation_key == null) {
        return res.sendStatus(401).send('Invalid token')
    }
    const publicKey = validation_key.public_key
    const verify = require('jsonwebtoken').verify
    try {
        let decoded = verify(token, publicKey)
        const current_time = new Date().getTime()
        req.user = {
            id: decoded.id,
            first_name: decoded.first_name,
            last_name: decoded.last_name,
            expired: decoded.authenticated_till < current_time,
            issued_at: decoded.iat,
            role: decoded.role
        }
        next()
        return
    } catch(err) {
        console.log(err)
        return res.sendStatus(401).send('Invalid token')
    }
    //TODO renew token
    console.log('renew token')

    next()
}

async function renewExpired(req, res, next) {
    console.log(req.user)
    if (!req.user.expired) {
        next()
        return
    }
    const user_id = req.user.id
    const iat = req.user.issued_at
    const query = "SELECT first_name, last_name, user_role, account_barrier FROM user_account WHERE id = ?"
    const args = [user_id]
    const [err, rows] = await Database.query(query, args)
    if (err) {
        console.log(err)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (rows.length == 0) {
        res.clearCookie('token')
        res.status(401).send('User no longer exists')
        return
    }
    const user = rows[0]
    console.log(user)
    if (user.user_role != req.user.role) {
        res.clearCookie('token')
        res.status(401).send('User role has changed')
        return
    }
    const current_time = new Date().getTime()
    const issued_at = current_time
    const account_barrier_time = new Date(`${user.account_barrier}Z`).getTime()
    if (iat*1000 < account_barrier_time) {
        res.clearCookie('token')
        res.status(401).send('Token has been revoked')
        return
    }
    const authenticated_till = current_time + (10*60*1000)
    const payload = {
        id: user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.user_role,
        authenticated_till: authenticated_till,
        aud: process.env.TOKEN_AUD,
        iss: process.env.TOKEN_ISS
    }
    const jwt = require('jsonwebtoken')
    const keySchema = await KeyManager.schema()
    if (keySchema instanceof KeyManagerError) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    const key = keySchema.signing
    console.log(key)
    const privateKey = key.private_key
    const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '30d',
        keyid: key.kid
    })
    res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 30*24*60*60*1000
    })
    next()
}

function authorize(role) {
    if (role != 'admin' && role != 'user' && role != '*') {
        return function(req, res, next) {
            res.status(500).send('Backend error')
        }
    }
    return function(req, res, next) {
        if ((role == 'user' && req.user.role == 'usr') || (role == 'admin' && req.user.role == 'adm')) {
            next()
            return
        }
        if (role == '*') {
            next()
            return
        }
        res.status(403).send('Unauthorized')
    }
}

function localStrategy(email, password, done) {
    console.log('localStrategy')
    if(!email || !password) {
        done(new Error('Email and password are required'), null)
        return
    }
    const query = 'SELECT id, banned, first_name, last_name, user_role, hashed_password, password_salt FROM user_account WHERE email = ?'
    Database.query(query, [email])
    .then(([err, rows]) => {
        if (err) {
            done(err)
            return
        }
        if (rows.length == 0) {
            done(new Error('User not found'), null)
            return
        }
        const user = rows[0]
        const salt = user.password_salt
        const hashed_password = calculate_hash(password, salt)
        if (hashed_password != user.hashed_password) {
            done(null, false)
            return
        }
        if (user.banned) {
            done(new Error('Your account has been banned'), null)
            return
        }
        done(null, {
            id: user.id,
            email: email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.user_role
        })
    })
    .catch(err => {
        done(err)
    })
}

function serializeUser(user, done) {
    console.log('serializeUser')
    done(null, {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
    })
}

function deserializeUser(user, done) {
    console.log('deserializeUser')
    const query = 'SELECT id, email, first_name, last_name, user_role FROM user_account WHERE id = ?'
    Database.query(query, [user.id])
    .then(([err, rows]) => {
        if (err) {
            console.log(err)
            done(err)
            return
        }
        if (rows.length == 0) {
            done(new Error('User not found'), null)
            return
        }
        const user = rows[0]
        done(null, {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.user_role
        })
    })
    .catch(err => {
        done(err)
    })
}

async function loggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
        res.redirect('/signin')
        return
    }
    req.session.access = {
        last_access: new Date().toISOString()
    }
    try {
        await saveMetadata(req)
    } catch(err) {
        console.log(err)
    }
    next()
}

async function saveMetadata(req) {
    return new Promise((resolve, reject) => {
        req.session.save(err => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

async function storeMetadata(req, res, next) {
    req.session.metadata = {
        
        // user-agent could be a useful way to detect potential session hijacking
        // e.g. if user-agent switch during a session between different OS or browser
        // it could be a sign of session hijacking
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString()
    }
    try {
        await saveMetadata(req)
        next()
    } catch(err) {
        console.log(err)
        res.status(500).send('Service temporarily unavailable')
    }
}

module.exports = {
    authenticate: authenticate,
    renewExpired: renewExpired,
    authorize: authorize,
    localStrategy: localStrategy,
    serializeUser: serializeUser,
    deserializeUser: deserializeUser,
    loggedIn: loggedIn,
    storeMetadata: storeMetadata
}