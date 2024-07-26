require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; 
const path = require('path');

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
    const { Customer_id: customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer_id is required' });
    }

    const { LEX_CUSTOMER_DETAIL_API, BEARER_TOKEN, ZOHO_LEAD_API, ZOHO_OAUTH_TOKEN } = process.env;

    const customerDetailsResponse = await axios.get(`${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const customerDetails = customerDetailsResponse.data[0];
    if (!customerDetails) {
      return res.status(404).json({ error: 'Customer details not found' });
    }

    const payload = {
      data: [
        {
          Cust_ID: customerDetails.id,
          First_Name: customerDetails.name,
          Company: customerDetails.company_name,
          Last_Name: customerDetails.last_name,
          Email: customerDetails.email,
          Phone: customerDetails.mobile,
          Type_of_business: customerDetails.type_of_business
        }
      ]
    };
    console.log(`Payload sent to Zoho Lead API  ${JSON.stringify(payload, null, 2)}`)
    const zohoResponse = await axios.post(ZOHO_LEAD_API, payload, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    const { data: zohoResponseData } = zohoResponse;
    let customerUpdateResponse;
    if (zohoResponseData.data && zohoResponseData.data.length > 0) {
      const leadId = zohoResponseData.data[0].details.id;
      
      customerUpdateResponse = await updateCustomerDetails(customerId, leadId)
      const filePath = path.join(__dirname, '../leadsInfo', 'leadDetails.txt');
      console.log(filePath);

      await fs.appendFile(filePath, `${leadId}\n`, 'utf8');
    }
    res.status(200).json(customerUpdateResponse);
  } catch (error) {
    console.error('Error creating lead:', error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({
      error: 'An error occurred while creating the lead',
      details: error.response ? error.response.data : error.message
    });
  }
};
