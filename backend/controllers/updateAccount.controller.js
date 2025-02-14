require('dotenv').config();
const axios = require('axios');

const {
    ZOHO_ACCOUNTS_API,
    ZOHO_OAUTH_TOKEN,
    LEX_CUSTOMER_DETAIL_API,
    LEX_UPDATE_ZOHO_API,
    BEARER_TOKEN
} = process.env;

// Add the delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
const constructPayload = (customerId, customerDetails) => {
    const addresses = Array.isArray(customerDetails[1]) ? customerDetails[1] : [];
    const additionalInfo = Array.isArray(customerDetails[2]) ? customerDetails[2] : [];
    
    const billingAddressObject = addresses.find(item => item.label === "Billing Address");
    const shippingAddressObject = addresses.find(item => item.label === "Registered Address");
    const gstNumberObject = additionalInfo.find(item => item.key === "gst_number");
    const iecCodeObject = additionalInfo.find(item => item.key === "iec_code");
    const marketPlaceObject = additionalInfo.find(item => item.key === "market_place_presence");
    const productTypeObject = additionalInfo.find(item => item.key === "product_type_commodity");
    
    return {
        data: [
            {
                Adcode: customerDetails[0]?.adcode || "",
                Bank_Account_Number: customerDetails[0]?.bank_account || "",
                Cust_Id: customerId,
                Customer_ID: customerId,
                Mobile: customerDetails[0]?.mobile || "",
                Email: customerDetails[0]?.email || "",
                IFSC_Code: customerDetails[0]?.ifsc_code || "",
                // Market_Place: Array.isArray(marketPlaceObject?.value) ? marketPlaceObject.value : [],
                // Competitors: dealDetails?.Competitors || "",
                No_of_shipments: String(customerDetails[0]?.total_booking || ""),
                // Major_Destinations1: dealDetails?.Major_Destinations1 || "",
                // Expectations_of_the_customer_for_Services_Quot: dealDetails?.Expectations_of_the_customer_for_Services_Quot || "",
                // Weight_Package: dealDetails?.Weight_Package || "",
                Type_of_business: customerDetails[0]?.type_of_business || "",
                // Locked__s: dealDetails?.Locked__s || false,
                // Tag: dealDetails?.Tag || "",
                Category:null,
                // Prospect_Name: customerDetails[0]?.Deal_Name ? BigInt(customerDetails[0].Deal_Name) : null,
                // Prospect_Stage: dealDetails?.Stage || "",
                Account: String(customerDetails[0]?.account || ""),
                Account_Name: customerDetails[0]?.company_name || "",
                Account_Status: customerDetails[0]?.status || "",
                Account_Type1: String(customerDetails[0]?.acc_type || ""),
                Billing_City: billingAddressObject?.city || "",
                Billing_Code: billingAddressObject?.postal_code || "",
                Billing_Country: billingAddressObject?.country_code || "",
                Billing_State: billingAddressObject?.state || "",
                Billing_Street: billingAddressObject?.street || "",
                // GST_Certificate: null,
                GST_Number: gstNumberObject?.value || "",
                // IEC_Certificate: null,
                IEC_Code: iecCodeObject?.value || "",
                // LUT_Certificate: null,
                LUT_Expiration_Date: customerDetails[0]?.LUT_Expiration_Date || "",
                // Sales_Person_Name: null,
                Seller_ID: customerDetails[0]?.seller_id || "LEX", 
                Shipping_City: shippingAddressObject?.city || "",
                Shipping_Code: shippingAddressObject?.postal_code || "",
                Shipping_Country: shippingAddressObject?.country_code || "",
                Shipping_State: shippingAddressObject?.state || "",
                Shipping_Street: shippingAddressObject?.street || "",
                // Upload_Address_Proof: null,
                // Upload_Identity_Proof: null,
            }
        ]
    };
};

const updateZohoCustomerId = async (customerId, zohoCustomerId) => {
    try {
        const url = `${LEX_UPDATE_ZOHO_API}Customer_Id=${customerId}&Zoho_Cust_Id=${zohoCustomerId}`;
        const headers = {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        
        const response = await axios.get(url, { headers });
        console.log(`Updated Zoho Customer ID for Customer_Id: ${customerId}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to update Zoho Customer ID for Customer_Id: ${customerId}, Error: ${error.message}`);
        throw new Error(`Failed to update Zoho Customer ID: ${error.message}`);
    }
};

const processBatch = async (accountIdsBatch) => {
    try {
        const results = [];
        for (const zohoAccountId of accountIdsBatch) {
            try {
                await delay(100);

                console.log(`Processing account ID: ${zohoAccountId}`);
                
                // Get account details to fetch Customer_ID
                const accountResponse = await axios.get(`${ZOHO_ACCOUNTS_API}/${zohoAccountId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                const customerId = accountResponse.data.data[0].Customer_ID;
                const customerDetails = await getCustomerDetails(customerId);
                const payload = constructPayload(customerId, customerDetails);

                // Update account
                const updateResponse = await axios.put(
                    `${ZOHO_ACCOUNTS_API}/${zohoAccountId}`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                // Update Zoho Customer ID in LEX
                await updateZohoCustomerId(customerId, zohoAccountId);

                results.push({ accountId: zohoAccountId, status: 'success', data: updateResponse.data });
            } catch (error) {
                console.error(`Error updating account ${zohoAccountId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
                results.push({ accountId: zohoAccountId, status: 'error', error: error.message });
            }
        }
        return results;
    } catch (error) {
        throw new Error(`Batch processing failed: ${error.message}`);
    }
};

exports.updateAccountController = async (req, res) => {
    try {
        const { accountIds } = req.body;
        
        if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
            return res.status(400).json({ error: 'accountIds array is required in request body' });
        }

        const results = await processBatch(accountIds);

        res.status(200).json({
            success: true,
            updated: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results
        });

    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Failed to process updates',
            details: error.message 
        });
    }
};
