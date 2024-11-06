const {Database} = require('../utility/db_store')

class Profile {
    static async Get(req, res) {
        const id = req.user.id
        let query = '';
        query = `
            select 
                id, 
                email, 
                first_name, 
                last_name,
                date_of_birth
            from user_account
            where id = ?
        `;
        const [err, result] = await Database.query(query, [id]);
        if (err) {
            return res.status(500).json({error: 'Internal server error'})
        }
        if (result.length === 0) {
            return res.status(404).json({error: 'User not found'})
        }
        console.log(result)
        console.log("debug")
        res.render('profile', {
            title: 'Il tuo profilo',
            role: req.user.role,
            path_active: 'profile',
            user: result[0]
        })
    }

    static async Post(req, res) {
        
    }
}

module.exports = {
    Profile: Profile
}