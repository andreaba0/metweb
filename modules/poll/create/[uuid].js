const {Database} = require('../../../utility/db_store')
const {v4: uuidv4, validate: isValidUUID} = require('uuid')
const {Filter} = require('../../../utility/filter')
const {CustomDate} = require('../../../utility/date')

function uploadPollTransaction(uuid, userUUID, user_visibility, title, description, options, multipleChoice, start_date, end_date, filter, public_stats) {
    return (db) => {
        return new Promise(async (resolve, reject) => {
            var err;
            err = await Database.non_returning_query(db, 'BEGIN TRANSACTION', [])
            if (err) {
                reject(err)
                return
            }
            err = await Database.non_returning_query(db, `
                insert into vote_page(
                    id, 
                    public_stats, 
                    created_by, 
                    vote_type, 
                    title, 
                    vote_description, 
                    restrict_filter, 
                    option_type, 
                    compile_start_at, 
                    compile_end_at
                ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [
                uuid, 
                public_stats, 
                userUUID, 
                user_visibility, 
                title, 
                description, 
                filter, 
                multipleChoice, 
                start_date, 
                end_date
            ])
            if (err) {
                console.log(1, err)
                reject(err)
                return
            }
            var op_insert = []
            var op_list = []
            for (var i = 0; i < options.length; i++) {
                op_insert.push(`(?, ?, ?)`)
                op_list.push(uuid, i, options[i])
            }
            op_insert = op_insert.join(',')
            err = await Database.non_returning_query(db, `
                insert into vote_option(
                    vote_page_id, 
                    option_index, 
                    option_text
                ) values ${op_insert}`, 
            op_list)
            if (err) {
                console.log(2, err)
                reject(err)
                return
            }
            err = await Database.non_returning_query(db, 'COMMIT', [])
            if (err) {
                reject(err)
                return
            }
            resolve(1)
        })
    }
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
        console.log(req.body)
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
        let domain_filter = body.domain_filter
        let allowed_domains = []
        allowed_domains = Filter.parse(domain_filter)
        let public_stats = (body.public_stats == 'on') ? true : false
        if (error != null) {
            console.log(error)
            res.status(400).render('poll/create', {
                id: poll_id,
                error: error,
                path_active: 'create_poll',
                role: req.user.role,
                old: {...body}
            })
            return
        }
        let uploadT = uploadPollTransaction(poll_id, req.user.id, compilation_type, title, description, options, multiple_choice, start_date, end_date, JSON.stringify({allowed_domains: allowed_domains}), public_stats)
        //const upload = await uploadPollTransaction(Database.database(), poll_id, req.user.id, compilation_type, title, description, options, multiple_choice, start_date, end_date, JSON.stringify({allowed_domains: allowed_domains}), public_stats)
        var [err, upload] = await Database.run_scoped_transaction(uploadT)
        if (err) {
            console.log(err)
            res.status(500).render('poll/create', {
                id: poll_id,
                error: 'Service temporarily unavailable',
                path_active: 'create_poll',
                role: req.user.role,
                old: {...body}
            })
            return
        }
        res.redirect(302, '/my-polls')
    }
}

module.exports = {
    PollCreateUuid: PollCreateUuid
}