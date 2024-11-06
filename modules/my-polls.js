const {Database} = require('../utility/db_store')
const {FrontendError} = require('../utility/error')


class MyPolls {
    static async Get(req, res) {
        const query = `
            SELECT 
                id, 
                title, 
                vote_description, 
                compile_start_at, 
                compile_end_at, 
                available,
                (select count(distinct voter.voter_id) from voter where voter.vote_page_id = vote_page.id) as total_voter
            from 
                vote_page 
            where 
                created_by = ?
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
                available: poll.available,
                total_voter: poll.total_voter
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