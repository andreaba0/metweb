const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

class Database {
    static #dbms = null

    constructor() {}

    static database() {
        if (this.#dbms == null) {
            this.#dbms = new sqlite3.Database(process.env.DB_NAME)
        }
        return this.#dbms
    }

    static async query(query, args) {
        return new Promise((resolve, reject) => {
            const db = Database.database()
            db.all(query, args, (err, rows) => {
                resolve([err, rows])
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
    static async non_returning_query(query, args) {
        return new Promise((resolve, reject) => {
            const db = Database.database()
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
    Database: Database
}