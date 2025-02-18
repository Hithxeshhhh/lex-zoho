require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');

const {
    ZOHO_SHIPMENTS_API
} = process.env;

if (!ZOHO_SHIPMENTS_API) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.getShipmentController = async (req, res) => {
    try {
        const { shipmentIds } = req.body;

        // Validating request parameters
        if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).json({ error: 'shipmentIds array is required' });
        }

        // Get fresh access token
        const accessToken = await zohoAuth.getAccessToken();

        // Calling the shipment get API for each shipment ID
        const promises = shipmentIds.map(async (zohoShipmentId) => {
            try {
                const shipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                return { zohoShipmentId, data: shipmentResponse.data };
            } catch (error) {
                return { zohoShipmentId, error: error.response ? error.response.data : error.message };
            }
        });

        const results = await Promise.all(promises);

        // Send Response
        res.status(200).json({ message: 'Batch processing completed', results });
    } catch (error) {
        console.error('Error fetching shipments:', error.message);
        res.status(500).json({ error: `Failed to fetch shipment details: ${error.message}` });
    }
};