const {Database} = require('../utility/db_store')
const {FrontendError} = require('../utility/error')

class Polls {
    static async Get(req, res) {
        const query = req.query
        var query_params = []
        var order_by_list = []
        if (query.hasOwnProperty('active')&&query.active) {
            query_params.push('compile_start_at < datetime("now") AND compile_end_at > datetime("now")')
        }
        if (query.hasOwnProperty('votes_order')&&query.votes_order=='votes_asc') {
            order_by_list.push('votes ASC')
        }
        if (query.hasOwnProperty('votes_order')&&query.votes_order=='votes_desc') {
            order_by_list.push('votes DESC')
        }
        if (query.hasOwnProperty('date_order')&&query.date_order=='date_asc') {
            order_by_list.push('created_at ASC')
        }
        if (query.hasOwnProperty('date_order')&&query.date_order=='date_desc') {
            order_by_list.push('created_at DESC')
        }
        if (query.hasOwnProperty('search')&&query.search) {
            query_params.push(`title LIKE "%${query.search}%" or vote_description LIKE "%${query.search}%"`)
        }

        var order_by = ''
        if (order_by_list.length>0) {
            order_by = 'ORDER BY ' + order_by_list.join(', ')
        }

        var where = 'WHERE suspension_reason IS NULL '
        if (query_params.length>0) {
            where += 'AND ' + query_params.join(' AND ')
        }

        var sql = `
            select 
                vote_page.id as id, 
                title, 
                vote_description, 
                first_name, 
                last_name, 
                count(voter.created_by) as votes, 
                vote_page.created_at as created_at
            from 
                vote_page left join voter on vote_page.id = voter.vote_page_id
                left join user_customer on vote_page.created_by = user_customer.user_id
                inner join user_account on user_customer.user_id = user_account.id and user_account.user_role = user_customer.user_role
            ${where}
            group by vote_page.id
            ${order_by}
        `
        var [err, result] = await Database.query(sql, [])
        if (err) {
            console.log(err)
            return new FrontendError(500, 'Internal Server Error').render(res)
        }
        console.log(result)
        res.status(200).render('poll_list', {
            title: 'Poll List',
            path_active: 'polls',
            role: req.user?.role || 'guest',
            poll_list: result,
            votes_order: query.votes_order || 'none',
            date_order: query.date_order || 'none',
            search: query.search || ''
        })
    }
}

module.exports = {
    Polls: Polls,
}