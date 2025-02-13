const {Database} = require('../../../utility/db_store')
const {FrontendError} = require('../../../utility/error')
const {Poll} = require('../../../types/poll')

class PollVotersId {
    static async Get(req, res) {
        const poll_id = req.params.id
        const poll = new Poll()
        try {
            await poll.loadFromDatabase(poll_id)
            await poll.loadOptionsFromDatabase()
        } catch(e) {
            const page = new FrontendError(500, 'Database error')
            page.render(res)
            return
        }
        if(poll.getProperty('created_by') != req.user.id) {
            const page = new FrontendError(403, 'You are not the author of this poll')
            page.render(res)
            return
        }
        if(poll.isSuspended()) {
            const page = new FrontendError(403, 'This poll has been suspended')
            page.render(res)
            return
        }
        var query = '';
        var params = [];

        if(poll.isAnonymouslyCompilable()) {
            query = `
                select
                    concat(user_account.first_name, ' ', user_account.last_name) as created_by
                from
                    voter
                    inner join
                    user_account
                    on
                        voter.created_by = user_account.id
                where
                    vote_page_id = ?
            `
            params = [poll_id]
        } else {
            // in this case, the compilation of the poll is public
            // so, the author can see who voted what
            query = `
                select
                    group_concat(vote_option_index) as answers,
                    concat(user_account.first_name, ' ', user_account.last_name) as created_by,
                    user_group
                from
                    vote
                    inner join
                    user_account
                    on
                        vote.created_by = user_account.id
                where
                    vote_page_id = ?
                group by
                    created_by
            `
            params = [poll_id]
        }

        var [err, result] = await Database.query(query, params)
        if (err) {
            console.log(err)
            const page = new FrontendError(500, 'Database error')
            page.render(res)
            return
        }

        if(!poll.isAnonymouslyCompilable()) {
            for(var i=0;i<result.length;i++) {
                result[i].answers = result[i].answers.split(',')
            }
        }

        res.status(200).render('poll/voters', {
            title: 'Lista dei votanti',
            path_active: 'voters',
            role: req.user.role,
            votes: result,
            is_anonymous: poll.isAnonymouslyCompilable(),
            options_number: poll.getOptionsLength(),
            options: poll.getOrderedOptions()
        })
    }
}

module.exports = {
    PollVotersId: PollVotersId
}