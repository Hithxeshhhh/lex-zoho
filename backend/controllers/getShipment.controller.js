require('dotenv').config();
const axios = require('axios')

const {
    ZOHO_SHIPMENTS_API,
    ZOHO_OAUTH_TOKEN
} = process.env

if (!ZOHO_SHIPMENTS_API || !ZOHO_OAUTH_TOKEN) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.getShipmentController = async (req, res) => {
    try {
        const { Zoho_Shipment_id: zohoShipmentId } = req.params;

        //Validating request paramenters
        if (!zohoShipmentId) {
            return res.status(400).json({ error: 'Zoho shipment id is required' });
        }

        //Calling the shipment get api serving zoho shipment id to it 
        const shipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return res.status(200).json(shipmentResponse.data);
    } catch (error) {
        console.error('Error fetching Zoho deal:', error);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error fetching Zoho deal',
                message: error.response.data
            });
        } else if (error.request) {
            return res.status(500).json({
                error: 'No response received from Zoho API',
                message: error.message
            });
        } else {
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
}