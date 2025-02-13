const {Database} = require('../../../utility/db_store')
const {FrontendError} = require('../../../utility/error')
const {Poll} = require('../../../types/poll')

function approveSuspensionTransaction(id, reason, status) {
    return (db) => {
        return new Promise(async (resolve, reject) => {
            var query;
            var errPragma = await Database.non_returning_query(db, 'PRAGMA foreign_keys = ON', [])
            if (errPragma) {
                reject(errPragma)
                return
            }
            var errBegin = await Database.non_returning_query(db, 'BEGIN TRANSACTION', [])
            if (errBegin) {
                reject(errBegin)
                return
            }
            query = `
                update vote_page
                set suspension_reason = ?
                where id = ?
            `
            var err = await Database.non_returning_query(db, query, [reason, id])
            if (err) {
                reject(err)
                return
            }
            query = `
                update report
                set approved = ?
                where vote_page_id = ?
            `
            var err = await Database.non_returning_query(db, query, [status, id])
            if (err) {
                reject(err)
                return
            }
            var errCommit = await Database.non_returning_query(db, 'COMMIT', [])
            if (errCommit) {
                reject(errCommit)
                return
            }
            resolve(1)
        })
    }
}

class PollReportId {
    static async Get(req, res) {
        const id = req.params.id
        const poll = new Poll()
        try {
            await poll.loadFromDatabase(id)
            await poll.loadOptionsFromDatabase()
        } catch(e) {
            const err = new FrontendError(404, 'Poll not found')
            err.render(res)
            return
        }
        const poll_report_query = `
            select 
                report_text
            from
                report
            where
                vote_page_id = ? and approved = 'p'
        `
        const [err_poll_report, poll_report] = await Database.query(poll_report_query, [id])
        if (err_poll_report) {
            const err = new FrontendError(500, 'Maybe this is a server error')
            err.render(res)
            return
        }
        if(poll_report.length==0) {
            res.redirect('/report/list')
            return
        }
        res.status(200).render('poll/report/[id]', {
            id: id,
            title: 'Report Poll',
            path_active: 'report_poll',
            role: req.user.role,
            poll_info: {
                title: poll.getProperty('title'),
                vote_description: poll.getProperty('vote_description'),
            },
            poll_options: poll.getOrderedOptions(),
            poll_reports: poll_report
        })
    }

    static async Post(req, res) {
        const id = req.params.id
        const body = req.body
        const request_action = body.request_action
        const block_reason = body.block_reason
        if(!request_action||(request_action&&!block_reason)) {
            res.status(400).send('Bad Request')
        }
        var poll = new Poll()
        try {
            await poll.loadFromDatabase(id)
        } catch(e) {
            res.status(404).send('Poll not found')
            return
        }
        const block_poll_query = `
            update
                vote_page
            set
                available = false
            where
                id = ?
        `

        const approved = (request_action=='approve') ? 'y' : 'r'
        const reason = (request_action=='approve') ? block_reason : null

        const updateT = approveSuspensionTransaction(id, reason, approved)
        const [err, result] = await Database.run_scoped_transaction(updateT)
        if (err) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        res.status(204).send('Approved')
    }
}

module.exports = {
    PollReportId: PollReportId
}