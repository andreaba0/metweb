const {Database} = require('../../utility/db_store')
const {FrontendError} = require('../../utility/error')

class ApiUsers {
    static async Get(req, res) {
        if(!req.query.page) {
            res.status(400).send('Page is required')
            return
        }
        const page = req.query.page
        let [err, rows] = await Database.query(`
            select
                id,
                first_name,
                last_name,
                email,
                date_of_birth
            from
                user_account
            where
                user_role='usr'
            limit 10 offset ?
        `, [(page) * 10])
        if (err) {
            res.status(500).send('Errore durante il recupero degli utenti')
        }

        res.json({
            page_size: 10,
            users: rows
        })
    }
}

module.exports = {
    ApiUsers: ApiUsers
}