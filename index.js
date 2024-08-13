const express = require('express')
require('dotenv').config()
const app = express()
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const {Cache, CacheHit, CacheMiss, CacheError} = require('./cache')
const {authenticate, renewExpired} = require('./middleware/authenticate')
const {KeyManager, KeySchema, KeyManagerError} = require('./key_rotation')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')
const crypto = require('crypto')
const {Database} = require('./db_store')
const {parseJwt, JwtBadToken} = require('./jwt_utility')
const {CustomDate} = require('./date')
const {pollSanitizer} = require('./middleware/poll_sanitizer')

app.set('view engine', 'ejs')
app.use('/static', express.static(__dirname + '/static'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

function calculate_hash(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
}

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
    const err = await Database.non_returning_query(query, args)
    if (err != null) {
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

app.get('/poll/compile/:id', authenticate, async (req, res) => {
    const id = req.params.id
    let query = `
        SELECT id, 
            created_by, 
            vote_type, 
            title, 
            vote_description, 
            restrict_filter, 
            option_type, 
            available,
            compile_start_at,
            compile_end_at
        FROM vote_page 
        WHERE id = ?`
    let [err, result] = await Database.query(query, [id])
    if (err) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (result.length == 0) {
        res.status(404).send('Poll not found')
        return
    }
    const poll_page = result[0]
    if (poll_page.created_by == req.user.id) {
        res.status(403).send('You cannot compile a poll you created')
        return
    }
    if (poll_page.available == false) {
        res.status(403).send('This poll has been suspended')
        return
    }
    const validFrom = CustomDate.from_UTC_timestamp(poll_page.compile_start_at).getTime()
    const validTo = CustomDate.from_UTC_timestamp(poll_page.compile_end_at).getTime()
    const now = new Date().getTime()
    if (now < validFrom || now > validTo) {
        res.status(403).send('Poll is not available at the moment')
        return
    }
    query = `SELECT option_index, option_text FROM vote_option WHERE vote_page_id = ?`
    [err, result] = await Database.query(query, [id])
    if (err) {
        console.log(err)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    const options = result
    if (options.length == 0) {
        res.status(500).send('Poll may be corrupted')
        return
    }
    res.render('poll/compile', {
        id: id,
        title: poll_page.title,
        description: poll_page.vote_description,
        options: options,
        multiple_choice: poll_page.option_type == 'multiple' ? true : false
    })
})

app.get('/signin', (req, res) => {
    res.sendFile(__dirname + '/views/signin.html')
})

app.post('/signin', async (req, res) => {
    const body = req.body
    const email = body.email
    const password = body.password
    if (email == null || password == null) {
        res.status(400).send('All fields are required')
        return
    }
    const query = 'SELECT id, first_name, last_name, email, hashed_password, password_salt, user_role FROM user_account WHERE email = ?'
    const [err, result] = await Database.query(query, [email])
    if (err) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (result.length == 0) {
        res.status(400).send('User not found')
        return
    }
    const user = result[0]
    const salt = user.password_salt
    const hashed_password = calculate_hash(password, salt)
    if (hashed_password != user.hashed_password) {
        res.status(400).send('Invalid credentials')
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
    //res.redirect(302, '/')
    res.status(200).send('Authenticated')
})

app.get('/inbox', async (req, res) => {
    const query = 'SELECT id, email_type, content FROM email_inbox order by created_at desc limit 10'
    const [err, result] = await Database.query(query, [])
    if (err) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    const emails = result
    let messages = []
    emails.forEach(email => {
        const content = JSON.parse(email.content)
        if (email.email_type != 'verify_email') {
            return
        }
        messages.push({
            id: email.id,
            subject: 'Conferma la tua email',
            body: `Per confermare la tua email clicca il link seguente:
            <a href="http://${process.env.BOUND_IP}:${process.env.PORT}/signup/confirm/${content.token}">Conferma email</a>
            `
        })
    })
    res.render('inbox', {
        messages: messages
    })
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/views/about.html')
})

app.get('/poll/create/:uuid', authenticate, async (req, res) => {
    if (req.params.uuid == null) {
        res.status(400).send('Invalid request')
        return
    }
    const uuid = req.params.uuid
    if (!isValidUUID(uuid)) {
        res.status(400).send('Invalid request')
        return
    }
    res.render('poll/create', {
        id: uuid
    })
})

async function uploadPollTransaction(db, uuid, userUUID, user_visibility, title, description, options, multipleChoice, start_date, end_date, filter) {
    return new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', function(err) {
            db.run('insert into vote_page(id, created_by, vote_type, title, vote_description, restrict_filter, option_type, compile_start_at, compile_end_at) values(?, ?, ?, ?, ?, ?, ?, ?, ?)', [uuid, userUUID, user_visibility, title, description, filter, multipleChoice, start_date, end_date], function(err) {
                if (err) {
                    console.log(err)
                    db.run('ROLLBACK', function(err) {
                        resolve(null)
                    })
                    return
                }
                var op_insert = []
                var op_list = []
                for (var i = 0; i < options.length; i++) {
                    op_insert.push(`(?, ?, ?)`)
                    op_list.push(uuid, i, options[i])
                }
                op_insert = op_insert.join(',')
                db.run(`insert into vote_option(vote_page_id, option_index, option_text) values ${op_insert}`, op_list, function(err) {
                    if (err) {
                        console.log(err)
                        db.run('ROLLBACK', function(err) {
                            resolve(null)
                        })
                        return
                    }
                    db.run('COMMIT', function(err) {
                        resolve(uuid)
                    })
                })
            })

        })
    })
}

app.post('/poll/create/:uuid', authenticate, renewExpired, pollSanitizer, async (req, res) => {
    if (req.params.uuid == null) {
        res.status(400).send('Invalid request')
        return
    }
    const uuid = req.params.uuid
    if (!isValidUUID(uuid)) {
        res.status(400).send('Invalid request')
        return
    }
    const body = req.body
    const poll_id = req.params.uuid
    let title = body.title
    let description = body.description
    let options = body.options
    let compilation_type = (body.anonymous_compilation == 'on') ? 'anymus' : 'public'
    let multiple_choice = (body.multiple_choice == 'on') ? 'multiple' : 'single'
    let start_date = body.start_date
    let end_date = body.end_date
    const upload = await uploadPollTransaction(Database.database(), poll_id, req.user.id, compilation_type, title, description, options, multiple_choice, start_date, end_date, '{}')
    if (upload == null) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    res.status(201).send('Poll created')
})

app.get('/poll/create', authenticate, async (req, res) => {
    const uuid = uuidv4()
    res.redirect(302, `/poll/create/${uuid}`)
})

app.get('/signup/confirm/:token', (req, res) => {
    const token = req.params.token
    if (token == null) {
        res.status(400).send('Invalid token')
        return
    }
    res.render('confirm', {
        token: token
    })
})

app.post('/signup/confirm', async (req, res) => {
    console.log('confirming email')
    const formBody = req.body
    const token = formBody.token
    const first_name = formBody.first_name
    const last_name = formBody.last_name
    const password = formBody.password
    const confirm_password = formBody.confirm_password
    const email = formBody.email
    if (token == null || first_name == null || last_name == null || password == null || confirm_password == null || email == null) {
        res.status(400).send('All fields are required')
        return
    }
    if (password != confirm_password) {
        res.status(400).send('Passwords do not match')
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
    const hash = crypto.createHash('sha256')
    hash.update(email)
    const email_hash_check = hash.digest('hex')
    if (email_hash != email_hash_check) {
        res.status(400).send('Invalid email')
        return
    }
    const id = uuidv4()
    const query = 'INSERT INTO user_account (id, first_name, last_name, email, hashed_password, password_salt) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    const salt = crypto.randomBytes(11).toString('hex')
    const hashed_password = calculate_hash(password, salt)
    const args = [id, first_name, last_name, email, hashed_password, salt]
    const [err, result] = await Database.query(query, args)
    if (err) {
        console.log(err.message)
        if (err.message.includes('UNIQUE constraint') && err.message.includes('user_account.email')) {
            res.status(400).send('Email already exists')
            return
        }
        res.status(500).send('Service temporarily unavailable')
        return
    }
    res.status(201).send('Account created')


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
if (!process.env.TOKEN_AUD) {
    throw new Error('TOKEN_AUD is not defined in .env file')
}
if (!process.env.TOKEN_ISS) {
    throw new Error('TOKEN_ISS is not defined in .env file')
}
app.listen(port, bound_ip, () => {
    console.log(`Server is running on port ${port}`)
})