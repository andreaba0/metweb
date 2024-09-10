const {Cache, CacheHit, CacheMiss, CacheError} = require('../cache')
const {Database} = require('../db_store')
const {FrontendError} = require('../utility/error')

async function pollList(req, res) {
    const query = req.query
    var query_params = []
    var order_by_list = []
    if (query.hasOwnProperty('active')&&query.active) {
        query_params.push('compile_start_at < datetime("now") AND compile_end_at > datetime("now")')
    }
    if (query.hasOwnProperty('votes')&&query.votes=='asc') {
        order_by_list.push('votes ASC')
    }
    if (query.hasOwnProperty('votes')&&query.votes=='desc') {
        order_by_list.push('votes DESC')
    }
    if (query.hasOwnProperty('created')&&query.created=='asc') {
        order_by_list.push('created_at ASC')
    }
    if (query.hasOwnProperty('created')&&query.created=='desc') {
        order_by_list.push('created_at DESC')
    }

    var order_by = ''
    if (order_by_list.length>0) {
        order_by = 'ORDER BY ' + order_by_list.join(', ')
    }

    var where = 'WHERE available = 1 '
    if (query_params.length>0) {
        where += 'AND ' + query_params.join(' AND ')
    }

    var sql = `
        select vote_page.id, title, vote_description, first_name, last_name, count(voter_id) as votes, vote_page.created_at
        from vote_page left join voter on vote_page.id = voter.vote_page_id
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
    res.status(200).render('poll_list', {
        role: req.session.user_role,
        title: 'Poll List',
        path_active: 'polls',
        poll_list: result
    })
}

module.exports = {
    pollList: pollList
}