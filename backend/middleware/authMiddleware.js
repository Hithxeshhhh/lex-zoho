const basicAuth = require('basic-auth');
const dotenv = require('dotenv');
dotenv.config();

// Middleware for Basic Authentication
const basicAuthMiddleware = (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials || credentials.name !== process.env.USER_NAME || credentials.pass !== process.env.PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    next();
};

module.exports = basicAuthMiddleware;
