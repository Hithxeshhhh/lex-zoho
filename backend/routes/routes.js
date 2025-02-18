const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config();

const { createLeadController } = require('../controllers/createLead.controller');
const { createDealController } = require('../controllers/createDeal.controller');
const { getLeadController } = require('../controllers/getLead.controller');
const { updateLeadController } = require('../controllers/updateLead.controller');
const { updateDealController } = require('../controllers/updateDeal.controller');
const { getDealController } = require('../controllers/getDeal.controller');
const { createAccountController } = require('../controllers/createAccount.controller');
const { getAccountController } = require('../controllers/getAccount.controller');
const { updateAccountController } = require('../controllers/updateAccount.controller');
const { createShipmentController } = require('../controllers/createShipment.controller');
const { getShipmentController } = require('../controllers/getShipment.controller');
const { updateShipmentController } = require('../controllers/updateShipment.controller');
const { updateDetailstoZohoController } = require('../controllers/updateDetailstoZoho.controller');

// Import the middleware
const basicAuthMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Use the middleware for the routes that need Basic Auth
router.use(basicAuthMiddleware);

router.get('/test', (req, res) => {
    res.json({ message: 'Testing page' });
});

router.post('/create-lead', createLeadController);
router.put('/update-lead', updateLeadController);
router.get('/get-lead', getLeadController);
router.post('/create-deal', createDealController);
router.put('/update-deal', updateDealController);
router.get('/get-deal', getDealController);
router.post('/create-account', createAccountController);
router.get('/get-account', getAccountController);
router.put('/update-account', updateAccountController);
router.post('/create-shipment', createShipmentController);
router.get('/get-shipment', getShipmentController);
router.put('/update-shipment', updateShipmentController);
router.post('/update-details-to-zoho', upload.single('file'), updateDetailstoZohoController);

module.exports = router;
