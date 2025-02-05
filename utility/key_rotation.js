const {SharedCache, Cache, CacheMiss, CacheHit, CacheError, CacheEmpty} = require('./cache')
const {Database} = require('./db_store')

/**
 * Email verification tokens and password reset tokens are jwts signed with rsa keys.
 * To limit the validity of these keys in the system, keys can be rotated.
 * On a low level the rotation works as follows:
 * 1. A new key is generated
 * 2. The new key is pushed to the database
 * 3. The latest 3 keys generated are retrieved from the database by the system
 * This will create the following scenario:
 * [future key, current key, old key] ... old keys
 * Current key is used to sign new tokens, while future and old keys are used to verify tokens.
 * All 3 keys can be used to verify tokens, but only the current key can be used to sign tokens.
 * This is because in a distributed system with many instances, some instances may have already queried
 * and cached the latest 3 keys, while the others may still have the old keys.
 * Here is an example of of the key rotation:
 * System I     : [key3, key2, key1]
 * System II    : [key3, key2, key1]
 * System III   : [key4, key3, key2]
 * System IV    : [key3, key2, key1]
 * The format of the keys array is: [future key, current key, old key]
 * The system above has 4 instances.
 * System I, II, and IV have the old keys, while System III has the new keys.
 * System III can now sign with key3, and the other not yet updated systems can still verify with key3.
 * Rotation may happen on a schedule, or after a certain amount of time.
 * A more efficient way can use 2 keys instead of 3.
 */



class KeySchema {
    #keys = []
    constructor(arr) {
        this.#keys = arr
    }

    validation(kid) {
        for (let i = 0; i < this.#keys.length; i++) {
            if (this.#keys[i].kid == kid) {
                return this.#keys[i]
            }
        }
        return null
    }

    get signing() {
        // [<old key>, <current key>, <future key>]
        return this.#keys[1]
    }

    get_by_kid(kid) {
        return this.#keys.find((key) => key.kid == kid)
    }

    build(arr) {
        let keys = []
        for(let i = 0; i < arr.length; i++) {
            keys.push({kid: arr[i].kid, public_key: arr[i].public_key, private_key: arr[i].private_key})
        }
        this.#keys = keys
    }
}

class KeyManagerError {
    constructor(message) {
        this.message_error = message
    }
    get message() {
        return this.message_error
    }
}

class KeyManagerResult {
    constructor(value) {
        this.value = value
    }
    get message() {
        return this.value
    }
}

class KeyManager {
    static #key_store = SharedCache.cache('key_store')

    constructor() {}

    static async  #query_from_db() {
        return new Promise((resolve, reject) => {
            const db = Database.database()
            const query = 'SELECT id, private_key, public_key FROM rsa_key order by created_at LIMIT 3';
            db.all(query, (err, rows) => {
                if (err || rows == null) {
                    resolve(null)
                }
                let keys = []
                rows.forEach(row => {
                    keys.push({
                        kid: row.id,
                        private_key: row.private_key,
                        public_key: row.public_key
                    })
                })
                resolve(keys)
            })
        })
    }

    static async schema() {
        let keys = []
        keys = this.#key_store.get('keys')
        if (keys instanceof CacheHit) {
            keys = keys.value
        } else {
            //get keys from db
            const new_keys = await this.#query_from_db()
            if (new_keys == null) {
                return new KeyManagerError('No keys found')
            }
            //set keys in cache
            this.#key_store.set_raw({
                keys: new_keys
            }, 60*10)
            keys = new_keys
        }
        let keySchema = new KeySchema()
        keySchema.build(keys)
        return keySchema
    }
}

module.exports = {
    KeyManager: KeyManager,
    KeyManagerError: KeyManagerError,
    KeyManagerResult: KeyManagerResult,
    KeySchema: KeySchema
}