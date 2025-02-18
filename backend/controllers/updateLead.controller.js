require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');

const { ZOHO_LEAD_API } = process.env;

if (!ZOHO_LEAD_API) {
    throw new Error('Zoho Lead API configuration is missing. Please check environment variables.');
}

const processLead = async (zohoId, toBeUpdatedData) => {
    try {
        // Get fresh access token
        const accessToken = await zohoAuth.getAccessToken();

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
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        return { zohoId, status: 'success', data: leadResponse.data };
    } catch (error) {
        console.error(`Error updating Zoho lead ${zohoId}:`, error);

        if (error.response) {
            return {
                zohoId,
                status: 'error',
                error: 'Error updating Zoho lead',
                message: error.response.data
            };
        } else if (error.request) {
            return {
                zohoId,
                status: 'error',
                error: 'No response received from Zoho API',
                message: error.message
            };
        } else {
            return {
                zohoId,
                status: 'error',
                error: 'Internal server error',
                message: error.message
            };
        }
    }
};

exports.updateLeadController = async (req, res) => {
    try {
        const { Zoho_ids: zohoIds } = req.body; // Expecting an array of Zoho Lead IDs
        const toBeUpdatedData = req.body.data; // Data to be updated

        if (!Array.isArray(zohoIds) || zohoIds.length === 0) {
            return res.status(400).json({ error: 'Zoho_ids must be a non-empty array' });
        }

        if (Object.keys(toBeUpdatedData).length === 0) {
            return res.status(400).json({ error: 'No data provided to update' });
        }

        const results = [];

        for (const zohoId of zohoIds) {
            const result = await processLead(zohoId, toBeUpdatedData);
            results.push(result);
        }

        res.status(200).json({ results });
    } catch (error) {
        console.error('Error processing multiple leads:', error);
        res.status(500).json({ error: 'Failed to process multiple leads', details: error.message });
    }
};