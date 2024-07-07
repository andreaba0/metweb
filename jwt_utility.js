class JwtBadToken {
    constructor(message) {
        this.message = message
    }

    message() {
        return this.message
    }
}

class JwtInstance {
    constructor(header, payload, signature) {
        this.header = header
        this.payload = payload
        this.signature = signature
    }
}

function parseJwt(token) {
    const re =/^(?<header>[a-zA-Z0-9\-\_]+).(?<payload>[a-zA-Z0-9\-\_]+).(?<signature>[a-zA-Z0-9\-\_]+)$/g
    const match = re.exec(token)
    if (match == null) {
        return new JwtBadToken('Invalid token')
    }
    return match.groups
}

module.exports = {
    parseJwt: parseJwt,
    JwtBadToken: JwtBadToken
}