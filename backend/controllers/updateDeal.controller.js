require('dotenv').config();
const axios = require('axios');

const { ZOHO_DEAL_API, ZOHO_OAUTH_TOKEN } = process.env;

exports.updateDealController = async (req, res) => {
    try {
        const dataToUpdate = req.body;
        const zohoDealId = req.params.Zoho_Deal_Id;

        const payload = {
            data: [{ ...dataToUpdate }]
        };

        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json'
        };

        const updateResponse = await axios.put(`${ZOHO_DEAL_API}/${zohoDealId}`, payload, { headers });

        res.status(updateResponse.status).json(updateResponse.data);
    } catch (error) {
        console.error('Error updating deal:', error);
        res.status(500).json({ error: 'Failed to update deal', details: error.message });
    }
};
