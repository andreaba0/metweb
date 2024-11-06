const express = require('express')
require('dotenv').config()
const app = express()
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const {Cache, CacheHit, CacheMiss, CacheError} = require('./utility/cache')
const {authenticate, renewExpired, authorize} = require('./middleware/authenticate')
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


const { FrontendError } = require('./utility/error')

app.set('view engine', 'ejs')
app.use('/static', express.static(__dirname + '/static'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/signup', Signup.Get)
app.post('/signup', Signup.Post)

app.get('/profile', authenticate, renewExpired, authorize('*'), Profile.Get)
app.post('/profile', authenticate, renewExpired, authorize('*'), Profile.Post)

app.get('/report/list', authenticate, renewExpired, authorize('admin'), ReportList.Get)

app.get('/users', authenticate, renewExpired, authorize('admin'), async (req, res) => {
    res.status(200).render('users', {
        title: 'Lista utenti',
        role: req.user.role,
        path_active: 'users'
    })
})

app.get('/confirm', (req, res) => {
    res.sendFile(__dirname + '/views/confirm.html')
})

app.get('/poll/compile/:id', authenticate, renewExpired, authorize('user'), /*pollCompile*/ PollCompileId.Get)
app.post('/poll/compile/:id', authenticate, renewExpired, authorize('user'), /*createPollCompilation*/ PollCompileId.Post)
app.post('/poll/report', authenticate, renewExpired, authorize('user'), /*postReport*/ PollReport.Post)

app.get('/signin', Signin.Get)
app.post('/signin', Signin.Post)

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

app.get('/poll/create/:uuid', authenticate, renewExpired, authorize('user'), PollCreateUuid.Get)

app.post('/poll/create/:uuid', authenticate, renewExpired, authorize('user'), /*pollSanitizer,*/ PollCreateUuid.Post)
app.delete('/poll/:id', authenticate, renewExpired, authorize('user'), PollId.Delete)

app.get('/poll/create', authenticate, renewExpired, authorize('user'), async (req, res) => {
    const uuid = uuidv4()
    res.redirect(302, `/poll/create/${uuid}`)
})

app.get('/poll/voters/:id', authenticate, renewExpired, authorize('user'), PollVotersId.Get)

app.get('/signup/confirm/:token', SignupConfirmToken.Get)

app.post('/signup/confirm/:token', SignupConfirmToken.Post)

app.post('/logout', authenticate, (req, res) => {
    res.clearCookie('token')
    res.status(200).sendFile(__dirname + '/views/signin.html')
})

app.get('/my-polls', authenticate, renewExpired, authorize('user'), MyPolls.Get)

app.get('/polls', Polls.Get)

app.get('/poll/:uuid', authenticate, renewExpired, authorize('*'), (req, res) => {
    res.sendStatus(204)
})

app.get('*', (req, res) => {
    const frontendError = new FrontendError(404, 'Page not found')
    frontendError.render(res)
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