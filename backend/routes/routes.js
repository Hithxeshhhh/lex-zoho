const express = require('express')
const multer = require('multer');

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
const router= express.Router()

const upload = multer({ dest: 'uploads/' }); // Store uploaded files in 'uploads/' directory


router.get('/test', (req, res) => {
    res.json({ message: 'Testing page' });
});


router.post('/create-lead/:Customer_id', createLeadController);
router.put('/update-lead/:Zoho_id', updateLeadController);
router.get('/get-lead/:Zoho_id', getLeadController);
router.post('/create-deal/:Customer_id/', createDealController);
router.put('/update-deal/:dealId', updateDealController);
router.get('/get-deal/:Zoho_Deal_Id', getDealController);
router.post('/create-account/:Customer_id', createAccountController);
router.get('/get-account', getAccountController);
router.put('/update-account', updateAccountController);
router.post('/create-shipment', createShipmentController);
router.get('/get-shipment', getShipmentController);
router.put('/update-shipment', updateShipmentController);
router.post('/update-details-to-zoho', upload.single('file'), updateDetailstoZohoController);

module.exports = router;