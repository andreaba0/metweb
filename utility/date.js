class CustomDate {
    static from_UTC_timestamp(timestamp) {
        return new Date(`${timestamp}Z`);
    }

    /**
     * 
     * @param {string} date
     * @returns {Date}
     * @description Return a Date object retrieved from string in format: "D/M/Y h:i" 
     */
    static parse_from_frontend(raw_date) {
        let [date, time] = raw_date.split(' ')
        let [day, month, year] = date.split('/')
        let [hour, minute] = time.split(':')
        try {
            let date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`)
            return date
        } catch(e) {
            console.log(e)
            return null
        }
    }

    static parse_from_frontend_date(raw_date) {
        let [day, month, year] = raw_date.split('/')
        try {
            let date = new Date(`${year}-${month}-${day}T00:00:00Z`)
            return date
        } catch(e) {
            console.log(e)
            return null
        }
    }

    static parse_from_database(raw_date) {
        let [date, time] = raw_date.split(' ')
        let [year, month, day] = date.split('-')
        let [hour, minute, second] = time.split(':')
        try {
            let date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
            return date
        } catch(e) {
            console.log(e)
            return null
        }
    }

    static numberOfYearsBetween(date1, date2) {
        let diff = date1 - date2
        return diff / (1000 * 60 * 60 * 24 * 365)
    }
}

module.exports = {
    CustomDate: CustomDate
}