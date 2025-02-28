const fs = require('fs');
const path = require('path');

// Create a write stream (in append mode)
const logFile = fs.createWriteStream(path.join(__dirname, 'logs.txt'), { flags: 'a' });

// Create a custom logger
const logger = {
    log: (message) => {
        console.log(message);
        logFile.write(`${new Date().toISOString()} - ${message}\n`);
    },
    error: (message) => {
        console.error(message);
        logFile.write(`${new Date().toISOString()} - ERROR: ${message}\n`);
    }
};

module.exports = logger;