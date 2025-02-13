const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

/**
 * This class aims to provide an interface to interact with a database.
 * It is designed to handle both shared and dedicated database connections.
 * Shared connections are used for simple and non-transactional queries.
 * Dedicated connections are used for transactional queries.
 * 
 * Reasons to use a dedicated connection for a transactional query:
 * - Be able to run multiple transactions concurrently
 * - No overhead to restore a connection to its initial state after a broken transaction (e.g. not committed/rolled back)
 * Downside:
 * - Overhead of initializing a new connection for each user request that requires a transaction
 * 
 */
class DatabaseManager {

    /**
     * This method is used to ensure that a shared database connection is not used for transaction statements.
     * This check is used only in test/staging environment and ditched in production to avoid performance overhead.
     * 
     * @param {query} query 
     * @returns boolean
     */
    static isTransactionStatement(query) {
        // Skip this check in production to avoid performance overhead
        if (process.env.NODE_ENV=='PRODUCTION') return false
        
        // This method is used to ensure that a shared database connection is not used for transaction statements
        const string = query.toLowerCase().trim()
        var regexes = [
            /^begin([ ]+(DEFERRED|IMMEDIATE|EXCLUSIVE))?([ ]+(transaction))?/,
            /^(commit|rollback)([ ]+(transaction))?/,
            /^savepoint[ ]+[a-zA-Z0-9_]+/,
            /^release[ ]+savepoint[ ]+[a-zA-Z0-9_]+/
        ]
        for (var i = 0; i < regexes.length; i++) {
            if (regexes[i].test(string)) {
                return true
            }
        }
        return false
    }

    constructor() {}

    static async #query_runner(db, query, args) {
        return new Promise((resolve, reject) => {
            db.all(query, args, (err, rows) => {
                resolve([err, rows])
            })
        })
    }

    static async dedicated_query(db_shared, db_dedicated, query, args) {
        if (db_shared == db_dedicated) {
            throw new Error('Cannot use a shared database connection for a dedicated query')
        }
        return DatabaseManager.#query_runner(db_dedicated, query, args)
    }

    static async shared_query(db, query, args) {
        if (this.isTransactionStatement(query)) {
            throw new Error('Cannot use a shared database connection for a transaction statement')
        }
        return DatabaseManager.#query_runner(db, query, args)
    }

    static async non_returning_query_runner(db, query, args) {
        return new Promise((resolve, reject) => {
            db.run(query, args, (err) => {
                if (err) {
                    console.log(err)
                    resolve(err)
                }
                resolve(null)
            })
        })
    }

    /**
     * 
     * @param {string} query 
     * @param {Array<any>} args 
     * @returns {Promise<any>}
     * @description Run a non-returning query within a shared database connection.
     */
    static async dedicated_non_returning_query(db_shared, db_dedicated, query, args) {
        if (db_shared == db_dedicated) {
            throw new Error('Cannot use a shared database connection for a dedicated query')
        }
        return DatabaseManager.non_returning_query_runner(db_dedicated, query, args)
    }

    static async shared_non_returning_query(db, query, args) {
        if (this.isTransactionStatement(query)) {
            throw new Error('Cannot use a shared database connection for a transaction statement')
        }
        return DatabaseManager.non_returning_query_runner(db, query, args)
    }

    /**
     * @param {string} env_db_name
     * @param {function} callback of type (db: sqlite3.Database) => Promise<any>
     * @returns {Promise<[Error, any]>}
     * @description Run a transaction within a new database connection. This avoid other queries to interfere with a running transaction
     * an the lifecycle of a connection can be managed in a single place.
     */
    static async run_scoped_transaction(env_db_name, callback) {
        const db = new sqlite3.Database(env_db_name)
        let res = []
        try {
            const data = await callback(db)
            res.push(null, data)
        } catch(e) {
            console.log(e)
            var err = await DatabaseManager.non_returning_query_runner(db, 'ROLLBACK', [])
            res.push(e, null)
        }
        db.close()
        return res
    }
}

class Database extends DatabaseManager {
    static #db = null // This is a shared instance of a db connection, used for non-transactional queries
    
    constructor() {
        super()
    }

    static database() {
        if (this.#db == null) {
            this.#db = new sqlite3.Database(process.env.DATA_DB_NAME)
        }
        return this.#db
    }

    static async query() {
        const db = this.database()
        if (arguments.length == 2) {
            return super.shared_query(db, arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return super.dedicated_query(db, arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    static async non_returning_query() {
        const db = this.database()
        if (arguments.length == 2) {
            return super.shared_non_returning_query(db, arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return super.dedicated_non_returning_query(db, arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    static async run_scoped_transaction(callback) {
        return super.run_scoped_transaction(process.env.DATA_DB_NAME, callback)
    }

}


/**
 * This class is used to interact with the session database managed by passportjs and express-session.
 */
class SessionDatabase extends DatabaseManager {
    static #db = null
    constructor() {
        super()
    }

    static database() {
        if (this.#db == null) {
            this.#db = new sqlite3.Database(process.env.SESSION_DB_NAME)
        }
        return this.#db
    }

    static async query() {
        const db = this.database()
        if (arguments.length == 2) {
            return super.shared_query(db, arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return super.dedicated_query(db, arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    static async non_returning_query() {
        const db = this.database()
        if (arguments.length == 2) {
            return super.shared_non_returning_query(db, arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return super.dedicated_non_returning_query(db, arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    static async run_scoped_transaction(callback) {
        return super.run_scoped_transaction(process.env.SESSION_DB_NAME, callback)
    }
}

module.exports = {
    Database: Database,
    SessionDatabase: SessionDatabase
}