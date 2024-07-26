require('dotenv').config();
const axios = require('axios')

const {
    ZOHO_OAUTH_TOKEN,
    ZOHO_SHIPMENTS_API
} = process.env

exports.updateShipmentController = async (req, res) => {
    try {
        // Validate request parameters
        const { Zoho_Shipment_id: zohoShipmentId } = req.params;
        if (!zohoShipmentId) {
            res.status(400).send('zoho shipment id is required')
        }

        //Validate request body
        const toBeUpdated = req.body;
        if (!toBeUpdated || Object.keys(toBeUpdated).length === 0) {
            return res.status(400).send('Request body is required');
        }

        // Construct Payload
        const payload = {
            data: [
                {
                    ...toBeUpdated
                }
            ]
        };

        // Make API call to update shipments
        const updateShipmentApiResponse = await axios.put(
            `${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`,
            payload,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Log successful API resposne
        console.log('Successfully updated shipments', updateShipmentApiResponse.data);

        // Send Response
        res.status(200).send(updateShipmentApiResponse.data);
    } catch (error) {
        //Log error and send appropriate response
        console.error('Error update shipments', error.message)
        res.status(500).send(`Failed to update shipment details ${error}`);
    }
}