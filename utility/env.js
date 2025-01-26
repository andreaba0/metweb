function checkEnvironment(environment) {
    let allowd_env = [
        'DEVELOPMENT',
        'PRODUCTION',
        'TEST',
        'STAGING'
    ]
    if (!allowd_env.includes(environment)) {
        throw new Error('Invalid environment')
    }
}

module.exports = {
    checkEnvironment: checkEnvironment
}