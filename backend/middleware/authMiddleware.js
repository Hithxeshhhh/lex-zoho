const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const Token = require('../models/tokenModel');
dotenv.config();

exports.authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const storedToken = await Token.findOne();
        if (!storedToken || storedToken.token !== token) {
            return res.status(403).json({ message: "Invalid token" });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return res.status(403).json({ message: "Invalid or expired token" });
            req.user = decoded;
            next();
        });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error });
    }
};
