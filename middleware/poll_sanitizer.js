const {CustomDate} = require('../utility/date')

function pollSanitizer(req, res, next) {
  const body = req.body
  console.log(body)
    if (!body.title || !body.description) {
        return res.status(400).json({ error: 'missing title or description' })
    }
    if (typeof body.title !== 'string') {
        return res.status(400).json({ error: 'title must be a string' })
    }
    let options = []
    for (let key in body) {
        var regex = /^option_[0-9]+$/
        if (regex.test(key)) {
            options.push(body[key])
        }
    }
    if (options.length < 2) {
        return res.status(400).json({ error: 'at least two options must be provided' })
    }
    req.body.options = options
    if (body.anonymous_compilation && body.anonymous_compilation!=='on') {
        return res.status(400).json({ error: 'anonymous_compilation must be false or "on"' })
    }
    if (body.multiple_choice && body.multiple_choice!=='on') {
        return res.status(400).json({ error: 'multiple_choice must be false or "on"' })
    }
    if(!body.start_date) {
        return res.status(400).json({ error: 'missing start_date' })
    }
    if(!body.end_date) {
        return res.status(400).json({ error: 'missing end_date' })
    }
    let start_date = CustomDate.parse_from_frontend(body.start_date)
    if (!start_date) {
        return res.status(400).json({ error: 'start_date must be in format "D/M/Y h:i"' })
    }
    let end_date = CustomDate.parse_from_frontend(body.end_date)
    if (!end_date) {
        return res.status(400).json({ error: 'end_date must be in format "D/M/Y h:i"' })
    }
    if (start_date >= end_date) {
        return res.status(400).json({ error: 'start_date must be before end_date' })
    }
    req.body.start_date = start_date
    req.body.end_date = end_date
    next()
}

module.exports = {
    pollSanitizer: pollSanitizer
}