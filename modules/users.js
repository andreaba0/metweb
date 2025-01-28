const {Database} = require('../utility/db_store')
const util = require('node:util')
const {FrontendError} = require('../utility/error')

class Users {
    static async Get(req, res) {
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
        `, [])
        if (err) {
            throw new FrontendError(500, 'Errore durante il recupero degli utenti')
        }

        res.render('admin/users', {
            title: 'Lista degli utenti',
            path_active: 'users',
            role: req.user.role,
            users: rows
        })
    }
}

module.exports = {
    Users: Users
}