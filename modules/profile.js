const {Database, SessionDatabase} = require('../utility/db_store')
const uap = require('ua-parser-js')

class Profile {
    static async Get(req, res) {
        const id = req.user.id
        let query = '';
        query = `
            select 
                id, 
                email, 
                first_name, 
                last_name,
                date_of_birth
            from user_account
            where id = ?
        `;
        const [err, result] = await Database.query(query, [id]);
        if (err) {
            return res.status(500).json({error: 'Internal server error'})
        }
        if (result.length === 0) {
            return res.status(404).json({error: 'User not found'})
        }
        query = `
            select
                sid,
                json_extract(sess, '$.metadata.user_agent') as user_agent
            from
                user_session
            where
                json_extract(sess, '$.passport.user.id') = ?
                and
                sid != ?  
        `
        const [err2, result2] = await SessionDatabase.query(query, [id, req.sessionID])
        if (err2) {
            return res.status(500).json({error: 'Internal server error'})
        }
        var sessions = []
        for (let i = 0; i < result2.length; i++) {
            const ua = uap(result2[i].user_agent)
            sessions.push({
                sid: result2[i].sid,
                user_agent: result2[i].user_agent,
                browser: ua.browser.name,
                os: ua.os.name
            })
        }
        console.log(sessions)
        res.render('profile', {
            title: 'Il tuo profilo',
            role: req.user.role,
            path_active: 'profile',
            user: result[0],
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