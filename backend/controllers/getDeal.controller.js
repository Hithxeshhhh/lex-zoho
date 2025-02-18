require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');

const { ZOHO_DEAL_API } = process.env;

if (!ZOHO_DEAL_API) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.getDealController = async (req, res) => {
    try {
        const { Zoho_Deal_Ids: zohoDealIds } = req.body; // Expecting an array of Zoho Deal IDs

        // Validating request parameters
        if (!Array.isArray(zohoDealIds) || zohoDealIds.length === 0) {
            return res.status(400).json({ error: 'Zoho_Deal_Ids must be a non-empty array' });
        }

        const results = [];

        for (const zohoDealId of zohoDealIds) {
            try {
                console.log(`Fetching deal details for Zoho Deal ID: ${zohoDealId}`);

                // Get a fresh access token
                const accessToken = await zohoAuth.getAccessToken();

                // Calling the deal get API serving Zoho Deal ID to it
                const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${zohoDealId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    }
                });

                results.push({
                    zohoDealId,
                    status: 'success',
                    data: dealResponse.data
                });
            } catch (error) {
                console.error(`Error fetching Zoho deal for ID ${zohoDealId}:`, error);

                if (error.response) {
                    results.push({
                        zohoDealId,
                        error: 'Error fetching Zoho deal',
                        message: error.response.data
                    });
                } else if (error.request) {
                    results.push({
                        zohoDealId,
                        error: 'No response received from Zoho API',
                        message: error.message
                    });
                } else {
                    results.push({
                        zohoDealId,
                        error: 'Internal server error',
                        message: error.message
                    });
                }
            }
        }

        return res.status(200).json({ results });
    } catch (error) {
        console.error('Error processing multiple deals:', error);
        return res.status(500).json({ error: 'Failed to process multiple deals', details: error.message });
    }
};