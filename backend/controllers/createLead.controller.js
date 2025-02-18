require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { getZohoOAuthToken } = require('../config/zohoAuth');

const updateCustomerDetails = async (customerId, zohoLeadId) => {
  try {
    const url = `${process.env.LEX_UPDATE_ZOHO_API}Customer_Id=${customerId}&Zoho_Lead_Id=${zohoLeadId}`;
    const headers = {
      'Authorization': `Bearer ${process.env.BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    };
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update customer details: ${error.message}`);
  }
};

exports.createLeadController = async (req, res) => {
  try {
    const customerIds = req.body.customerIds; // Expecting an array of customer IDs

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'customerIds must be a non-empty array' });
    }

    const results = [];

    for (const customerId of customerIds) {
      try {
        console.log(`API Called for customer detail: ${process.env.LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`);

        const customerDetailsResponse = await axios.get(`${process.env.LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        const customerDetails = customerDetailsResponse.data[0];
        if (!customerDetails) {
          results.push({
            customerId,
            error: 'Customer details not found'
          });
          continue;
        }

        // Get registered address from the second array
        const billingAddress = customerDetailsResponse.data[1]?.find(addr => addr.label === "Billing Address");

        const payload = {
          data: [
            {
              Cust_ID: customerDetails.id.toString(),
              First_Name: customerDetails.name,
              Company: customerDetails.company_name,
              Last_Name: customerDetails.last_name,
              Email: customerDetails.email,
              Phone: customerDetails.mobile,
              Mobile: customerDetails.mobile,
              Type_of_business: customerDetails.type_of_business,
              Secondary_Email: customerDetails.email,
              // Add registered address fields
              Street: billingAddress?.street || null,
              City: billingAddress?.city || null,
              State: billingAddress?.state || null,
              Zip_Code: billingAddress?.postal_code || null,
              Country: billingAddress?.country_code || null
            }
          ]
        };

        console.log(`Payload sent to Zoho Lead API  ${JSON.stringify(payload, null, 2)}`);

        const accessToken = await getZohoOAuthToken();
        const zohoResponse = await axios.post(process.env.ZOHO_LEAD_API, payload, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          }
        });

        const { data: zohoResponseData } = zohoResponse;
        let customerUpdateResponse;
        if (zohoResponseData.data && zohoResponseData.data.length > 0) {
          const leadId = zohoResponseData.data[0].details.id;

          customerUpdateResponse = await updateCustomerDetails(customerId, leadId);
          const filePath = path.join(__dirname, '../leadsInfo', 'leadDetails.txt');
          console.log(filePath);

          await fs.appendFile(filePath, `${leadId}\n`, 'utf8');
        }
        results.push({
          customerId,
          status: 'success',
          data: customerUpdateResponse
        });
      } catch (error) {
        console.error(`Error creating lead for customer ${customerId}:`, error);
        results.push({
          customerId,
          error: 'Failed to create lead',
          details: error.response ? error.response.data : error.message
        });
      }
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error processing multiple leads:', error);
    res.status(500).json({ error: 'Failed to process multiple leads', details: error.message });
  }
};