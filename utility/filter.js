class Filter {

    #regex_full_domains = '^[a-z0-9.\*, ]+$';
    #regex_single_domain = '^(\*.)?([a-z0-9]+\.)?[a-z]$';

    constructor(json) {
        this.json = json;
    }

    static parse(string) {
        var res = []
        if (!string) {
            return res;
        }
        var parts = string.split(',').map(function (item) {
            return item.trim();
        });
        if (parts.length === 0) {
            return res;
        }
        for (let i = 0; i < parts.length; i++) {
            const domain = parts[i];
            const domainParts = domain.split('.');
            if(domainParts.length < 2) {
                continue;
            }
            var ok = true;
            for(var j=0;j<domainParts.length;j++) {
                if(j==0&&!(domainParts[j]=='*' || domainParts[j].match(/^[a-z0-9\-]+$/))) {
                    ok = false;
                    break;
                }
                if(j==domainParts.length-1&&!(domainParts[j].match(/^[a-z]+$/))) {
                    ok = false;
                    break;
                }
                if(j>0&&!(domainParts[j].match(/^[a-z0-9\-]+$/))) {
                    ok = false;
                    break;
                }
            }
            if(ok) {
                res.push(domain);
            }
        }
        return res;
    }

    /**
     * This function checks if the domain matches the email.
     * @param {domain string} domain 
     * @param {email string to check} email 
     * @returns 
     */
    static domainMatchEmail(domain_string, email) {
        if (!email) {
            return false;
        }
        const domainParts = domain_string.split('.').reverse();
        const emailParts = email.split('@')[1].split('.').reverse();
        for(let i=0;i<domainParts.length;i++) {
            if(i>emailParts.length-1) {
                return false;
            }
            if(i==0&&domainParts[i]!=emailParts[i]) {
                return false;
            }
            if(i>0&&domainParts[i]=='*') {
                return true;
            }
            if(i>0&&domainParts[i]!=emailParts[i]) {
                return false;
            }
        }
        return true;
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