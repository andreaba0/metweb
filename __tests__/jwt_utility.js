const {parseJwt, JwtBadToken} = require('../utility/jwt_utility')

describe('JwtUtility', () => {
    it('should return bad token if token is invalid', () => {
        const token = 'trrtgr#fgrgfr.grtgret546t4.get45t45'
        const parsed = parseJwt(token)
        expect(parsed).toBeInstanceOf(JwtBadToken)
    })

    it('should return parsed token if token is valid', () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        const parsed = parseJwt(token)
        expect(JSON.stringify(parsed.header)).toBe(JSON.stringify({
            "alg": "HS256",
            "typ": "JWT"
          }))
        expect(JSON.stringify(parsed.payload)).toBe(JSON.stringify({
            "sub": "1234567890",
            "name": "John Doe",
            "iat": 1516239022
          }))
    })
})