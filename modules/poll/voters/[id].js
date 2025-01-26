const {Database} = require('../../../utility/db_store')
const {FrontendError} = require('../../../utility/error')

class PollVotersId {
    static async Get(req, res) {
        const poll_id = req.params.id
        const poll_data_sql = `
            select
                vote_type,
                available
            from
                vote_page
            where
                id = ? and created_by = ?
        `
        var [err, result] = await Database.query(poll_data_sql, [poll_id, req.user.id])
        if (err) {
            const page = new FrontendError(500, 'Database error')
            page.render(res)
            return
        }
        if (result.length == 0) {
            const page = new FrontendError(404, 'Poll not found')
            page.render(res)
            return
        }
        const poll_data = result[0]
        const sql = `
            select
                vote.vote_page_id as poll_id,
                option_text as answer,
                coalesce(user_account.first_name, '') as first_name,
                coalesce(user_account.last_name, '') as last_name,
                created_by
            from
                vote 
                    inner join 
                vote_option 
                    on 
                        vote.vote_option_index = vote_option.option_index and 
                        vote.vote_page_id = vote_option.vote_page_id
                    left join
                user_account
                    on
                        vote.created_by = user_account.id
            where
                vote.vote_page_id = ?
        `
        var [err, result] = await Database.query(sql, [poll_id])
        if (err) {
            console.log(err)
            const page = new FrontendError(500, 'Database error')
            page.render(res)
            return
        }
        var votes = []
        var voters = {}
        console.log(result)
        for (var i = 0; i < result.length; i++) {
            if (poll_data.vote_type == 'anymus') {
                votes.push({
                    poll_id: result[i].poll_id,
                    answer: [result[i].answer],
                    created_by: 'anonymous'
                })
                continue
            }
            if (poll_data.vote_type == 'public') {
                if (voters[result[i].created_by] == null) {
                    voters[result[i].created_by] = {
                        first_name: result[i].first_name,
                        last_name: result[i].last_name,
                        answers: []
                    }
                }
                voters[result[i].created_by].answers.push(result[i].answer)
            }
        }
        if (poll_data.vote_type == 'public') {
            for (var key in voters) {
                votes.push({
                    poll_id: poll_id,
                    created_by: key,
                    first_name: (voters[key].first_name == '') ? 'anonymous' : voters[key].first_name,
                    last_name: (voters[key].last_name == '') ? 'anonymous' : voters[key].last_name,
                    answers: voters[key].answers
                })
            }
        }
        console.log(result)
        console.log(voters)
        console.log(votes)
        res.status(200).render('poll/voters', {
            title: 'Voters',
            path_active: 'voters',
            role: req.user.role,
            votes: votes,
            vote_type: poll_data.vote_type
        })
    }
}

module.exports = {
    PollVotersId: PollVotersId
}