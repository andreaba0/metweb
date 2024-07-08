class CacheEmpty {
    constructor(message) {
        this.message_error = message
    }
    get message() {
        return this.message_error
    }
}

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

class CacheExpired {
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
        try {
            let value = JSON.parse(JSON.stringify(obj));
            if (typeof value !== 'object') {
                return new CacheError(`'${typeof value}' is not an object`)
            }
            this.cache = value
            let seconds = ttl
            let expirationUtc = new Date().getTime() + seconds * 1000
            this.expiration = expirationUtc
        } catch (e) {
            if (e instanceof SyntaxError) {
                return new CacheError("Invalid object")
            }
            return new CacheError("Error setting cache")
        }
    }
    
    get(key) {
        if (Object.keys(this.cache).length == 0 && this.cache.constructor === Object) {
            return new CacheEmpty("Cache is empty")
        }
        if (this.expiration < new Date().getTime()) {
            return new CacheMiss("Key has expired")
        }
        if (key in this.cache) {
            return new CacheHit(this.cache[key])
        }
        return new CacheMiss(null)
    }
}

class SharedCache {
    static #shared_cache_list = {}
    static cache(id) {
        if (!(id in SharedCache.#shared_cache_list)) {
            SharedCache.#shared_cache_list[id] = new Cache()
        }
        return SharedCache.#shared_cache_list[id]
    }
}

module.exports = {
    Cache: Cache,
    CacheHit: CacheHit,
    CacheMiss: CacheMiss,
    CacheError: CacheError,
    CacheEmpty: CacheEmpty,
    SharedCache: SharedCache,
    CacheExpired: CacheExpired
}