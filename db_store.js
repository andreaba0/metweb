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

    static async non_returning_query(query, args) {
        return new Promise((resolve, reject) => {
            const db = Database.database()
            db.run(query, args, (err) => {
                if (err) {
                    console.log(err)
                    resolve(null)
                }
                resolve(true)
            })
        })
    }
}

module.exports = {
    Database: Database
}