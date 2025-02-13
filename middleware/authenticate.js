const {parseJwt, JwtBadToken} = require('../utility/jwt_utility')
const {Cache, CacheHit, CacheMiss, CacheError, CacheEmpty, SharedCache} = require('../utility/cache')
const {Database, SessionDatabase} = require('../utility/db_store')
const {KeyManager, KeySchema, KeyManagerError} = require('../utility/key_rotation')
const {calculate_hash} = require('../utility/password')
require('dotenv').config()

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

async function localStrategy(email, password, done) {
    console.log('localStrategy')
    if(!email || !password) {
        done(new Error('Email and password are required'), null)
        return
    }
    const queryUser = 'SELECT id, first_name, last_name, user_role, hashed_password, password_salt FROM user_account WHERE email = ? limit 1'
    const [err, rows] = await Database.query(queryUser, [email])
    if (err) {
        console.log(err)
        done(err, null)
        return
    }
    if (rows.length == 0) {
        done(null, false, {message: 'User not found'})
        return
    }
    const user = rows[0]
    const salt = user.password_salt
    const hashed_password = calculate_hash(password, salt)
    if (hashed_password != user.hashed_password) {
        done(null, false, {message: 'Incorrect password'})
        return
    }

    // In this project mvp suspension for admin users is not implemented
    // so, admin users are always allowed to login
    if(user.user_role == 'adm') {
        done(null, {
            id: user.id,
            email: email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.user_role
        })
        return
    }

    const querySuspension = 'SELECT suspension_reason from account_suspension where user_id = ? and suspension_end_at > ? order by suspension_end_at desc limit 1'
    const [errSuspension, rowsSuspension] = await Database.query(querySuspension, [user.id, new Date().toISOString()])
    if (errSuspension) {
        console.log(errSuspension)
        done(errSuspension, null)
        return
    }
    if (rowsSuspension.length > 0) {
        done(null, false, {message: 'User is suspended', suspension_reason: rowsSuspension[0].suspension_reason})
        return
    }
    done(null, {
        id: user.id,
        email: email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.user_role
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

async function deserializeUser(user, done) {
    console.log('deserializeUser')
    console.log(user)
    const query = 'SELECT id, email, first_name, last_name, user_role FROM user_account WHERE id = ?'
    Database.query(query, [user.id])
    .then(([err, rows]) => {
        if (err) {
            console.log(err)
            done(err)
            return
        }
        if (rows.length == 0) {
            done(err, null)
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

async function updateSessionIfLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
        next()
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
        // e.g. if user-agent switch during a session between different OSes or browsers
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
    authorize: authorize,
    localStrategy: localStrategy,
    serializeUser: serializeUser,
    deserializeUser: deserializeUser,
    loggedIn: loggedIn,
    storeMetadata: storeMetadata,
    updateSessionIfLoggedIn: updateSessionIfLoggedIn
}