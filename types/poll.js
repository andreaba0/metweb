class Poll {
    this.title=''
    this.description=''
    this.options=[]
    this.created_by=''
    this.created_at=''
    this.available=null
    this.compile_start_at=''
    this.compile_end_at=''
    this.public_stats=''
    constructor() {}

    static Post(requestBody) {
        let poll = new Poll()
        if (!requestBody.title) return new Error('Title is required')
        if (!requestBody.description) return new Error('Description is required')
        if (!requestBody.options) return new Error('Options are required')
        if (!requestBody.created_by) return new Error('Created by is required')
        if (!requestBody.created_at) return new Error('Created at is required')
        if (!requestBody.available) return new Error('Available is required')
        if (!requestBody.compile_start_at) return new Error('Compile start at is required')
        if (!requestBody.compile_end_at) return new Error('Compile end at is required')
        if (!requestBody.public_stats) return new Error('Public stats is required')
        poll.title = requestBody.title
        poll.description = requestBody.description
        poll.options = requestBody.options
        poll.created_by = requestBody.created_by
        poll.created_at = requestBody.created_at
        poll.available = requestBody.available
        poll.compile_start_at = requestBody.compile_start_at
        poll.compile_end_at = requestBody.compile_end_at
        poll.public_stats = requestBody.public_stats
        return poll
        
    }
}

module.exports = {
    Poll: Poll
}