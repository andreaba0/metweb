const {parseJwt} = require('./jwt_utility')

class email {
    #type = null;
    #path = null;
    #token = null;

    static parse(row_token) {
        const groups = parseJwt(row_token)
        if (groups instanceof JwtBadToken) {
            return null
        }
        if (groups.payload.type == 'verify_email') {
            return new VerifyEmail()
        }
        if (groups.payload.type == 'reset_password') {
            return new ResetPasswordEmail()
        }
        return null
    }
}

class VerifyEmail extends email {
    constructor(token) {
        this.#type = 'verify_email'
        this.#path = '/signup/confirm/'
        this.#token = token
    }
}

class ResetPasswordEmail extends email {
    constructor(token) {
        this.#type = 'reset_password'
        this.#path = '/password/reset/'
        this.#token = token
    }
}

module.exports = {
    VerifyEmail: VerifyEmail,
    ResetPasswordEmail: ResetPasswordEmail,
    parseEmail: email.parse
}