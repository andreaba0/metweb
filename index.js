require('dotenv').config()

const port = process.env.PORT
if (port == null || port == "") {
    throw new Error('PORT is not defined in .env file')
}
const data_db_name = process.env.DATA_DB_NAME
if (data_db_name == null || data_db_name == "") {
    throw new Error('DATA_DB_NAME is not defined in .env file')
}
const session_db_name = process.env.SESSION_DB_NAME
if (session_db_name == null || session_db_name == "") {
    throw new Error('SESSION_DB_NAME is not defined in .env file')
}
const session_secret = process.env.SESSION_SECRET
if (session_secret == null || session_secret == "") {
    throw new Error('SESSION_SECRET is not defined in .env file')
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

const express = require('express')
const app = express()

const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session')
const sqliteSession = require('connect-sqlite3')(session)
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const {Cache, CacheHit, CacheMiss, CacheError} = require('./utility/cache')
const {
    authenticate, 
    renewExpired, 
    authorize, 
    localStrategy, 
    serializeUser, 
    deserializeUser, 
    loggedIn, 
    storeMetadata
} = require('./middleware/authenticate')
const {KeyManager, KeySchema, KeyManagerError} = require('./utility/key_rotation')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')
const crypto = require('crypto')
const {Database} = require('./utility/db_store')
const {parseJwt, JwtBadToken} = require('./utility/jwt_utility')
const {CustomDate} = require('./utility/date')
const {pollSanitizer} = require('./middleware/poll_sanitizer')


const {PollCreateUuid} = require('./modules/poll/create/[uuid]')
const {PollVotersId} = require('./modules/poll/voters/[id]')
const {PollId} = require('./modules/poll/[id]')
const {MyPolls} = require('./modules/my-polls')
const {PollCompileId} = require('./modules/poll/compile/[id]')
const {PollReport} = require('./modules/poll/report')
const {Profile} = require('./modules/profile')
const {ReportList} = require('./modules/report/list')
const {Polls} = require('./modules/polls')
const {Signin} = require('./modules/signin')
const {Signup} = require('./modules/signup')
const {SignupConfirmToken} = require('./modules/signup/confirm/[token]')
const {PasswordReset} = require('./modules/reset/[token]')
const {Users} = require('./modules/users')
const {Session} = require('./modules/profile/session')

const { FrontendError } = require('./utility/error')

const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const stream = require('node:stream')
const { Buffer } = require('node:buffer')


app.set('view engine', 'ejs')
app.use('/static', express.static(__dirname + '/static'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(passport.initialize())


// Even if saveUninitialized is set to false, a new useless session record is created
// in the database when a user issues a logout request. This is caused by passportjs logOut method in
// https://github.com/jaredhanson/passport/blob/master/lib/sessionmanager.js
// where a new session is explicitly created causing the express session middleware to create a new session record
// The issue is the following: waste of space in the database for a useless session record
app.use(session({
    secret: session_secret,
    resave: true,
    rolling: true, // renew session expiration on every request
    saveUninitialized: false, // do not store session in DB until a signin is issued
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 21 // 3 weeks
    },
    store: new sqliteSession({
        db: session_db_name,
        dir: './',
        table: 'user_session'
    })
}))
app.use(passport.authenticate('session'))

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, localStrategy))
passport.serializeUser(serializeUser)
passport.deserializeUser(deserializeUser)

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/signup/confirm/:token', SignupConfirmToken.Get)
app.post('/signup/confirm', SignupConfirmToken.Post)
app.get('/signup', Signup.Get)
app.post('/signup', Signup.Post)
app.get('/password/reset/:token', PasswordReset.Get)
app.post('/password/reset/:token', PasswordReset.Post)

app.delete('/profile/session', loggedIn, authorize('*'), Session.Delete)
app.get('/profile', loggedIn, authorize('*'), Profile.Get)
app.patch('/profile', loggedIn, authorize('*'), Profile.Patch)

//app.get('/report/list', authenticate, renewExpired, authorize('admin'), ReportList.Get)
app.get('/report/list', loggedIn, authorize('admin'), ReportList.Get)

app.get('/users', loggedIn, authorize('admin'), Users.Get)

app.get('/confirm', (req, res) => {
    res.sendFile(__dirname + '/views/confirm.html')
})

//app.get('/poll/compile/:id', authenticate, renewExpired, authorize('user'), /*pollCompile*/ PollCompileId.Get)
app.get('/poll/compile/:id', loggedIn, authorize('user'), PollCompileId.Get)

app.post('/poll/compile/:id', loggedIn, authorize('user'), /*createPollCompilation*/ PollCompileId.Post)
app.post('/poll/report', loggedIn, authorize('user'), /*postReport*/ PollReport.Post)

app.get('/signin', Signin.Get)
//app.post('/signin', Signin.Post)
app.post('/signin', Signin.sanitizeSigninData, passport.authenticate('local', {
    //successRedirect: '/profile',
    failureRedirect: '/signin',
    //failureFlash: true
}), storeMetadata, (req, res) => {
    if(req.isAuthenticated()) {
        res.redirect('/profile')
    } else {
        res.redirect('/signin')
    }
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
        if (!(email.email_type === 'verify_email'|| email.email_type === 'reset_password')) {
            return
        }
        const base_uri = `http://${process.env.BOUND_IP}:${process.env.PORT}`
        const body = email.email_type === 'verify_email' ? 
            `<a href="${base_uri}/signup/confirm/${content.token}">Accedi al seguente link per confermare la mail</a>` 
            : 
            `<a href="${base_uri}/password/reset/${content.token}">Accedi al seguente link per cambiare la password</a>`;
        messages.push({
            id: email.id,
            body: body,
        })
    })
    res.render('inbox', {
        messages: messages
    })
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/views/about.html')
})

app.get('/poll/create/:uuid', loggedIn, authorize('user'), PollCreateUuid.Get)

app.post('/poll/create/:uuid', loggedIn, authorize('user'), /*pollSanitizer,*/ PollCreateUuid.Post)
app.delete('/poll/:id', loggedIn, authorize('user'), PollId.Delete)

app.get('/poll/create', loggedIn, authorize('user'), async (req, res) => {
    const uuid = uuidv4()
    res.redirect(302, `/poll/create/${uuid}`)
})

app.get('/poll/voters/:id', loggedIn, authorize('user'), PollVotersId.Get)

app.get('/my-polls', loggedIn, authorize('user'), MyPolls.Get)

app.get('/polls', Polls.Get)

app.get('/poll/:uuid', loggedIn, authorize('*'), (req, res) => {
    res.sendStatus(204)
})

function generateQrCode() {
    return new Promise((resolve, reject) => {
        QRCode.toBuffer('https://example.com/pdf/1', {
            errorCorrectionLevel: 'H',
            scale: 1,
            type: 'png'
        }, (err, buffer) => {
            if (err) {
                reject(err)
            }
            resolve(buffer)
        })
    })
}

app.get('/pdf', async (req, res) => {

    // create a stream to store qrcode
    let qrBuffer = await generateQrCode()
    

    const doc = new PDFDocument({
        autoFirstPage: false,
        info: {
            Title: 'Certificato di votazione',
            Author: 'Andrea Barchietto',
            Subject: 'Certificato di votazione',
            CreationDate: new Date(),
            Keywords: 'voting, certificate, pdf',
            ModDate: new Date()
        }
    })
    doc.pipe(res)
    doc.addPage({
        size: 'A4',
        margins: {
            top: 25,
            bottom: 25,
            left: 25,
            right: 25
        }
    })
    .font('Helvetica')
    .fontSize(25)
    .text('Certificato di votazione', {
        align: 'center'
    })
    .moveDown()
    .fontSize(12)
    .text('Con la presente si certifica che il signor', {
        align: 'center'
    })
    .moveDown(0.5)
    .fontSize(20)
    .text('John Doe', {
        align: 'center',
    })
    .fontSize(12)
    .text('ha effettuato la votazione in data', {
        align: 'center'
    })
    .moveDown(0.5)
    .font('fonts/SourceCodePro-Regular.ttf')
    .fontSize(15)
    .text('01/09/2024', {
        align: 'center'
    })
    .fontSize(10)
    .text('Le date sono espresse nel formato: dd/mm/yyyy', 50, 11.7*72-60)
    .font('Helvetica')
    .image('data:image/png;base64,' + qrBuffer.toString('base64'), 298.8-100, 400, {
        fit: [200, 200],
        align: 'center',
        valign: 'center'
    })
    doc.end()
})

async function logout(req) {
    return new Promise((resolve, reject) => {
        req.logout((err) => {
            if (err) {
                console.log(err)
                reject(err)
            }
            resolve()
        })
    })
}

app.post('/logout', loggedIn, async (req, res) => {
    try {
        console.log('logging out')
        await logout(req)
        res.redirect('/signin')
    } catch (err) {
        res.status(500).send('Service temporarily unavailable')
    }
})

app.get('*', (req, res) => {
    const frontendError = new FrontendError(404, 'Page not found')
    frontendError.render(res)
})

app.listen(port, bound_ip, () => {
    console.log(`Server is running on port ${port}`)
})