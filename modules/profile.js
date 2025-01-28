const {Database, SessionDatabase} = require('../utility/db_store')
const {FrontendError} = require('../utility/error')
const uap = require('ua-parser-js')

class Profile {
    static async Get(req, res) {
        const id = req.user.id
        let query1 = `
            select 
                id, 
                email, 
                first_name, 
                last_name,
                date_of_birth
            from user_account
            where id = ?
        `;
        let query2 = `
            select
                sid,
                json_extract(sess, '$.metadata.user_agent') as user_agent,
                case sid when ? then 1 else 0 end is_current
            from
                user_session
            where
                json_extract(sess, '$.passport.user.id') = ? 
        `;
       let result = [];
        try {
            result = await Promise.all([
                Database.query(query1, [id]),
                SessionDatabase.query(query2, [req.sessionID, id])
            ])
            if(result[0][0] || result[1][0] || result[0][1].length !== 1) {
                throw new Error(`${result[0][0]} ${result[1][0]}`)
            }

        } catch(e) {
            console.log(e)
            return new FrontendError(500, 'Errore durante il recupero del profilo')
        }
        var sessions = []
        const result2 = result[1][1]
        for (let i = 0; i < result2.length; i++) {
            const ua = uap(result2[i].user_agent)
            sessions.push({
                sid: result2[i].sid,
                user_agent: result2[i].user_agent,
                browser: ua.browser.name,
                os: ua.os.name,
                is_current: result2[i].is_current
            })
        }
        res.render('profile', {
            title: 'Il tuo profilo',
            role: req.user.role,
            path_active: 'profile',
            user: result[0][1][0],
            sessions: sessions
        })
    }

    static async Patch(req, res) {
        const id = req.user.id
        const body = req.body
        const first_name = body.first_name
        const last_name = body.last_name
        if (!first_name || !last_name) {
            return res.status(400).json({error: 'Invalid request'})
        }
        const query = `
            update 
                user_account 
            set 
                first_name = ?, 
                last_name = ?
            where 
                id = ?
        `
        const [err, result] = await Database.query(query, [first_name, last_name, id])
        if (err) {
            return res.status(500).json({error: 'Internal server error'})
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({error: 'User not found'})
        }
        res.status(200).json({message: 'Profile updated'})
    }
}

module.exports = {
    Profile: Profile
}