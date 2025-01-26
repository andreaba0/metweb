const {Database} = require('../../../utility/db_store')
const {FrontendError} = require('../../../utility/error')

class PollReportId {
    static async Get(req, res) {
        const id = req.params.id
        const poll_info_query = `
            select 
                title, vote_description
            from
                vote_page
            where
                id = ?
        `
        const [err_poll_info, poll_info] = await Database.query(poll_info_query, [id])
        if (err_poll_info) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        if (poll_info.length == 0) {
            const err = new FrontendError(403, 'Poll not found')
            err.render(res)
        }
        const poll_options_query = `
            select 
                option_text
            from
                vote_option
            where
                vote_page_id = ?
        `
        const [err_poll_options, poll_options] = await Database.query(poll_options_query, [id])
        if (err_poll_options) {
            res.status(500).send('Service temporarily unavailable')
            return
        }
        const poll_report_query = `
            select 
                report_text
            from
                report
            where
                vote_page_id = ?
        `
        const [err_poll_report, poll_report] = await Database.query(poll_report_query, [id])
        if (err_poll_report) {
            const err = new FrontendError(500, 'Maybe this is a server error')
            err.render(res)
            return
        }
        res.status(200).render('poll/report/[id]', {
            id: id,
            title: 'Report Poll',
            path_active: 'report_poll',
            role: req.user.role,
            poll_info: poll_info[0],
            poll_options: poll_options,
            poll_reports: poll_report
        })
    }

    static async Post(req, res) {
        const id = req.params.id
        const block_poll_query = `
            update
                vote_page
            set
                available = false
            where
                id = ?
        `
        const [err_block_poll, _1] = await Database.query(block_poll_query, [id])
        if (err_block_poll) {
            const err = new FrontendError(500, 'Maybe this is a server error')
            err.render(res)
            return
        }

        const update_report_query = `
            update
                report
            set
                approved = 'y'
            where
                vote_page_id = ?
        `
        const [err_update_report, _2] = await Database.query(update_report_query, [id])
        if (err_update_report) {
            const err = new FrontendError(500, 'Maybe this is a server error')
            err.render(res)
            return
        }
        res.redirect('/report/list')
    }

    static async Delete(req, res) {
        const id = req.params.id
        const delete_report_query = `
            delete from
                report
            where
                vote_page_id = ?
            returning count(*) as count
        `
        const [err_delete_report, rows_affected] = await Database.query(delete_report_query, [id])
        if (err_delete_report) {
            const err = new FrontendError(500, 'Maybe this is a server error')
            err.render(res)
            return
        }
        if (rows_affected[0].count == 0) {
            const err = new FrontendError(403, 'This poll has no report. Maybe it does not exist?')
            err.render(res)
            return
        }
        res.status(204).send('Deleted')
    }
}

module.exports = {
    PollReportId: PollReportId
}