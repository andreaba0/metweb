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
        try {
            let [date, time] = raw_date.split(' ')
            let [day, month, year] = date.split('/')
            let [hour, minute] = time.split(':')
            let newDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`)
            return newDate
        } catch(e) {
            console.log(e)
            return null
        }
    }

    static formatForDatabase(date) {
        if (!date instanceof Date) {
            return null
        }
        console.log(date)
        return date.toISOString().slice(0, 19).replace('T', ' ')
    }

    static parse_from_frontend_date(raw_date) {
        console.log(raw_date)
        try {
            let [day, month, year] = raw_date.split('/')
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
        if (diff < 0) {
            diff = -diff
        }
        console.log(diff / (1000 * 60 * 60 * 24 * 365))
        return diff / (1000 * 60 * 60 * 24 * 365)
    }

    static dateToITString(date) {
        // date should be in DD Month YYYY
        let day = date.getDate()
        let month = date.getMonth()
        let year = date.getFullYear()
        switch(month) {
            case 0:
                month = 'Gennaio'
                break
            case 1:
                month = 'Febbraio'
                break
            case 2:
                month = 'Marzo'
                break
            case 3:
                month = 'Aprile'
                break
            case 4:
                month = 'Maggio'
                break
            case 5:
                month = 'Giugno'
                break
            case 6:
                month = 'Luglio'
                break
            case 7:
                month = 'Agosto'
                break
            case 8:
                month = 'Settembre'
                break
            case 9:
                month = 'Ottobre'
                break
            case 10:
                month = 'Novembre'
                break
            case 11:
                month = 'Dicembre'
                break
        }
        return `${day} ${month} ${year}`
    }
}

module.exports = {
    CustomDate: CustomDate
}