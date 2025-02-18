require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');

const { ZOHO_ACCOUNTS_API } = process.env;

if (!ZOHO_ACCOUNTS_API) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.')
}

exports.getAccountController = async (req, res) => {
    try {
        const { accountIds } = req.body;

        // Validating request parameters
        if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
            return res.status(400).json({ error: 'accountIds array is required' });
        }

        // Get fresh access token
        const accessToken = await zohoAuth.getAccessToken();

        // Process all account requests in parallel
        const results = await Promise.all(accountIds.map(async (accountId) => {
            try {
                const accountResponse = await axios.get(`${ZOHO_ACCOUNTS_API}/${accountId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                return {
                    accountId,
                    success: true,
                    customerId: accountResponse.data.data[0].Customer_ID,
                    data: accountResponse.data
                };
            } catch (error) {
                return {
                    accountId,
                    success: false,
                    error: error.response?.data || error.message
                };
            }
        }));

        res.status(200).json({
            success: true,
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });

    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch accounts',
            details: error.message
        });
    }
};