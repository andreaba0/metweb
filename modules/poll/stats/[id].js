class PollStatsId {
    static async Get(req, res) {

        const user = req.user

        res.render('poll/stats', {
            title: 'Statistiche',
            //path_active: 'report_poll',
            //role: req.user?.role || 'guest',
        })
    }
}

module.exports = {
    PollStatsId: PollStatsId
}