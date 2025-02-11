const {Database} = require('../utility/db_store')
const {Filter} = require('../utility/filter')

class Poll {
    static identifier = 'id'
    static fieldNames = [
        'title',
        'vote_description',
        'compile_start_at',
        'compile_end_at',
        'vote_type',
        'public_stats',
        'created_at',
        'created_by',
        'suspension_reason',
        'restrict_filter',
        'option_type'
    ]
    #loaded = false
    id=''
    title=''
    vote_description=''
    options=[]
    created_by=''
    created_at=''
    compile_start_at=''
    compile_end_at=''
    public_stats=''
    restrict_filter = {}
    option_type='single'
    vote_type='public'
    constructor() {}

    static getFieldList() {
        return JSON.parse(JSON.stringify([Poll.identifier, ...Poll.fieldNames]))
    }

    async loadFromDatabase(id) {
        const fieldList = Poll.fieldNames.join(',')
        const query = `
            select
                ${fieldList}
            from
                vote_page
            where
                id = ?
        `
        const [err, rows] = await Database.query(query, [id])
        if (err) {
            throw new Error(err)
        }
        if (rows.length == 0) {
            throw new Error('No poll found with that ID')
        }
        rows[0].id = id
        this.loadFromDatabaseRow(rows[0])
    }

    loadFromDatabaseRow(row) {

        if (row == null) {
            throw new Error('Row is null')
        }

        if(typeof row !== 'object') {
            throw new Error('Row must be an object')
        }

        for (let i = 0; i < Poll.fieldNames.length; i++) {
            if (!row.hasOwnProperty(Poll.fieldNames[i])) {
                throw new Error(`Row is missing field ${this.fieldNames[i]}`)
            }
        }
        if (row.id == null) {
            throw new Error('Row is missing field id')
        }

        this.loaded = true
        this.id = row.id
        this.title = row.title
        this.vote_description = row.vote_description
        this.compile_start_at = row.compile_start_at
        this.compile_end_at = row.compile_end_at
        this.vote_type = row.vote_type
        this.public_stats = row.public_stats
        this.created_at = row.created_at
        this.created_by = row.created_by
        this.suspension_reason = row.suspension_reason
        this.restrict_filter = row.restrict_filter
        this.option_type = row.option_type
    }

    isSuspended() {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        return this.suspension_reason != null
    }

    isCompilableNow() {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        const now = new Date()
        const compileStartAt = new Date(this.compile_start_at)
        const compileEndAt = new Date(this.compile_end_at)
        return now >= compileStartAt && now <= compileEndAt
    }

    isSingleChoice() {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        return this.option_type == 'single'
    }

    isMultipleChoice() {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        return this.option_type == 'multiple'
    }

    getSuspensionReason() {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        return this.suspension_reason
    }

    getProperty(property) {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        if (!this.hasOwnProperty(property)) {
            throw new Error(`Property ${property} does not exist`)
        }
        return this[property]
    }

    emailIsAllowedToCompile(email) {
        if (!this.loaded) {
            throw new Error('Poll is not loaded')
        }
        if (this.restrict_filter == null) {
            return true
        }
        var emailFilters = this.restrict_filter['domain']
        for (let i = 0; i < emailFilters.length; i++) {
            if (Filter.domainMatchEmail(emailFilters[i], email)) {
                return true
            }
        }
        return false
    }
}

class PollArray {
    polls = []
    constructor() {}

    loadFromDatabaseRows(rows) {
        for (let i = 0; i < rows.length; i++) {
            const poll = new Poll()
            poll.loadFromDatabaseRow(rows[i])
            this.polls.push(poll)
        }
    }

    filter(property, value) {
        const filtered = []
        for (let i = 0; i < this.polls.length; i++) {
            if (this.polls[i].getProperty(property) == value) {
                filtered.push(this.polls[i])
            }
        }
        return filtered
    }

}

module.exports = {
    Poll: Poll
}