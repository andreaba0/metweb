class Filter {
    constructor(json) {
        this.json = json;
    }

    /**
     * This function checks if the domain matches the email.
     * @param {domain string} domain 
     * @param {email string to check} email 
     * @returns 
     */
    static domainMatchEmail(domain, email) {
        if (email === undefined || email === null || email === '') {
            return false;
        }
        let filterRegex = '^';
        if (domain === undefined || domain === null || domain === '') {
            return true;
        }
        if (domain[0] === '*') {
            filterRegex += '[a-zA-Z0-9.]+';
        }
        let domainHierarchy = domain.split('.');
        if(domain[0]==='*') {
            domainHierarchy.shift();
        }
        domainHierarchy.forEach((domain) => {
            if(domain==='*') {
                throw new Error('Invalid domain format');
            }
            if(filterRegex!=='^') {
                filterRegex += '.';
            }
            if(!domain.match(/^[a-zA-Z0-9]+$/)) {
                throw new Error('Invalid domain string');
            }
            filterRegex += domain;
        })
        filterRegex += '$';
        const regex = new RegExp(filterRegex);
        const email_domain = email.match(/@(.*)$/)[1];
        return regex.test(email_domain);
    }

    domainMatch(email) {
        for(let i=0;i<this.json.domain.length;i++) {
            if (Filter.domainMatchEmail(this.json.domain[i], email)) {
                return true;
            }
        }
    }
}

module.exports = {
    Filter: Filter
}