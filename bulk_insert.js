const {fakerIT: faker} = require('@faker-js/faker')
const {Database} = require('./utility/db_store')
const {create_salt, calculate_hash} = require('./utility/password')
const fs = require('fs')

faker.seed(1500)

function format_date(date) {
    const year = date.getFullYear()
    const month = (date.getMonth()+1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    const second = date.getSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

class User {
    constructor(role, gender) {
        this.id = faker.string.uuid()
        console.log(this.id)
        this.firstName = faker.person.firstName()
        this.lastName = faker.person.lastName()
        this.email = faker.internet.email({
            firstName: this.firstName,
            lastName: this.lastName
        }).toLowerCase()
        this.salt = create_salt()
        this.hashed_password = calculate_hash('password', this.salt)
        this.role = role
        this.gender = gender
        const birthdate = faker.date.birthdate({
            mode: 'age',
            min: 12,
            max: 95
        })
        this.birthdate = format_date(birthdate)
    }

    static generateEmail(first_name, last_name) {
        const fn = first_name.toLowerCase()
        const ln = last_name.toLowerCase()
        return `${fn}.${ln}@${emailProviders[randomNumber(emailProviders.length-1)]}`
    }
}

var userRoles = ['adm', 'usr']
var userGenders = ['male', 'female', 'not_say']
var users = []
var adminUsers = []
var polls = []


async function pragmaForeignKeys() {
    var query = 'PRAGMA foreign_keys = ON'
    var [err, res] = await Database.query(query, [])
    if (err) {
        throw new Error(err)
    }
}

async function bulkCreateUser() {

    // UPLOAD USER USERS
    for(var j=0;j<userGenders.length;j++) {
        const first = j*10
        for(var k=0;k<10;k++) {
            var user = new User('usr', userGenders[j])
            users.push(user)
        }

        var query = `
            insert into user_account
            (id, email, first_name, last_name, hashed_password, password_salt, user_role, gender, date_of_birth)
            values

        `
        var placeHolder = '(?, ?, ?, ?, ?, ?, ?, ?, ?)'
        var queryValues = []
        for(var i=first;i<first+10;i++) {
            const user = users[i]
            queryValues.push(
                user.id,
                user.email,
                user.firstName,
                user.lastName,
                user.hashed_password,
                user.salt,
                user.role,
                user.gender,
                user.birthdate
            )
            if (i!=first) {
                query += ','
            }
            query += placeHolder
        }

        var [err1, res1] = await Database.query(query, queryValues)
        if (err1) {
            throw new Error(err1)
        }

        query = `
            insert into user_customer
            (user_id, user_role)
            values
        `
        placeHolder = '(?, ?)'
        queryValues = []
        for(var i=first;i<first+10;i++) {
            const user = users[i]
            queryValues.push(
                user.id,
                user.role
            )
            if (i!=first) {
                query += ','
            }
            query += placeHolder
        }
        var [err2, res2] = await Database.query(query, queryValues)
        if (err2) {
            throw new Error(err2)
        }
    }

    // UPLOAD ADMIN USERS
    for(var j=0;j<userGenders.length;j++) {
        const first = j*3
        for(var k=0;k<3;k++) {
            var user = new User('adm', userGenders[j])
            adminUsers.push(user)
        }

        var query = `
            insert into user_account
            (id, email, first_name, last_name, hashed_password, password_salt, user_role, gender, date_of_birth)
            values

        `
        var placeHolder = '(?, ?, ?, ?, ?, ?, ?, ?, ?)'
        var queryValues = []
        for(var i=first;i<first+3;i++) {
            const user = adminUsers[i]
            queryValues.push(
                user.id,
                user.email,
                user.firstName,
                user.lastName,
                user.hashed_password,
                user.salt,
                user.role,
                user.gender,
                user.birthdate
            )
            if (i!=first) {
                query += ','
            }
            query += placeHolder
        }

        var [err1, res1] = await Database.query(query, queryValues)
        if (err1) {
            throw new Error(err1)
        }

        query = `
            insert into user_admin
            (user_id, user_role)
            values
        `
        placeHolder = '(?, ?)'
        queryValues = []
        for(var i=first;i<first+3;i++) {
            const user = adminUsers[i]
            queryValues.push(
                user.id,
                user.role
            )
            if (i!=first) {
                query += ','
            }
            query += placeHolder
        }
        var [err2, res2] = await Database.query(query, queryValues)
        if (err2) {
            throw new Error(err2)
        }
    }
}

async function bulkCreatePoll() {
    const data = fs.readFileSync('./bulk_data.json')
    const json = JSON.parse(data)
    polls = json

    var query = `
        insert into vote_page
        (id, vote_type, vote_description, title, created_by, option_type, compile_start_at, compile_end_at, public_stats, created_at)
        values
    `
    var placeHolder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    var queryValues = []
    for(var i=0;i<json.length;i++) {
        const poll = json[i]
        poll.id = faker.string.uuid()
        const created_at = new Date(faker.date.between({
            from: '2020-01-01T00:00:00.000Z',
            to: '2020-12-30T23:59:59.999Z'
        }))
        poll.created_at = format_date(created_at)
        console.log(poll.created_at)
        queryValues.push(
            poll.id,
            (poll.anonymous) ? 'anymus' : 'public',
            poll.description,
            poll.title,
            (users[0]).id,
            (poll.multiple_choice) ? 'multiple' : 'single',
            format_date(new Date(poll.start_at)),
            format_date(new Date(poll.end_at)),
            poll.public_stats,
            poll.created_at
        )
        if (i!=0) {
            query += ','
        }
        query += placeHolder
    }

    var [err1, res1] = await Database.query(query, queryValues)
    if (err1) {
        throw new Error(err1)
    }

    query = `
        insert into vote_option
        (option_index, vote_page_id, option_text, created_at)
        values
    `
    placeHolder = '(?, ?, ?, ?)'
    queryValues = []
    for(var i=0;i<json.length;i++) {
        const poll = json[i]
        var tmp = []
        for(var j=0;j<poll.answers.length;j++) {
            tmp.push("(?, ?, ?, ?)")
            queryValues.push(
                j,
                poll.id,
                poll.answers[j],
                poll.created_at
            )
        }
        if (i!=0) {
            query += ','
        }
        query += tmp.join(',')
    }

    var [err2, res2] = await Database.query(query, queryValues)
    if (err2) {
        throw new Error(err2)
    }
}

async function bulkCreateCompilation() {
    var query = `
        insert into voter
        (vote_page_id, created_by)
        values
    `
    var placeHolder = '(?, ?)'
    var queryValues = []

    for(var i=0;i<polls.length;i++) {
        var tmp = []
        for(var j=1;j<21;j++) {
            queryValues.push(
                polls[i].id,
                users[j].id
            )
            tmp.push(placeHolder)
        }
        if (i!=0) {
            query += ','
        }
        query += tmp.join(',')
    }

    var [err1, res1] = await Database.query(query, queryValues)
    if (err1) {
        throw new Error(err1)
    }

    query = `
        insert into vote
        (vote_page_id, vote_type, vote_option_index, created_by, created_at, user_group)
        values
    `
    placeHolder = '(?, ?, ?, ?, ?, ?)'
    queryValues = []

    for(var i=0;i<polls.length;i++) {
        var tmp = []
        for(var j=1;j<21;j++) {
            const poll = polls[i]
            const author = users[j].id
            const [num, records] = generateRecords(poll, author)
            queryValues = queryValues.concat(records)
            for(var k=0;k<num;k++) {
                tmp.push(placeHolder)
            }
        }
        if (i!=0) {
            query += ','
        }
        query += tmp.join(',')
    }
    var [err2, res2] = await Database.query(query, queryValues)
    if (err2) {
        throw new Error(err2)
    }
}

function generateRecords(poll, author) {
    var res = []
    var options_chosen = []
    const date = faker.date.between({
        from: poll.start_at,
        to: poll.end_at
    })
    const user_group = faker.string.uuid()
    if(poll.multiple_choice) {
        for(var i=0;i<poll.answers.length;i++) {
            if (Math.random() > 0.5) {
                options_chosen.push(i)
            }
        }
        if(options_chosen.length==0) {
            options_chosen.push(Math.floor(Math.random()*poll.answers.length))
        }
    } else {
        options_chosen.push(Math.floor(Math.random()*poll.answers.length))
    }

    for(var i=0;i<options_chosen.length;i++) {
        res.push(poll.id)
        res.push((poll.anonymous) ? 'anymus' : 'public')
        res.push(options_chosen[i])
        res.push((poll.anonymous) ? null : author)
        res.push(format_date(new Date(date)))
        res.push(user_group)
    }
    return [options_chosen.length, res]
}

async function main() {
    await pragmaForeignKeys()
    await bulkCreateUser()
    await bulkCreatePoll()
    await bulkCreateCompilation()
}

main()