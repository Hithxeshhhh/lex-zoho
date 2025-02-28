const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Token = require('../models/tokenModel'); // Import token model
const dotenv = require('dotenv');
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Authenticate user
const authenticateUser = async (req, res) => {
    const { username, password } = req.body;

    if (username !== process.env.USER_NAME || password !== process.env.PASSWORD) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token (6 months expiry)
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '180d' });

    // Upsert (update or insert) token in MongoDB
    await Token.findOneAndUpdate({}, { token, createdAt: new Date() }, { upsert: true });

    res.json({ token });
};

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Token required' });

    const token = authHeader.split(' ')[1];
    const storedToken = await Token.findOne({ token });

    if (!storedToken) return res.status(401).json({ message: 'Invalid or expired token' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

module.exports = { authenticateUser, verifyToken };
