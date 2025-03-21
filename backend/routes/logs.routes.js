const express = require('express');
const router = express.Router();

// Everything is protected with the middleware which is verifyToken

const { downloadLogsByDate, getAvailableLogDates } = require('../controllers/logDownload.controller');
const { authenticateUser, verifyToken } = require('../controllers/authController');
const { toggleLogging, getLoggingStatus } = require('../controllers/updateShipment.controller');
// or you could use the createShipment controller, they both share the same LoggingManager now

// Get available log dates
router.get('/logs/dates', verifyToken, getAvailableLogDates);

// Download logs for a specific date
router.get('/logs/download', verifyToken, downloadLogsByDate);

// Add these new routes for the logging feature
router.post('/logging/toggle', verifyToken, toggleLogging);
router.get('/logging/status', verifyToken, getLoggingStatus);

module.exports = router; 