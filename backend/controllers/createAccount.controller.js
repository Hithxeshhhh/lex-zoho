require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_DEAL_API,
    ZOHO_OAUTH_TOKEN,
    ZOHO_ACCOUNTS_API
} = process.env;

// Fetching Customer details from Lex customer detail API
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

// Fetching Zoho Deal details from Zoho deal API
const getZohoDealDetails = async (zohoDealId) => {
    try {
        const url = `${ZOHO_DEAL_API}/${zohoDealId}`;
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data.data[0];
    } catch (error) {
        throw new Error(`Failed to fetch Zoho deal details: ${error.message}`);
    }
};

// Creating a Zoho account using Zoho accounts API
const createZohoAccount = async (payload) => {
    try {
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.post(ZOHO_ACCOUNTS_API, payload, { headers });
        return response.data;
    } catch (error) {
        console.error("Error response from Zoho:", JSON.stringify(error.response?.data, null, 2));
        throw new Error(`Failed to create Zoho account: ${error.response?.data?.message || error.message}`);
    }
};

// Constructing payload to send to create an account
const constructPayload = (customerId, zohoDealId, reqBodyData, customerDetails, dealDetails) => {
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
                Account: String(customerDetails[0]?.account || ""),
                Account_Name: customerDetails[0]?.company_name || "",
                Account_Type1: String(customerDetails[0]?.acc_type || ""),
                Adcode: customerDetails[0]?.adcode || "",
                Bank_Account_Number: customerDetails[0]?.bank_account || "",
                Billing_City: billingAddressObject?.city || "",
                Billing_Code: billingAddressObject?.postal_code || "",
                Billing_Country: billingAddressObject?.country_code || "",
                Billing_State: billingAddressObject?.state || "",
                Billing_Street: billingAddressObject?.street || "",
                // Category: productTypeObject?.value || "",
                Competitors: dealDetails?.Competitors || null,
                // Contact_Name: {
                //     name: dealDetails?.Contact_Name?.name || "",
                //     id: parseInt(dealDetails.Contact_Name.id || null)  
                // },
                Cust_Id: customerId,
                Customer_ID: customerId,
                Customer_Type: customerDetails[0]?.account_type || "",
                Description: null,
                Email: customerDetails[0]?.email || "",
                Expectations_of_the_customer_for_Services_Quot: dealDetails?.Expectations_of_the_customer_for_Services_Quot || null,
                GST_Number: gstNumberObject?.value || "",
                IFSC_Code: customerDetails[0]?.ifsc_code || "",
                IEC_Code: iecCodeObject?.value || "",
                LUT_Expiration_Date: customerDetails[0]?.lut_expiration_date || null,
                Major_Destinations1: dealDetails?.Major_Destinations1 || null,
                Market_Place: [customerDetails[0]?.account_type || ""],
                Mobile: customerDetails[0]?.mobile || "",
                No_of_shipments: String(customerDetails[0]?.total_booking || ""),
                Prospect_Name: {
                    name: dealDetails?.Deal_Name || "",
                    id: dealDetails?.id || ""
                },
                Prospect_Stage: dealDetails?.Stage || "",
                // Sales_Person_Name: [customerDetails[0]?.company_name || ""],
                Seller_ID: customerDetails[0]?.SellerId || "LEX",
                Shipping_City: shippingAddressObject?.city || "",
                Shipping_Code: shippingAddressObject?.postal_code || "",
                Shipping_Country: shippingAddressObject?.country_code || "",
                Shipping_State: shippingAddressObject?.state || "",
                Shipping_Street: shippingAddressObject?.street || "",
                Status: customerDetails[0]?.status || "",
                Tag: [],
                Territories: null,
                Type_of_Business: customerDetails[0]?.type_of_business || "",
                Product_verticals1: [],
                Weight_Package: dealDetails?.Weight_Package || null,
                Address_Proof: null,
                Identity_Proof: null,
                Locked__s: false
                // Record_Status__s: "Available"
            }
        ]
    };
};

// Create Account Controller
exports.createAccountController = async (req, res) => {
    try {
        const { Customer_id: customerId } = req.params;
        const reqBodyData = req.body;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer_id is required' });
        }
        const customerDetails = await getCustomerDetails(customerId);
        const zohoDealId = customerDetails[0]?.Zoho_Deal_ID;
        if (!zohoDealId) {
            return res.status(400).json({ error: 'Zoho_Deal_ID is missing in customer details' });
        }
        const dealDetails = await getZohoDealDetails(zohoDealId);
        const payload = constructPayload(customerId, zohoDealId, reqBodyData, customerDetails, dealDetails);
        console.log("Payload being sent to Zoho Accounts API:", JSON.stringify(payload, null, 2));
        const zohoCreateAccountResponse = await createZohoAccount(payload);
        console.log("Response from Zoho:", JSON.stringify(zohoCreateAccountResponse, null, 2));

        // Check if the response is successful and contains the id
        if (zohoCreateAccountResponse.data && zohoCreateAccountResponse.data[0].status === 'success') {
            const id = zohoCreateAccountResponse.data[0].details.id;
            const folderPath = path.join(__dirname, 'zoho_responses');
            const filePath = path.join(folderPath, 'response_id.txt');

            // Create folder if it doesn't exist
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }

            // Write the id to the text file
            fs.writeFileSync(filePath, `id: ${id}`, 'utf8');
            console.log(`ID ${id} has been written to ${filePath}`);
        }

        res.status(200).send(zohoCreateAccountResponse);
    } catch (error) {
        console.error("Error creating account:", JSON.stringify(error.response?.data || error.message, null, 2));
        res.status(500).send(error.response?.data || { message: error.message });
    }
};
