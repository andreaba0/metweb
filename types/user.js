const validator = require('validator')
const {CustomDate} = require('../utility/date')
const {Database} = require('../utility/db_store')

function isAlphabetical(str) {
    return /^[a-zA-Z]+$/.test(str)
}

class Suspension {
    constructor(id, reason, date_start, date_end) {
        this.id = id
        this.reason = reason
        this.date_start = date_start
        this.date_end = date_end
    }

    getStartDate() {
        return CustomDate.parse_from_database(this.date_start)
    }

    getEndDate() {
        return CustomDate.parse_from_database(this.date_end)
    }

    getReason() {
        return this.reason
    }

    getId() {
        return this.id
    }
}

class SuspensionIterable {
    constructor(User) {
        this.index = 0
        this.User = User
    }

    hasNext() {
        return this.index < this.User.suspensions.length
    }

    next() {
        if(this.index >= this.User.suspensions.length) {
            return null
        }
        const index = this.index
        this.index++
        return {
            id: this.User.getProperty('suspensions')[index].getId(),
            reason: this.User.getProperty('suspensions')[index].getReason(),
            start_date: CustomDate.dateToITString(this.User.getProperty('suspensions')[index].getStartDate()),
            end_date: CustomDate.dateToITString(this.User.getProperty('suspensions')[index].getEndDate())
        }
    }

}

class User {
    loaded = false
    suspension_loaded = false
    constructor(id, first_name, last_name, role, email, date_of_birth, gender) {
        this.id = id
        this.first_name = first_name
        this.last_name = last_name
        this.user_role = role
        this.email = email
        this.date_of_birth = date_of_birth
        this.gender = gender
        this.suspensions = []
        this.loaded = true
    }

    static async loadFromDatabase(id) {
        const query = `
            select
                first_name,
                last_name,
                user_role,
                email,
                date_of_birth,
                gender
            from
                user_account
            where
                id = ?
        `
        const [err, result] = await Database.query(query, [id])
        if(err) {
            throw new Error('Database error')
        }
        if(result.length == 0) {
            return null
        }
        const row = result[0]
        this.loaded = true
        return new User(id, row.first_name, row.last_name, row.user_role, row.email, row.date_of_birth, row.gender)
    }

    async loadSuspensionFromDatabase() {
        if(!this.loaded) {
            throw new Error('User not loaded')
        }
        if(this.suspension_loaded) {
            return this.suspensions.length
        }
        const query = `
            select
                id,
                suspension_reason,
                suspension_start_at,
                suspension_end_at
            from account_suspension
            where user_id = ?
        `
        const [err, rows] = await Database.query(query, [this.id])
        if(err) {
            throw new Error('Database error')
        }
        this.suspension_loaded = true
        for(var i = 0; i < rows.length; i++) {
            const row = rows[i]
            this.suspensions.push(new Suspension(row.id, row.suspension_reason, row.suspension_start_at, row.suspension_end_at))
        }
        return rows.length
    }

    static evaluateAnagraphicData(body) {
        var errors = []
        if (!body.first_name||!isAlphabetical(body.first_name)) {
            errors.push({
                field: 'first_name',
                message: 'First name must be alphabetical'
            })
        }
        if (!body.last_name||!isAlphabetical(body.last_name)) {
            errors.push({
                field: 'last_name',
                message: 'Last name must be alphabetical'
            })
        }
        if (!body.date_of_birth||!CustomDate.parse_from_frontend_date(body.date_of_birth)) {
            errors.push({
                field: 'date_of_birth',
                message: 'Date of birth must be valid'
            })
        } else {
            const dateOfBirth = CustomDate.parse_from_frontend_date(body.date_of_birth)
            if (dateOfBirth > new Date()) {
                errors.push({
                    field: 'date_of_birth',
                    message: 'Date of birth must be in the past'
                })
            }
        } 
        if(!body.gender) {
            errors.push({
                field: 'gender',
                message: 'Gender field must be filled'
            })
        } else {
            const gender = body.gender
            if(gender!=='male'&&gender!=='female'&&gender!=='not_say') {
                errors.push({
                    field: 'gender',
                    message: 'Gender has unknown value'
                })
            }
        }
        return errors
    }

    static evaluateSigninCredentials(body) {
        var errors = []
        if (!body.email||!validator.isEmail(body.email)) {
            errors.push({
                field: 'email',
                message: 'Email must be valid'
            })
        }
        if(!body.password) {
            errors.push({
                field: 'password',
                message: 'Password must be filled'
            })
        } else {
            if(!validator.isStrongPassword(body.password, {
                minLength: 8,
                minLowercase: 1,
                minUppercase: 0,
                minNumbers: 0,
                minSymbols: 0,
                returnScore: false
            })) {
                errors.push({
                    field: 'password',
                    message: 'Password must be strong'
                })
            }
        }
        if(!body.confirm_password) {
            errors.push({
                field: 'confirm_password',
                message: 'Confirm password must be filled'
            })
        } else {
            if(body.password!==body.confirm_password) {
                errors.push({
                    field: 'confirm_password',
                    message: 'Password and confirm password must be the same'
                })
            }
        }
        return errors
    }

    getProperty(property) {
        return this[property]
    }
}

module.exports = {
    User: User,
    SuspensionIterable: SuspensionIterable
}