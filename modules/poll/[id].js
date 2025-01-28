const {Database} = require('../../utility/db_store')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')

// This is not a true transaction, it is used just to open a dedicated db connection to run PRAGMA foreign_keys = ON
function deletePollTransaction(poll_id, user_id) {
    return (db) => {
        return new Promise(async (resolve, reject) => {
            let err;

            // enforce foreign key on this connection
            var [_, rows] = await Database.query(db, 'PRAGMA foreign_keys = ON', [])
            if (_) {
                reject(_)
                return
            }
            console.log(rows)
            err = await Database.non_returning_query(db, 'delete from vote_page where id = ? and created_by = ?', [poll_id, user_id])
            if (err) {
                reject(err)
                return
            }
            resolve(1)
        })
    }
}

class PollId {
    static async Delete(req, res) {
        const poll_id = req.params.id
        const user_id = req.user.id
        if (!isValidUUID(poll_id)) {
            res.status(400).send('Invalid request')
            return
        }

        let deleteT = deletePollTransaction(poll_id, user_id)
        var [err, deleteRes] = await Database.run_scoped_transaction(deleteT)
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