class User {
    constructor(id, first_name, last_name, role, email, date_of_birth) {
        this.id = id
        this.first_name = first_name
        this.last_name = last_name
        this.role = role
        this.email = email
        this.date_of_birth = date_of_birth
    }

    static loadFromJWT(payload) {
        return new User(
            payload.id,
            payload.first_name,
            payload.last_name,
            payload.role,
            null,
            null
        )
    }
}

module.exports = {
    User: User
}