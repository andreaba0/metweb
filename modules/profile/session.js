const {SessionDatabase} = require('../../utility/db_store')
const uap = require('ua-parser-js')

class Session {
    static async Delete(req, res) {
        const body = req.body
        const sid = body.sid
        let query = '';
        query = `
            delete from user_session
            where sid = ?
            returning sid
        `;
        const [err, result] = await SessionDatabase.query(query, [sid]);
        if (err) {
            return res.status(500).json({error: 'Internal server error'})
        }
        if (result.length === 0) {
            return res.status(404).json({error: 'Session not found'})
        }
        res.status(204).send()
    }
}

module.exports = {
    Session: Session
}