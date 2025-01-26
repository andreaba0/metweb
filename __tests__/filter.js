const { Filter } = require('../utility/filter');

describe('Filter', () => {
    it('should match correct domain in emails', () => {
        expect(Filter.domainMatchEmail('*.example.com', 'mark@a.example.com')).toBe(true);
        expect(Filter.domainMatchEmail('*.example.com', 'mark@example.com')).toBe(false);
        expect(Filter.domainMatchEmail('a.example.com', 'mark@b.example.com')).toBe(false);
        expect(Filter.domainMatchEmail('b.example.com', 'mark@b.example.com')).toBe(true);
        expect(Filter.domainMatchEmail('*.test.com', 'mark@test.com')).toBe(false);
        expect(Filter.domainMatchEmail('*.test.com', 'mark@alfa.beta.test.com')).toBe(true);
    });

    it('should parse a domain string into an array of domains', () => {
        expect(Filter.parse('*.example.com, a.example.com')).toEqual(['*.example.com', 'a.example.com']);
        expect(Filter.parse('*.example.com, a.example.com, *.example.com')).toEqual(['*.example.com', 'a.example.com', '*.example.com']);
        expect(Filter.parse('*.example.com, a.example.com, example.c-om,')).toEqual(['*.example.com', 'a.example.com']);
        expect(Filter.parse('*.example.com')).toEqual(['*.example.com']);
        expect(Filter.parse('')).toEqual([]);
        expect(Filter.parse(null)).toEqual([]);
    });
})