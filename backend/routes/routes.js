const express = require('express');
const multer = require('multer');
const { authenticateUser, verifyToken } = require('../controllers/authController');
const { createLeadController } = require('../controllers/createLead.controller');
const { updateLeadController } = require('../controllers/updateLead.controller');
const { getLeadController } = require('../controllers/getLead.controller');
const { createDealController } = require('../controllers/createDeal.controller');
const { updateDealController } = require('../controllers/updateDeal.controller');
const { getDealController } = require('../controllers/getDeal.controller');
const { createAccountController } = require('../controllers/createAccount.controller');
const { updateAccountController } = require('../controllers/updateAccount.controller');
const { getAccountController } = require('../controllers/getAccount.controller');
const { createShipmentController } = require('../controllers/createShipment.controller');
const { updateShipmentController } = require('../controllers/updateShipment.controller');
const { getShipmentController } = require('../controllers/getShipment.controller');
const { updateDetailstoZohoController } = require('../controllers/updateDetailstoZoho.controller');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Auth Routes
router.post('/login', authenticateUser);

router.get('/test', verifyToken,(req, res) => {
    res.json({ message: 'Testing page' });
});

// Protected Routes (Require Token)
router.post('/create-lead', verifyToken, createLeadController);
router.put('/update-lead', verifyToken, updateLeadController);
router.get('/get-lead', verifyToken, getLeadController);

router.post('/create-deal', verifyToken, createDealController);
router.put('/update-deal', verifyToken, updateDealController);
router.get('/get-deal', verifyToken, getDealController);

router.post('/create-account', verifyToken, createAccountController);
router.get('/get-account', verifyToken, getAccountController);
router.put('/update-account', verifyToken, updateAccountController);

router.post('/create-shipment', verifyToken, createShipmentController);
router.get('/get-shipment', verifyToken, getShipmentController);
router.put('/update-shipment', verifyToken, updateShipmentController);

router.post('/update-details-to-zoho', verifyToken, upload.single('file'), updateDetailstoZohoController);

module.exports = router;