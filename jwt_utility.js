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

function base64url_to_base64(string) {
    const m = string.length % 4
    const padded = (m === 2) ? string + '==' : (m === 3) ? string + '=' : string
    const re = /-/g
    const re2 = /_/g
    const temp = padded.replace(re, '+').replace(re2, '/')
    return temp
}

function parseJwt(token) {
    const re =/^(?<header>[a-zA-Z0-9\-\_]+).(?<payload>[a-zA-Z0-9\-\_]+).(?<signature>[a-zA-Z0-9\-\_]+)$/g
    const match = re.exec(token)
    if (match == null) {
        return new JwtBadToken('Invalid token')
    }
    const groups = {}
    groups.header = JSON.parse(Buffer.from(base64url_to_base64(match.groups.header), 'base64').toString())
    groups.payload = JSON.parse(Buffer.from(base64url_to_base64(match.groups.payload), 'base64').toString())
    return groups
}

module.exports = {
    parseJwt: parseJwt,
    JwtBadToken: JwtBadToken
}