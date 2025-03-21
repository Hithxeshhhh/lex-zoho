const mongoose = require('mongoose');

// Token schema
// This schema will store the token and the date it was stored in mongoDB

const tokenSchema = new mongoose.Schema({
    token: { type: String, required: true },
    storedAt: { type: Date, default: Date.now} 
});

module.exports = mongoose.model('Token', tokenSchema);
