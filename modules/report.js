const {Cache, CacheHit, CacheMiss, CacheError} = require('../cache')
const {Database} = require('../db_store')
const {FrontendError} = require('../utility/error')
const {CustomDate} = require('../date.js')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')

async function getReportList(req, res) {
    const query = req.query
    var sql = `
        select 
            vote_page_id as id, 
            count(vote_page_id) as report_count 
        from 
            report 
        where
            approved = 'p'
        group by 
            vote_page_id
        order by 
            created_at desc
    `
    var [err, result] = await Database.query(sql, [])
    if (err) {
        console.log(err)
        let page = new FrontendError(500, 'Database error')
        page.render(res)
        return
    }
    console.log(result)
    res.status(200).render('poll/report', {
        title: 'Report List',
        path_active: 'report_list',
        role: req.user.role,
        reports: result
    })
}

module.exports = {
    getReportList: getReportList,
}