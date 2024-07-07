class Email {
    #precipient;
    #psubject;
    constructor(obj) {
        this.#precipient = obj.recipient || null;
        this.#psubject = obj.subject || null;
    }

    get recipient() {
        if (this.#precipient == null) {
            return new EmailFieldMissing('recipient');
        }
        return this.#precipient;
    }

    get subject() {
        if (this.#psubject == null) {
            return new EmailFieldMissing('subject');
        }
        return this.#psubject;
    }
}

class EmailFieldMissing {
    constructor(field) {
        this.field = field;
    }

    message() {
        return `Email field ${this.field} is missing`;
    }
}

class SignupEmail extends Email {
    #ptoken;
    constructor(obj) {
        super(obj);
        this.#ptoken = obj.content?.token || null;
    }

    get token() {
        if (this.#ptoken == null) {
            return new EmailFieldMissing('token');
        }
        return this.#ptoken;
    }
}

class ChangePasswordEmail extends Email {
    #ptoken;
    constructor(obj) {
        super(obj);
        this.#ptoken = obj.content.token;
    }

    get token() {
        return this.#ptoken;
    }
}

module.exports = {
    Email: Email,
    EmailFieldMissing: EmailFieldMissing,
    SignupEmail: SignupEmail,
    ChangePasswordEmail: ChangePasswordEmail
}