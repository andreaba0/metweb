const {Database} = require('../../../utility/db_store')
const {FrontendError} = require('../../../utility/error')
const {CustomDate} = require('../../../utility/date')
const {v4: uuidv4} = require('uuid')
const {Poll} = require('../../../types/poll')

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
            let query2 = 'INSERT INTO voter(created_by, vote_page_id) VALUES (?, ?)'
            var err = await Database.non_returning_query(db, query2, [user_id, poll_id])
            if (err) {
                reject(err)
                return
            }
            let query3 = 'INSERT INTO vote(vote_page_id, user_group, vote_type, vote_option_index, created_by) VALUES'
            let author = (vote_type == 'anymus') ? null : `"${user_id}"`
            let values = []
            const user_group = uuidv4() // is used to group a set of votes if poll is anonymous
            for (let i = 0; i < answers.length; i++) {
                let int_answer = parseInt(answers[i])
                let string_answer = int_answer.toString()
                if (string_answer != answers[i]) {
                    reject(new Error('Invalid answer'))
                    return
                }
                values.push(`("${poll_id}", "${user_group}", "${vote_type}", ${int_answer}, ${author})`)
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

class PollCompileId {
    static async Get(req, res) {
        const user = req.user
        const user_id = user.id
        const id = req.params.id
        let query = `
            SELECT 
                ${Poll.getFieldList().join(', ')},
                coalesce((select 1 from voter where voter.created_by = ? and voter.vote_page_id = vote_page.id), 0) as voted,
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
        const poll = new Poll()
        poll.loadFromDatabaseRow(poll_page)
        if (poll_page.reported == 1) {
            const err = new FrontendError(403, 'You cannot compile a poll you reported')
            err.render(res)
            return
        }
        if (poll_page.voted == 1) {
            res.status(403).send('You have already voted')
            return
        }
        if (poll.getProperty('created_by') == user_id) {
            res.status(403).send('You cannot compile a poll you created')
            return
        }
        if (poll.isSuspended()) {
            const err = new FrontendError(403, 'This poll has been suspended')
            err.render(res)
            return
        }
        const now = new Date()
        const compileStartAt = new Date(poll.getProperty('compile_start_at'))
        const compileEndAt = new Date(poll.getProperty('compile_end_at'))
        if (now < compileStartAt) {
            const err = new FrontendError(403, 'Poll is not yet available')
            err.render(res)
            return
        }
        if (compileEndAt < new Date()) {
            const err = new FrontendError(403, 'Poll is no longer available')
            err.render(res)
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
            title: poll.getProperty('title'),
            description: poll.getProperty('vote_description'),
            options: options,
            multiple_choice: (poll.getProperty('option_type') == 'multiple') ? true : false,
            anonymous: (poll.getProperty('vote_type') == 'anymus') ? true : false
        })
    }

    static async Post(req, res) {
        const body = req.body
        const poll_id = body.poll_id
        const answers = body.answer
        const domainFilter = body.domain_filter
        const poll = new Poll()
        await poll.loadFromDatabase(poll_id)
        if (poll.getProperty('created_by') == req.user.id) {
            res.status(403).send('You cannot compile a poll you created')
            return
        }
        if (poll.isSuspended()) {
            res.status(403).send('This poll has been suspended')
            return
        }
        const validFrom = new Date(poll.getProperty('compile_start_at'))
        const validTo = new Date(poll.getProperty('compile_end_at'))
        const now = new Date()
        if (now < validFrom) {
            res.status(403).send('Poll is not yet available')
            return
        }
        if (now > validTo) {
            res.status(403).send('Poll is no longer available')
            return
        }
        if (poll.isSingleChoice() && typeof answers != 'string') {
            res.status(400).send('Invalid answer format')
            return
        }
        if (poll.isMultipleChoice() && !Array.isArray(answers) && answers.length == 0) {
            res.status(400).send('Invalid answer format')
            return
        }

        let uploadT = uploadTransaction(
            (typeof answers == 'string') ? [answers] : answers, 
            req.user.id, 
            poll_id, 
            poll.getProperty('vote_type')
        )
        var [err2, result2] = await Database.run_scoped_transaction(uploadT)
        if (err2) {
            if (err2.message.match(/UNIQUE constraint failed/)) {
                const err = new FrontendError(403, 'You have already voted')
                err.render(res)
                return
            }
            console.log(err2)
            const err = new FrontendError(500, 'Service temporarily unavailable')
            err.render(res)
            return
        }
        res.status(204).send('Poll compiled')
    }
}

module.exports = {
    PollCompileId: PollCompileId
}