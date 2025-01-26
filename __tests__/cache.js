const {Cache, CacheHit, CacheMiss, CacheError, CacheEmpty} = require('../utility/cache');

describe('Cache', () => {
    it('should return CacheMiss if key is not found', () => {
        const cache = new Cache();
        cache.set_raw({key: 'value'}, 60)
        expect(cache.get('key1')).toBeInstanceOf(CacheMiss);
    });

    it('should return CacheHit if key is found', () => {
        const cache = new Cache();
        cache.set_raw({key: 'value'}, 60);
        expect(cache.get('key')).toBeInstanceOf(CacheHit);
    });

    it('should return CacheError if object is invalid', () => {
        const cache = new Cache();
        expect(cache.set_raw('invalid', 60)).toBeInstanceOf(CacheError);
        let res = cache.set_raw('invalid', 60);
        expect(res.message()).toBe("'string' is not an object");
    })

    it('should return CacheEmpty if object is empty', () => {
        const cache = new Cache();
        expect(cache.get('key')).toBeInstanceOf(CacheEmpty);
    })

    it('should return CacheMiss if key has expired', () => {
        const cache = new Cache();
        cache.set_raw({key: 'value'}, -10);
        expect(cache.get('key')).toBeInstanceOf(CacheMiss);
    });
})