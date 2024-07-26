require('dotenv').config();
const axios = require('axios');

const {
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_LEAD_API,
    ZOHO_DEAL_API,
    ZOHO_OAUTH_TOKEN,
    LEX_UPDATE_ZOHO_API
} = process.env;

const getCustomerDetails = async (customerId) => {
    try {
        const url = `${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`;
        const headers = {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data[0];
    } catch (error) {
        throw new Error(`Failed to fetch customer details: ${error.message}`);
    }
};

const getZohoLeadDetails = async (zohoLeadId) => {
    try {
        const url = `${ZOHO_LEAD_API}/${zohoLeadId}`
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json'
        }
        console.log(`API Called for Zoho Lead detail: ${url}`);
        const response = await axios.get(url,{ headers });
        return response.data.data[0];
    } catch (error) {
        throw new Error(`Failed to fetch Zoho Lead Details : ${error.message}`);
    }
}

const createZohoDeal = async (payload) => {
    try {
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
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
        const reqBodyData = req.body;
        const customerId = req.params.Customer_id;

        console.log(`API Called for customer detail: ${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`);

        const customerDetails = await getCustomerDetails(customerId);

        const zohoLeadId = customerDetails.Zoho_Lead_ID;
        const zohoLeadDetails = await getZohoLeadDetails(zohoLeadId)
        console.log(`LEX Customer Detail API Zoho ID: ${zohoLeadId}`);

        const contactName = `${customerDetails.name} ${customerDetails.last_name}`;
        //creating deal name with specific template and sending it to the payload
        const dealName = `LEXSHIP_${customerId}`;
        const payload = {
            data: [{
                id: zohoLeadId,
                ...reqBodyData,
                Cust_ID: customerDetails.id.toString(),
                Deal_Name : dealName,
                Customer_ID: zohoLeadId,
                Customer_Type: customerDetails.account_type,
                Account_Name: contactName,
                Type_of_business: customerDetails.type_of_business,
                Expectations_of_the_customer_for_Services_Quot: zohoLeadDetails.Expectations_of_the_customer_for_Services_Quot,
                No_of_shipments1: zohoLeadDetails.No_of_shipments,
                Weight_Package: zohoLeadDetails.Weight_Package,
                Competitors: zohoLeadDetails.Competitors,
                Market_Place: zohoLeadDetails.Market_Place1,
                Locked__s: zohoLeadDetails.Locked__s,
                Lead_Source: zohoLeadDetails.Lead_Source
            }]
        };
        console.log(`Payload being sent to Zoho Deals API: ${JSON.stringify(payload, null, 2)}`);

        const zohoDealResponseData = await createZohoDeal(payload);
        const createdDealId = zohoDealResponseData.data[0].details.id;

        console.log(`Updating customer details with Deal ID: ${createdDealId}`);

        const customerUpdateResponse = await updateCustomerDetails(customerId, zohoLeadId, createdDealId);

        res.status(200).json(customerUpdateResponse);
    } catch (err) {
        console.error('Error creating deal:', err);
        res.status(400).json({ error: 'Failed to create deal', details: err.message });
    }
};