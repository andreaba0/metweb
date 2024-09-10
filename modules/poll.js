const {Cache, CacheHit, CacheMiss, CacheError} = require('../cache')
const {Database} = require('../db_store')
const {FrontendError} = require('../utility/error')
const {CustomDate} = require('../date.js')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')

async function myPolls(req, res) {
    const query = 'SELECT id, title, vote_description, compile_start_at, compile_end_at, available from vote_page where created_by = ?'
    const [err, result] = await Database.query(query, [req.user.id])
    if (err) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    let polls = []
    const today = new Date().getTime()
    for (var i =0;i<result.length;i++) {
        let poll = result[i]
        let start_date = new Date(poll.compile_start_at).getTime()
        let end_date = new Date(poll.compile_end_at).getTime()
        let status = 'Not available'
        if (today >= start_date && today <= end_date) {
            status = 'Available'
        }
        if (today < start_date) {
            status = `Not available till ${new Date(start_date)}`
        }
        if (today > end_date) {
            status = `Not available since ${new Date(end_date)}`
        }
        status = `available from ${new Date(start_date)} to ${new Date(end_date)}`
        polls.push({
            id: poll.id,
            title: poll.title,
            description: poll.vote_description,
            start_date: start_date,
            end_date: end_date,
            status: status,
            available: poll.available
        })
    }
    console.log(polls)
    res.render('poll/list', {
        path_active: 'my_polls',
        role: req.user.role,
        polls: polls
    })
}

async function pollCompile(req, res) {
    const user = req.user
    const user_id = user.id
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
            compile_end_at,
            coalesce((select 1 from voter where voter.voter_id = ? and voter.vote_page_id = vote_page.id), 0) as voted,
            coalesce((select 1 from report where report.created_by = ? and report.vote_page_id = vote_page.id), 0) as reported
        FROM vote_page 
        WHERE id = ?`
    let [err1, result1] = await Database.query(query, [user_id, user_id, id])
    if (err1) {
        console.log(err1)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (result1.length == 0) {
        let err = new FrontendError(404, 'Poll not found')
        err.render(res)
        return
    }
    console.log(result1)
    const poll_page = result1[0]
    if (poll_page.reported == 1) {
        res.status(403).send('This poll has been reported by you, so you cannot compile it')
        return
    }
    if (poll_page.voted == 1) {
        res.status(403).send('You have already voted')
        return
    }
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
    query = `SELECT option_index, option_text FROM vote_option WHERE vote_page_id = ? ORDER BY option_index ASC`
    let [err2, result2] = await Database.query(query, [id])
    if (err2) {
        console.log(err2)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (result2.length == 0) {
        res.status(500).send('Poll may be corrupted')
        return
    }
    console.log(result2)
    var options = []
    for (var i = 0; i < result2.length; i++) {
        options.push({
            index: result2[i].option_index,
            text: result2[i].option_text
        })
    }
    console.log(options)
    res.render('poll/compile', {
        id: id,
        role: req.user.role,
        path_active: 'compile_poll',
        title: poll_page.title,
        description: poll_page.vote_description,
        options: options,
        multiple_choice: (poll_page.option_type == 'multiple') ? true : false
    })
}

async function createPollCompilation(req, res) {
    const body = req.body
    const poll_id = body.poll_id
    const answers = body.answer
    let query_poll_metadata = `
        select vote_type, created_by, available, option_type, compile_start_at, compile_end_at, restrict_filter
        from vote_page
        where id = ?`
    let [err1, result1] = await Database.query(query_poll_metadata, [poll_id])
    if (err1) {
        console.log(err1)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    if (result1.length == 0) {
        res.status(404).send('Poll not found')
        return
    }
    const poll_metadata = result1[0]
    if (poll_metadata.created_by == req.user.id) {
        res.status(403).send('You cannot compile a poll you created')
        return
    }
    if (poll_metadata.available == false) {
        res.status(403).send('This poll has been suspended')
        return
    }
    const validFrom = CustomDate.from_UTC_timestamp(poll_metadata.compile_start_at).getTime()
    const validTo = CustomDate.from_UTC_timestamp(poll_metadata.compile_end_at).getTime()
    const now = new Date().getTime()
    if (now < validFrom) {
        res.status(403).send('Poll is not yet available')
        return
    }
    if (now > validTo) {
        res.status(403).send('Poll is no longer available')
        return
    }
    if (poll_metadata.option_type == 'single' && typeof answers != 'string') {
        res.status(400).send('Invalid answer format')
        return
    }
    if (poll_metadata.option_type == 'multiple' && !Array.isArray(answers) && answers.length == 0) {
        res.status(400).send('Invalid answer format')
        return
    }

    let uploadT = uploadTransaction(
        (typeof answers == 'string') ? [answers] : answers, 
        req.user.id, 
        poll_id, 
        poll_metadata.vote_type
    )
    var [err2, result2] = await Database.run_scoped_transaction(uploadT)
    if (err2) {
        if (err2.message.match(/UNIQUE constraint failed/)) {
            res.status(403).send('You have already voted')
            return
        }
        console.log(err2)
        res.status(500).send('Service temporarily unavailable')
        return
    }
    res.status(204).send('Poll compiled')
}

function uploadTransaction(answers, user_id, poll_id, vote_type) {
    /*
    This transaction run in a new sqlite3 database connection, so it is safe to use with async/await
    */
    return (db) => {
        return new Promise(async (resolve, reject) => {
            let query1 = 'BEGIN TRANSACTION'
            var err = await Database.non_returning_query(db, query1, [])
            if (err) {
                reject(err)
                return
            }
            let query2 = 'INSERT INTO voter(voter_id, vote_page_id) VALUES (?, ?)'
            var err = await Database.non_returning_query(db, query2, [user_id, poll_id])
            if (err) {
                reject(err)
                return
            }
            let query3 = 'INSERT INTO vote(vote_page_id, vote_type, vote_option_index, created_by) VALUES'
            let author = (vote_type == 'anymus') ? null : user_id
            let values = []
            for (let i = 0; i < answers.length; i++) {
                let int_answer = parseInt(answers[i])
                let string_answer = int_answer.toString()
                if (string_answer != answers[i]) {
                    reject(new Error('Invalid answer'))
                    return
                }
                values.push(`("${poll_id}", "${vote_type}", ${int_answer}, "${author}")`)
            }
            query3 += values.join(',')
            var err = await Database.non_returning_query(db, query3, [])
            if (err) {
                reject(err)
                return
            }
            let query4 = 'COMMIT'
            var err = await Database.non_returning_query(db, query4, [])
            if (err) {
                reject(err)
                return
            }
            resolve(1)
        })
    }
}

async function getCreatePoll(req, res) {
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
        id: uuid,
        path_active: 'create_poll'
    })
}

async function postCreatePoll(req, res) {
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
}

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

async function postReport(req, res) {
    const body = req.body
    const poll_id = body.poll_id
    const reason = body.report
    const user_id = req.user.id
    const query = 'INSERT INTO report(vote_page_id, created_by, report_text) VALUES (?, ?, ?)'
    const [err, result] = await Database.query(query, [poll_id, user_id, reason])
    if (err) {
        res.status(500).send('Service temporarily unavailable')
        return
    }
    res.status(204).send('Reported')
}

module.exports = {
    myPolls: myPolls,
    pollCompile: pollCompile,
    createPollCompilation: createPollCompilation,
    getCreatePoll: getCreatePoll,
    postCreatePoll: postCreatePoll,
    postReport: postReport
}