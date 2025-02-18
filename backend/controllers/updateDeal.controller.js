require('dotenv').config();
const axios = require('axios');
const { getZohoOAuthToken } = require('../config/zohoAuth');

const {
    ZOHO_DEAL_API,
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN
} = process.env;

// Function to get customer details from LEX API
const getCustomerDetails = async (customerId) => {
    try {
        const url = `${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`;
        const headers = {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch customer details: ${error.message}`);
    }
};

const processDeal = async (dealId) => {
    try {
        // Get fresh access token
        const accessToken = await getZohoOAuthToken();

        // First get deal details to get Customer_ID
        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${dealId}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const customerId = dealResponse.data.data[0]?.Customer_ID;
        if (!customerId) {
            throw new Error('Customer ID not found in deal details');
        }

        // Get customer details for the name and sellerId
        const customerDetails = await getCustomerDetails(customerId);
        const contactName = `${customerDetails[0]?.name} ${customerDetails[0]?.last_name}`;

        const payload = {
            data: [{
                id: dealId,
                // Contact_Name: {
                //     name: contactName
                // },
                Seller_ID1: customerDetails[0]?.SellerId || ""  // Correct case: SellerId
            }]
        };

        // Get a fresh access token for the update request
        const updateAccessToken = await getZohoOAuthToken();

        const response = await axios.put(`${ZOHO_DEAL_API}`, payload, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${updateAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { dealId, status: 'success', data: response.data };
    } catch (error) {
        console.error(`Error updating deal ${dealId}:`, error.response ? error.response.data : error.message);
        return { dealId, status: 'error', error: error.message };
    }
};

exports.updateDealController = async (req, res) => {
    try {
        const { dealIds } = req.body; // Expecting an array of deal IDs

        if (!Array.isArray(dealIds) || dealIds.length === 0) {
            return res.status(400).json({ error: 'dealIds must be a non-empty array' });
        }

        const results = [];

        for (const dealId of dealIds) {
            const result = await processDeal(dealId);
            results.push(result);
        }

        res.status(200).json({ results });
    } catch (error) {
        console.error('Error processing multiple deals:', error);
        res.status(500).json({ error: 'Failed to process multiple deals', details: error.message });
    }
};