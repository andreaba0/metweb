const {parseJwt, JwtBadToken} = require('../jwt_utility')
const {Cache, CacheHit, CacheMiss, CacheError, CacheEmpty, SharedCache} = require('../cache')
const {Database} = require('../db_store')
const {KeyManager, KeySchema, KeyManagerError} = require('../key_rotation')

async function renew_expired_token(req, res, next) {
    if (!req.user.expired) {
        next()
        return
    }
}

async function authenticate(req, res, next) {
    const token = req.cookies.token
    if (token == null || token == "") {
        res.status(401).send('Token is not set')
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
            expired: decoded.authenticated_till < current_time
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

module.exports = {
    authenticate: authenticate
}