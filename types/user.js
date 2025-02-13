const validator = require('validator')
const {CustomDate} = require('../utility/date')

function isAlphabetical(str) {
    return /^[a-zA-Z]+$/.test(str)
}

class User {
    constructor(id, first_name, last_name, role, email, date_of_birth, gender) {
        this.id = id
        this.first_name = first_name
        this.last_name = last_name
        this.role = role
        this.email = email
        this.date_of_birth = date_of_birth
        this.gender = gender
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
}

module.exports = {
    User: User
}