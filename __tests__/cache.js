const {Cache, CacheHit, CacheMiss, CacheError} = require('../cache');

describe('Cache', () => {
    it('should return CacheMiss if key is not found', () => {
        const cache = new Cache();
        expect(cache.get('key')).toBeInstanceOf(CacheMiss);
    });

    it('should return CacheHit if key is found', () => {
        const cache = new Cache();
        cache.set_raw({key: 'value'}, 60);
        expect(cache.get('key')).toBeInstanceOf(CacheHit);
    });

    it('should return CacheMiss if key has expired', () => {
        const cache = new Cache();
        cache.set_raw({key: 'value'}, -10);
        expect(cache.get('key')).toBeInstanceOf(CacheMiss);
    });
})