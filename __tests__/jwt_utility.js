const {parseJwt, JwtBadToken} = require('../jwt_utility')

describe('JwtUtility', () => {
    it('should return bad token if token is invalid', () => {
        const token = 'trrtgr#fgrgfr.grtgret546t4.get45t45'
        const parsed = parseJwt(token)
        expect(parsed).toBeInstanceOf(JwtBadToken)
    })

    it('should return parsed token if token is valid', () => {
        const token = 'header.payload.signature'
        const parsed = parseJwt(token)
        expect(parsed.header).toBe('header')
        expect(parsed.payload).toBe('payload')
        expect(parsed.signature).toBe('signature')
    })
})