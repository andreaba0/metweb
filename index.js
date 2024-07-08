const express = require('express')
require('dotenv').config()
const app = express()
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const {Cache, CacheHit, CacheMiss, CacheError} = require('./cache')
const {authenticate} = require('./middleware/authenticate')
const {KeyManager, KeySchema, KeyManagerError} = require('./key_rotation')
const {v4: uuidv4} = require('uuid')
const crypto = require('crypto')
const {Database} = require('./db_store')

app.set('view engine', 'ejs')
app.use('/static', express.static(__dirname + '/static'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/views/signup.html')
})

app.post('/signup', async (req, res) => {
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
    const result = await Database.non_returning_query(query, args)
    if (result == null) {
        res.status(500).send('Service temporarily unavailable')
        return
    }

    res.render('email_sent', {
        email: email,
        action_title: 'Conferma email',
    })
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

app.get('/poll/:uuid', authenticate, (req, res) => {
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