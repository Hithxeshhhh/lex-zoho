require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');

const { ZOHO_LEAD_API } = process.env;

if (!ZOHO_LEAD_API) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.');
}

exports.getLeadController = async (req, res) => {
    try {
        const { Zoho_Ids: zohoIds } = req.body; // Expecting an array of Zoho Lead IDs

        // Validating request parameters
        if (!Array.isArray(zohoIds) || zohoIds.length === 0) {
            return res.status(400).json({ error: 'Zoho_Ids must be a non-empty array' });
        }

        const results = [];

        for (const zohoId of zohoIds) {
            try {
                console.log(`Fetching lead details for Zoho Lead ID: ${zohoId}`);

                // Get a fresh access token
                const accessToken = await zohoAuth.getAccessToken();

                const leadResponse = await axios.get(`${ZOHO_LEAD_API}/${zohoId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    }
                });

                results.push({
                    zohoId,
                    status: 'success',
                    data: leadResponse.data
                });
            } catch (error) {
                console.error(`Error fetching Zoho lead for ID ${zohoId}:`, error);

                if (error.response) {
                    results.push({
                        zohoId,
                        error: 'Error fetching Zoho lead',
                        message: error.response.data
                    });
                } else if (error.request) {
                    results.push({
                        zohoId,
                        error: 'No response received from Zoho API',
                        message: error.message
                    });
                } else {
                    results.push({
                        zohoId,
                        error: 'Internal server error',
                        message: error.message
                    });
                }
            }
        }

        return res.status(200).json({ results });
    } catch (error) {
        console.error('Error processing multiple leads:', error);
        return res.status(500).json({ error: 'Failed to process multiple leads', details: error.message });
    }
};