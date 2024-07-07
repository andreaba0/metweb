const {Email, EmailFieldMissing, SignupEmail, ChangePasswordEmail} = require('../email');

describe('Email', () => {
    it('should throw an error if recipient is missing', () => {
        const email = new SignupEmail({});
        expect(email.recipient).toBeInstanceOf(EmailFieldMissing);
    });

    it('should throw an error if subject is missing', () => {
        const email = new SignupEmail({});
        expect(email.subject).toBeInstanceOf(EmailFieldMissing);
    });

    it('Should return correct fields', () => {
        const email = new SignupEmail({
            recipient: 'test@service.com',
            subject: 'Test',
            content: {
                token: '123'
            }
        });
        expect(email.recipient).toBe('test@service.com');
        expect(email.subject).toBe('Test');
        expect(email.token).toBe('123');
    })
})