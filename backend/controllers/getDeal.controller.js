require('dotenv').config();
const axios = require('axios');

const { ZOHO_DEAL_API, ZOHO_OAUTH_TOKEN } = process.env;

if (!ZOHO_DEAL_API || !ZOHO_OAUTH_TOKEN) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.getDealController = async (req, res) => {
    try {
        const { Zoho_Deal_Id: zohoDealId } = req.params;

        //Validating request parameters
        if (!zohoDealId) {
            return res.status(400).json({ error: 'Zoho deal id is required' });
        }

        //Calling the deal get api serving zoho deal id to it
        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${zohoDealId}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json',
            }
        });

        return res.status(200).json(dealResponse.data);
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
};
