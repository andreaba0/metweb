const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

class SessionDatabase {
    static #dbms = null
    static database() {
        if (this.#dbms == null) {
            this.#dbms = new sqlite3.Database(process.env.SESSION_DB_NAME)
        }
        return this.#dbms
    }

    static async query(query, args) {
        const db = SessionDatabase.database()
        return new Promise((resolve, reject) => {
            /*db.exec('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    console.log(err)
                    resolve([err, null])
                }
            })*/
            db.all(query, args, (err, rows) => {
                resolve([err, rows])
            })
        })
    }
}

class Database {
    static #dbms = null

    constructor() {}

    static database() {
        if (this.#dbms == null) {
            this.#dbms = new sqlite3.Database(process.env.DATA_DB_NAME)
        }
        return this.#dbms
    }

    static async dedicated_query(db, query, args) {
        return new Promise((resolve, reject) => {
            db.all(query, args, (err, rows) => {
                resolve([err, rows])
            })
        })
    }

    static async shared_query(query, args) {
        const db = Database.database()
        return Database.query(db, query, args)
    }

    static async query() {
        if (arguments.length == 2) {
            return Database.shared_query(arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return Database.dedicated_query(arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    /**
     * 
     * @param {string} query 
     * @param {Array<any>} args 
     * @returns {Promise<any>}
     * @description Run a non-returning query within a shared database connection.
     */
    static async dedicated_non_returning_query(db, query, args) {
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

    static async shared_non_returning_query(query, args) {
        const db = Database.database()
        return Database.dedicated_non_returning_query(db, query, args)
    }

    static async non_returning_query() {
        if (arguments.length == 2) {
            return Database.shared_non_returning_query(arguments[0], arguments[1])
        }
        if (arguments.length == 3) {
            return Database.dedicated_non_returning_query(arguments[0], arguments[1], arguments[2])
        }

        throw new Error('Invalid number of arguments')
    }

    /**
     * @param {function} callback of type (db: sqlite3.Database) => Promise<any>
     * @returns {Promise<[Error, any]>}
     * @description Run a transaction within a new database connection. This avoid query to interfere with a running transaction
     */
    static async run_scoped_transaction(callback) {
        const db = new sqlite3.Database(process.env.DB_NAME)
        let res = []
        try {
            const data = await callback(db)
            res.push(null, data)
        } catch(e) {
            console.log(e)
            res.push(e, null)
        }
        db.close()
        return res
    }
}

module.exports = {
    Database: Database,
    SessionDatabase: SessionDatabase
}