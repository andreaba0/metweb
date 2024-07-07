class CacheHit {
    constructor(value) {
        this.value = value
    }

    message() {
        return this.value
    }
}

class CacheMiss {
    constructor(value) {
        this.value = value
    }

    message() {
        return this.value
    }
}

class CacheError {
    constructor(value) {
        this.value = value
    }

    message() {
        return this.value
    }
}

class Cache {
    constructor() {
        this.cache = {};
        this.expiration = 0;
    }
    
    set_raw(obj, ttl) {
        //deep copy obj
        this.cache = JSON.parse(JSON.stringify(obj));
        let seconds = ttl
        let expirationUtc = new Date().getTime() + seconds * 1000
        this.expiration = expirationUtc
    }
    
    get(key) {
        if (this.expiration < new Date().getTime()) {
            return new CacheMiss("Key has expired")
        }
        if (key in this.cache) {
            return new CacheHit(this.cache[key])
        }
        return new CacheMiss(null)
    }
}

module.exports = {
    Cache: Cache,
    CacheHit: CacheHit,
    CacheMiss: CacheMiss,
    CacheError: CacheError
}