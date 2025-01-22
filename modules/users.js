class Users {
    static async Get(req, res) {
        res.render('admin/users', {
            title: 'Lista degli utenti',
            path_active: 'users',
            role: req.user.role
        })
    }
}

module.exports = {
    Users: Users
}