require('dotenv').config();
const axios = require('axios');

const { ZOHO_LEAD_API, ZOHO_OAUTH_TOKEN } = process.env;

if (!ZOHO_LEAD_API || !ZOHO_OAUTH_TOKEN) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.updateLeadController = async (req, res) => {
    try {
        const { Zoho_id: zohoId } = req.params;
        if (!zohoId) {
            return res.status(400).json({ error: 'Zoho id is required' });
        }

        const toBeUpdatedData = req.body;
        if (Object.keys(toBeUpdatedData).length === 0) {
            return res.status(400).json({ error: 'No data provided to update' });
        }

        const payload = {
            data: [
                {
                    id: zohoId,
                    ...toBeUpdatedData
                }
            ]
        };

        console.log(`Updating lead with data: ${JSON.stringify(payload)}`);
        console.log(`API Endpoint: ${ZOHO_LEAD_API}/${zohoId}`);

        const leadResponse = await axios.put(`${ZOHO_LEAD_API}/${zohoId}`, payload, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json',
            }
        });

        return res.status(leadResponse.status).json(leadResponse.data);
    } catch (error) {
        console.error('Error updating Zoho lead:', error);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error updating Zoho lead',
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
};
