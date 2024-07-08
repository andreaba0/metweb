const {parseJwt, JwtBadToken} = require('../jwt_utility')
const {Cache, CacheHit, CacheMiss, CacheError, CacheEmpty, SharedCache} = require('../cache')

async function authenticate(req, res, next) {
    const cache_id = 'auth_key_store'
    const cache = SharedCache.cache(cache_id)
    //get cookie named 'token'
    const token = req.cookies.token
    //if token is not set, return response with status code 401
    if (token == null || token == "") {
        res.status(401).send('Token is not set')
        return
    }
    const parsedTokenGroups = parseJwt(token)
    if (parsedTokenGroups instanceof JwtBadToken) {
        return res.sendStatus(401).send('Invalid token')
    }
    const kid = parsedTokenGroups.header?.kid
    if (kid == null) {
        return res.sendStatus(401).send('Invalid token')
    }
    const key = cache.get(kid)
    if (key instanceof CacheEmpty)
        return res.sendStatus(500).send("Service temporarily unavailable")
    if (key == null) {
        return res.sendStatus(401).send('Maybe token is expired')
    }
    //verify token
    const verify = require('jsonwebtoken').verify
    verify(token, key.public_key, (err, decoded) => {
        if (err) {
            return res.sendStatus(401).send('Invalid token')
        }
        next()
    })
}

module.exports = {
    authenticate: authenticate
}