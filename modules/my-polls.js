const {Database} = require('../utility/db_store')
const {FrontendError} = require('../utility/error')
const {Poll} = require('../types/poll')


class MyPolls {
    static async Get(req, res) {
        const fields = Poll.getFieldList()
        const query = `
            SELECT 
                ${fields.join(', ')},
                (
                    select 
                        count(voter.created_by) 
                    from 
                        voter 
                    where 
                        voter.vote_page_id = vote_page.id
                ) as total_voter
            from 
                vote_page 
            where 
                vote_page.created_by = ?
            order by
                vote_page.created_at desc
        `
        const [err, result] = await Database.query(query, [req.user.id])
        if (err) {
            console.log(err)
            res.status(500).send('Service temporarily unavailable')
            return
        }
        let polls = []
        const today = new Date().getTime()
        for (var i =0;i<result.length;i++) {
            let poll = new Poll()
            poll.loadFromDatabaseRow(result[i])
            let status = 'Not available'
            if (poll.isCompilableNow()) {
                status = 'Available'
            }
            const compileStartAt = new Date(poll.getProperty('compile_start_at'))
            const compileEndAt = new Date(poll.getProperty('compile_end_at'))
            const now = new Date()
            if (now < compileStartAt) {
                status = `Not available since ${compileStartAt}`
            }
            if (now > compileEndAt) {
                status = `Not available till ${compileEndAt}`
            }
            status = `available from ${compileStartAt} to ${compileEndAt}`
            polls.push({
                id: poll.getProperty('id'),
                title: poll.getProperty('title'),
                description: poll.getProperty('vote_description'),
                start_date: poll.getProperty('compile_start_at'),
                end_date: poll.getProperty('compile_end_at'),
                status: status,
                available: poll.isSuspended(),
                total_voter: result[i].total_voter
            })
        }
        console.log(polls)
        res.render('poll/list', {
            path_active: 'my_polls',
            role: req.user.role,
            polls: polls
        })
    }
}

module.exports = {
    MyPolls: MyPolls
}