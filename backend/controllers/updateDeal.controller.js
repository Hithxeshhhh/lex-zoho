require('dotenv').config();
const axios = require('axios');

const {
    ZOHO_DEAL_API,
    ZOHO_OAUTH_TOKEN,
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

exports.updateDealController = async (req, res) => {
    try {
        const { dealId } = req.params;
        
        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required' });
        }

        // First get deal details to get Customer_ID
        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${dealId}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const customerId = dealResponse.data.data[0]?.Customer_ID;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID not found in deal details' });
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

        const response = await axios.put(`${ZOHO_DEAL_API}`, payload, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error updating deal:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json({
            error: 'Failed to update deal',
            details: error.response ? error.response.data : error.message
        });
    }
};
