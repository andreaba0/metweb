const {Database} = require('../../../utility/db_store')
const {Poll} = require('../../../types/poll')
const {FrontendError} = require('../../../utility/error')

class PollStatsId {
    static async Get(req, res) {
        const id = req.params.id
        var query;

        const poll = new Poll()
        try {
            await poll.loadFromDatabase(id)
            await poll.loadOptionsFromDatabase()
        } catch(e) {
            console.log(e)
            return new FrontendError(404, 'Poll not found').render(res)
        }

        const userAuthenticated = req.isAuthenticated()

        if(!poll.statsArePublicyAvailable()&&!userAuthenticated) {
            return new FrontendError(403, 'Stats for this poll are not public').render(res)
        }
        if(!poll.statsArePublicyAvailable()&&userAuthenticated&&req.user.id!=poll.getProperty('created_by')) {
            return new FrontendError(403, 'Stats for this poll are not public').render(res)
        }

        query = `
            select
                coalesce(count(vote.vote_id), 0) as votes,
                vote_option.option_index,
                (
                    select
                        count(created_by)
                    from
                        voter
                    where
                        vote_page_id = ?
                ) as total_votes
            from
                vote_option
                left join
                vote
                on vote_option.option_index = vote.vote_option_index and vote.vote_page_id = vote_option.vote_page_id
            where
                vote_option.vote_page_id = ?
            group by
                vote_option.option_index
            order by
                vote_option.option_index
        `
        var [err1, rows1] = await Database.query(query, [id, id])
        if (err1) {
            console.log(err1)
            return new FrontendError(500, 'Internal Server Error').render(res)
        }

        const options = poll.getOrderedOptions()

        query = `
            select 
                gender,
                count(user_account.id) as votes
            from
                voter
                inner join
                user_account
                on voter.created_by = user_account.id
            where
                vote_page_id = ?
            group by
                gender
        `
        var [err2, rows2] = await Database.query(query, [id])
        if (err2) {
            console.log(err2)
            return new FrontendError(500, 'Internal Server Error').render(res)
        }

        //query votes per 20 minutes interval
        query = `
            select
                strftime('%H', vote.created_at) as vote_time,
                count(distinct vote.user_group) as votes
            from
                vote
            where
                vote_page_id = ?
            group by
                strftime('%H', vote.created_at)
            order by
                strftime('%H', vote.created_at)
        `
        var [err3, rows3] = await Database.query(query, [id])
        if (err3) {
            console.log(err3)
            return new FrontendError(500, 'Internal Server Error').render(res)
        }


        var statsAnswerForEachOption = []
        for (let i = 0; i < options.length; i++) {
            statsAnswerForEachOption.push({
                option_index: i,
                option_text: poll.options[i].vote_option_text,
                votes: rows1[i].votes,
                total_votes: rows1[i].total_votes,
                percentage: parseInt((rows1[i].votes / rows1[i].total_votes) * 100)
            })
        }
        

        res.status(200).render('poll/stats', {
            title: 'Statistiche',
            path_active: 'poll/stats',
            role: req.user?.role || 'guest',
            statsAnswerForEachOption: statsAnswerForEachOption,
            statsPerGender: rows2,
            statsPerTime: rows3
        })
    }
}

module.exports = {
    PollStatsId: PollStatsId
}