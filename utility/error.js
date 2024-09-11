const { STATUS_CODES } = require('http');

class FrontendError {
    constructor(status, message) {
        this.status = status
        this.message = message
    }

    render(res) {
        if (this.status === 404) {
            this.title = 'Not Found'
            this.src = '/static/icon/page_not_found.svg',
            this.alt = 'Not Found'
        }
        if (this.status === 403) {
            this.title = 'Forbidden'
            this.src = '/static/icon/access_denied.svg',
            this.alt = 'Forbidden'
        }
        if (this.status === 500) {
            this.title = 'Internal Server Error'
            this.src = '/static/icon/server_down.svg',
            this.alt = 'Internal Server Error'
        }
        res.status(this.status).render('error', {
            status: this.status,
            title: this.title || STATUS_CODES[this.status],
            message: this.message,
            src: this.src,
            alt: this.alt
        })
    }
}

module.exports = {
    FrontendError: FrontendError
}