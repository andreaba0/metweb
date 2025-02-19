const {Database} = require('../../utility/db_store');
const {CustomDate} = require('../../utility/date');
const {User, SuspensionIterable} = require('../../types/user');
const {FrontendError} = require('../../utility/error');

class UserUuid {
    static async Get(req, res) {
        const uuid = req.params.uuid
        let user;
        try {
            user = await User.loadFromDatabase(uuid)
            await user.loadSuspensionFromDatabase()
        } catch(e) {
            console.log(e)
            return new FrontendError(500, 'Server error').render(res)
        }
        console.log(user)
        let gender = 'Non dichiarato'
        if(user.getProperty('gender') == 'male') gender = 'Maschio'
        if(user.getProperty('gender') == 'female') gender = 'Femmina'

        let suspensions = []
        let iterable = new SuspensionIterable(user)
        var suspension = iterable.next()
        while(suspension) {
            suspensions.push(suspension)
            suspension = iterable.next()
        }

        res.status(200).render('admin/user', {
            title: 'Informazioni utente',
            role: req.user.role,
            path_active: 'users',
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                date_of_birth: CustomDate.parse_from_database(user.date_of_birth).toLocaleDateString(),
                gender: gender,
                suspensions: suspensions
            }
        })
    }
}

module.exports = {
    UserUuid: UserUuid
}