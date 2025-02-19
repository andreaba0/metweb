const {Database, SessionDatabase} = require('../../../../utility/db_store')
const {CustomDate} = require('../../../../utility/date')
const ulid = require('ulid')
const validator = require('validator')

class ApiUserSuspendUuid {
    static async Post(req, res) {
        let errors = []

        const body = req.body
        const reason = body.reason
        const date_start = body.start_date
        const date_end = body.end_date
        const user_id = req.params.uuid
        const suspensionUlid = ulid.ulid()

        if(!reason) {
            errors.push({
                field: 'reason',
                message: 'Motivo obbligatorio'
            })
        }
        if(!date_start) {
            errors.push({
                field: 'start_date',
                message: 'Data inizio obbligatoria'
            })
        }
        if(!date_end) {
            errors.push({
                field: 'end_date',
                message: 'Data fine obbligatoria'
            })
        }
        if(errors.length > 0) {
            res.status(400).json(errors)
            return
        }
        if(!validator.isUUID(user_id)) {
            errors.push({
                field: 'user_id',
                message: 'User id non valido'
            })
        }
        let from_date;
        try {
            from_date = CustomDate.parse_from_frontend_date(date_start)
            if(!from_date) {
                throw new Error('Invalid date')
            }
        } catch(e) {
            errors.push({
                field: 'start_date',
                message: 'Data inizio non valida'
            })
        }
        let to_date;
        try {
            to_date = CustomDate.parse_from_frontend_date(date_end)
            if(!to_date) {
                throw new Error('Invalid date')
            }
        } catch(e) {
            errors.push({
                field: 'end_date',
                message: 'Data fine non valida'
            })
        }
        if(from_date > to_date) {
            errors.push({
                field: 'start_date',
                message: 'Data inizio maggiore della data fine'
            })
        }
        if(errors.length > 0) {
            res.status(400).json(errors)
            return
        }
        let query = `
            insert into account_suspension(id, user_id, suspension_reason, suspension_start_at, suspension_end_at, created_by)
            values(?, ?, ?, ?, ?, ?)
            returning suspension_reason, suspension_start_at, suspension_end_at
        `
        const [err, result] = await Database.query(query, [
            suspensionUlid, 
            user_id, 
            reason, 
            CustomDate.formatForDatabase(from_date), 
            CustomDate.formatForDatabase(to_date),
            req.user.id
        ])
        if(err) {
            console.log(err)
            res.status(500).send('Errore durante la sospensione dell\'account')
            return
        }
        const today = new Date()
        if(today < from_date || today > to_date) {
            res.status(201).send({
                id: suspensionUlid,
                reason: result[0].suspension_reason,
                start_date: CustomDate.dateToITString(CustomDate.parse_from_database(result[0].suspension_start_at)),
                end_date: CustomDate.dateToITString(CustomDate.parse_from_database(result[0].suspension_end_at))
            })
            return
        }

        // If the suspension also covers today, it is necessary to delete the user's sessions
        query = `
            delete from user_session
            where json_extract(sess, '$.passport.user.id') = ?
        `
        const [err1, result1] = await SessionDatabase.query(query, [user_id])
        if(err1) {
            console.log(err1)
            res.status(500).send('Errore durante la cancellazione delle sessioni')
            return
        }
        res.status(201).send({
            id: suspensionUlid,
            reason: result[0].suspension_reason,
            start_date: CustomDate.dateToITString(CustomDate.parse_from_database(result[0].suspension_start_at)),
            end_date: CustomDate.dateToITString(CustomDate.parse_from_database(result[0].suspension_end_at))
        })
    }

    static async Delete(req, res) {
        const suspension_id = req.params.uuid
        if(!suspension_id) {
            res.status(400).send('Id sospensione non valido')
            return
        }
        const query = `
            delete from account_suspension
            where id = ?
        `
        const [err, result] = await Database.query(query, [suspension_id])
        if(err) {
            console.log(err)
            res.status(500).send('Errore durante la cancellazione della sospensione')
            return
        }
        res.status(200).send('Sospensione cancellata')
    }
}

module.exports = {
    ApiUserSuspendUuid: ApiUserSuspendUuid
}