const {Database} = require('../../../utility/db_store')
const {Poll} = require('../../../types/poll')
const {FrontendError} = require('../../../utility/error')

class PollStatsId {
    static async Get(req, res) {
        const id = req.params.id

        const poll = new Poll()
        try {
            await poll.loadFromDatabase(id)
            await poll.loadOptionsFromDatabase()
        } catch(e) {
            console.log(e)
            return new FrontendError(404, 'Poll not found').render(res)
        }

        if(!poll.statsArePublicyAvailable()&&!req.isAuthenticated()) {
            return new FrontendError(403, 'Stats for this poll are not public').render(res)
        }

        var query = `
            select
                count(vote.vote_id) as votes,
                vote.vote_option_index,
                (
                    select
                        count(created_by)
                    from
                        voter
                    where
                        vote_page_id = ?
                ) as total_votes
            from
                vote
            where
                vote.vote_page_id = ?
            group by
                vote.vote_option_index
            order by
                vote.vote_option_index
        `
        var [err1, rows1] = await Database.query(query, [id, id])
        if (err1) {
            console.log(err1)
            return new FrontendError(500, 'Internal Server Error').render(res)
        }

        const options = poll.getOrderedOptions()


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
            statsAnswerForEachOption: statsAnswerForEachOption
        })
    }
}

module.exports = {
    PollStatsId: PollStatsId
}