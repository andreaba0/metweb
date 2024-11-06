const {Database} = require('../../../utility/db_store')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')


async function uploadPollTransaction(db, uuid, userUUID, user_visibility, title, description, options, multipleChoice, start_date, end_date, filter) {
    return new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', function(err) {
            db.run('insert into vote_page(id, created_by, vote_type, title, vote_description, restrict_filter, option_type, compile_start_at, compile_end_at) values(?, ?, ?, ?, ?, ?, ?, ?, ?)', [uuid, userUUID, user_visibility, title, description, filter, multipleChoice, start_date, end_date], function(err) {
                if (err) {
                    console.log(err)
                    db.run('ROLLBACK', function(err) {
                        resolve(null)
                    })
                    return
                }
                var op_insert = []
                var op_list = []
                for (var i = 0; i < options.length; i++) {
                    op_insert.push(`(?, ?, ?)`)
                    op_list.push(uuid, i, options[i])
                }
                op_insert = op_insert.join(',')
                db.run(`insert into vote_option(vote_page_id, option_index, option_text) values ${op_insert}`, op_list, function(err) {
                    if (err) {
                        console.log(err)
                        db.run('ROLLBACK', function(err) {
                            resolve(null)
                        })
                        return
                    }
                    db.run('COMMIT', function(err) {
                        resolve(uuid)
                    })
                })
            })

        })
    })
}



class PollCreateUuid {
    static Get(req, res) {
        if (req.params.uuid == null) {
            res.status(400).send('Invalid request')
            return
        }
        const uuid = req.params.uuid
        if (!isValidUUID(uuid)) {
            res.status(400).send('Invalid request')
            return
        }
        res.render('poll/create', {
            id: uuid,
            path_active: 'create_poll',
            role: req.user.role
        })
    }

    static async Post(req, res) {
        if (req.params.uuid == null) {
            res.status(400).send('Invalid request')
            return
        }
        const uuid = req.params.uuid
        if (!isValidUUID(uuid)) {
            res.status(400).render('/poll/create')
            return
        }
        const body = req.body
        const poll_id = req.params.uuid
        var error = null
        let title = body.title
        if (title == null || title.length == 0) error = 'Title is required'
        let description = body.description
        if (description == null || description.length == 0) error = 'Description is required'
        let options = body.options
        if (options == null || options.length == 0) error = 'Options are required'
        let compilation_type = (body.anonymous_compilation == 'on') ? 'anymus' : 'public'
        let multiple_choice = (body.multiple_choice == 'on') ? 'multiple' : 'single'
        let adult_restrict = (body.adult_restrict == 'on') ? 'adult' : 'all'
        let start_date = body.start_date
        if (start_date == null) error = 'Start date is required'
        let end_date = body.end_date
        if (end_date == null) error = 'End date is required'
        if (error != null) {
            res.status(400).render('poll/create', {
                id: poll_id,
                error: error,
                path_active: 'create_poll',
                role: req.user.role,
                old: {...body}
            })
            return
        }
        const upload = await uploadPollTransaction(Database.database(), poll_id, req.user.id, compilation_type, title, description, options, multiple_choice, start_date, end_date, '{}')
        if (upload == null) {
            res.status(500).render('poll/create', {
                id: poll_id,
                error: 'Service temporarily unavailable',
                path_active: 'create_poll',
                role: req.user.role,
                old: {...body}
            })
            return
        }
        res.redirect(302, '/polls/my_polls')
    }

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
    PollCreateUuid: PollCreateUuid
}