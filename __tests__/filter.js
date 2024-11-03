const { Filter } = require('../utility/filter');

describe('Filter', () => {
    it('should match correct domain in emails', () => {
        expect(Filter.domainMatchEmail('*.example.com', 'mark@a.example.com')).toBe(true);
        expect(Filter.domainMatchEmail('*.example.com', 'mark@example.com')).toBe(false);
        expect(Filter.domainMatchEmail('a.example.com', 'mark@b.example.com')).toBe(false);
        expect(Filter.domainMatchEmail('b.example.com', 'mark@b.example.com')).toBe(true);
        expect(()=>{Filter.domainMatchEmail('*.test.*.com', 'mark@example.com')}).toThrow('Invalid domain format');
        expect(()=>{Filter.domainMatchEmail('*.test#.com', 'mark@example.com')}).toThrow('Invalid domain string');
    });
})