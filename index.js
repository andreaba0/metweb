const sqlite3 = require('sqlite3').verbose()
const express = require('express')
require('dotenv').config()
const app = express()
const cookieParser = require('cookie-parser')
const {Cache, CacheHit, CacheMiss, CacheError} = require('./cache')
const cache = new Cache()

app.set('view engine', 'ejs')
app.use('/static', express.static(__dirname + '/static'))
app.use(cookieParser())

function parseKeyName(base64url_header) {
    try {
        //convert base64url to json
        const header = JSON.parse(Buffer.from(base64url_header, 'base64').toString('utf-8'))
        return header.kid
    } catch (e) {
        return null
    }
}

function getKey(kid) {
    const key = cache.get(kid)
    if (key instanceof CacheMiss)
        return null
    if (key instanceof CacheHit)
        return key.message()
    const db = new sqlite3.Database(process.env.DB_NAME)
    db.get('SELECT id, private_key, public_key FROM rsa_key order by created_at LIMIT 3', (err, rows) => {
        if (err || row == null)
            return null
        let keys = {}
        //loop thorugh rows and set keys[keys.id] = {private_key: keys.private_key, public_key: keys.public_key}
        rows.forEach(row => {
            keys[row.id] = {
                private_key: row.private_key,
                public_key: row.public_key
            }
        })
        //set cache with keys
        cache.set_raw(keys, 60*10)
        key = cache.get(kid)
        if (key instanceof CacheMiss || key instanceof CacheError)
            return null
        return key.message()
    })
}

function authenticate(req, res, next) {
    //get cookie named 'token'
    const token = req.cookies.token
    //if token is not set, return response with status code 401
    if (token == null || token == "") {
        return res.sendStatus(401).send('Token is not set')
    }
    const re =/^(?<header>[a-zA-Z0-9\-\_]+).(?<payload>[a-zA-Z0-9\-\_]+).(?<signature>[a-zA-Z0-9\-\_]+)$/g
    const match = re.exec(token)
    if (match == null) {
        return res.sendStatus(401).send('Invalid token')
    }
    const kid = parseKeyName(match.groups.header)
    if (kid == null) {
        return res.sendStatus(401).send('Invalid token')
    }
    const key = getKey(kid)
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

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/views/signup.html')
})

app.post('/signup', (req, res) => {
    res.redirect('/confirm')
})

app.get('/confirm', (req, res) => {
    res.sendFile(__dirname + '/views/confirm.html')
})

app.get('/signin', (req, res) => {
    res.sendFile(__dirname + '/views/signin.html')
})

app.get('/inbox', (req, res) => {
    res.sendFile(__dirname + '/views/inbox.html')
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/views/about.html')
})

app.get('/mock/signup/confirm/:uuid', (req, res) => {
    res.sendStatus(204)
})

const port = process.env.PORT
if (port == null || port == "") {
    throw new Error('PORT is not defined in .env file')
}
const db_name = process.env.DB_NAME
if (db_name == null || db_name == "") {
    throw new Error('DB_NAME is not defined in .env file')
}
const bound_ip = process.env.BOUND_IP
if (bound_ip == null || bound_ip == "") {
    throw new Error('BOUND_IP is not defined in .env file')
}
app.listen(port, bound_ip, () => {
    console.log(`Server is running on port ${port}`)
})