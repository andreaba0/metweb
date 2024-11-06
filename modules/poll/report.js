const {Database} = require('../../utility/db_store')

class PollReport {
    static async Post(req, res) {
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
}

module.exports = {
    PollReport: PollReport
}