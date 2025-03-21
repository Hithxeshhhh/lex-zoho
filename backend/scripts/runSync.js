require('dotenv').config();
const { syncShipments } = require('../shipmentSyncCron');

console.log('Starting manual shipment sync...');
syncShipments()
    .then(() => {
        console.log('Manual sync completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during manual sync:', error);
        process.exit(1);
    }); 