const {Database} = require('../../utility/db_store')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')


class PollId {
    static async Delete(req, res) {
        const poll_id = req.params.id
        const user_id = req.user.id
        if (!isValidUUID(poll_id)) {
            res.status(400).send('Invalid request')
            return
        }

        const query = `
            DELETE FROM vote_page WHERE id = ? AND created_by = ?
        `
        const [err, result] = await Database.query(query, [poll_id, user_id])
        if (err) {
            console.log(err)
            res.status(500).send('Service temporarily unavailable')
            return
        }
        res.status(204).send('Deleted')
    }
}

module.exports = {
    PollId: PollId
}