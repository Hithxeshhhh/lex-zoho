require('dotenv').config();
const axios = require('axios');
const { getZohoOAuthToken } = require('../config/zohoAuth');

const {
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_LEAD_API,
    ZOHO_DEAL_API,
    LEX_UPDATE_ZOHO_API
} = process.env;

// Getting customer details using Lex API
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

// Getting Zoho Lead details from Zoho LEAD API
const getZohoLeadDetails = async (zohoLeadId) => {
    try {
        const url = `${ZOHO_LEAD_API}/${zohoLeadId}`;
        const accessToken = await getZohoOAuthToken();
        const headers = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        };
        console.log(`API Called for Zoho Lead detail: ${url}`);
        const response = await axios.get(url, { headers });
        return response.data.data[0];
    } catch (error) {
        throw new Error(`Failed to fetch Zoho Lead Details: ${error.message}`);
    }
};

// Creating Zoho Deal data to Zoho
const createZohoDeal = async (payload) => {
    try {
        const accessToken = await getZohoOAuthToken();
        const headers = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.post(ZOHO_DEAL_API, payload, { headers });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to create Zoho deal: ${error}`);
    }
};

const updateCustomerDetails = async (customerId, zohoLeadId, zohoDealId) => {
    try {
        const url = `${LEX_UPDATE_ZOHO_API}Customer_Id=${customerId}&Zoho_Lead_Id=${zohoLeadId}&Zoho_Deal_Id=${zohoDealId}`;
        const headers = {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to update customer details: ${error.message}`);
    }
};

exports.createDealController = async (req, res) => {
    try {
        const customerIds = req.body.customerIds; // Expecting an array of customer IDs

        if (!Array.isArray(customerIds) || customerIds.length === 0) {
            return res.status(400).json({ error: 'customerIds must be a non-empty array' });
        }

        const results = [];

        for (const customerId of customerIds) {
            try {
                console.log(`API Called for customer detail: ${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`);

                const customerDetails = await getCustomerDetails(customerId);

                // Add debug logs
                console.log('Customer Details:', JSON.stringify(customerDetails, null, 2));
                console.log('Customer Status:', customerDetails[0]?.status);

                if (!customerDetails[0]?.status || customerDetails[0].status.toLowerCase() !== "active") {
                    console.log(`Cannot create deal for customer ${customerId}: Status is ${customerDetails[0]?.status}`);
                    results.push({
                        customerId,
                        error: "Cannot create deal",
                        message: "Customer status is not active",
                        status: customerDetails[0]?.status
                    });
                    continue;
                }

                const zohoLeadId = customerDetails[0]?.Zoho_Lead_ID;

                if (!zohoLeadId) {
                    results.push({
                        customerId,
                        error: "Cannot create deal",
                        message: "Zoho Lead ID not found for this customer"
                    });
                    continue;
                }

                console.log(`LEX Customer Detail API Zoho ID: ${zohoLeadId}`);
                const zohoLeadDetails = await getZohoLeadDetails(zohoLeadId);

                const contactName = `${customerDetails[0].name} ${customerDetails[0].last_name}`;
                const dealName = contactName;
                const payload = {
                    data: [{
                        Deal_Name: dealName,
                        Cust_ID: customerDetails[0].id.toString(),
                        Customer_ID: customerId,
                        Customer_Type: customerDetails[0].account_type,
                        Type_of_Business1: customerDetails[0].type_of_business,
                        Type_of_business: customerDetails[0].type_of_business,
                        Stage: "Closed Won",
                        Market_Place: [customerDetails[0].account_type || ""],
                        Weight_Package: zohoLeadDetails.Weight_Package || null,
                        No_of_shipments1: 0,
                        Description: null,
                        Expectations_of_the_customer_for_Services_Quot: zohoLeadDetails.Expectations_of_the_customer_for_Services_Quot || null,
                        Competitors: null,
                        Territory: null,
                        Major_Destinations1: null,
                        Sales_Cycle_Duration: 0,
                        Overall_Sales_Duration: 0,
                        Seller_ID1: null
                    }]
                };
                console.log(`Payload being sent to Zoho Deals API: ${JSON.stringify(payload, null, 2)}`);

                const zohoDealResponseData = await createZohoDeal(payload);
                const createdDealId = zohoDealResponseData.data[0].details.id;

                console.log(`Updating customer details with Deal ID: ${createdDealId}`);

                const customerUpdateResponse = await updateCustomerDetails(customerId, zohoLeadId, createdDealId);

                results.push({
                    customerId,
                    status: 'success',
                    data: customerUpdateResponse
                });
            } catch (err) {
                console.error(`Error creating deal for customer ${customerId}:`, err);
                results.push({
                    customerId,
                    error: 'Failed to create deal',
                    details: err.message
                });
            }
        }

        res.status(200).json({ results });
    } catch (err) {
        console.error('Error processing multiple deals:', err);
        res.status(500).json({ error: 'Failed to process multiple deals', details: err.message });
    }
};