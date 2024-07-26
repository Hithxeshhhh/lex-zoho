require('dotenv').config();
const axios = require('axios');

const {
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_DEAL_API,
    ZOHO_OAUTH_TOKEN,
    ZOHO_ACCOUNTS_API
} = process.env;

//Fetching Customer details from Lex customer detail api
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

//Fetching Zoho Deal details from zoho deal api
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

//Creating a zoho account from zoho accounts api
const createZohoAccount = async (payload) => {
    try {
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.post(ZOHO_ACCOUNTS_API, payload, { headers });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to create Zoho account: ${error.message}`);
    }
};

//Constructing payload that is to be sent to create account
const constructPayload = (customerId, zohoDealId, reqBodyData, customerDetails, dealDetails) => {
    const addresses = Array.isArray(customerDetails[1]) ? customerDetails[1] : [];
    const additionalInfo = Array.isArray(customerDetails[2]) ? customerDetails[2] : [];
    
    const billingAddressObject = addresses.find(item=>item.label === "Billing Address");
    const shippingAddressObject = addresses.find(item=>item.label === "Registered Address");
    const gstNumberObject = additionalInfo.find(item => item.key === "gst_number");
    const iecCodeObject = additionalInfo.find(item => item.key === "iec_code");
    const marketPlaceObject = additionalInfo.find(item=>item.key==="market_place_presence")
    const productTypeObjhect = additionalInfo.find(item => item.key === "product_type_commodity")
    return {
        data: [
            {
                Adcode: customerDetails[0].adcode,
                Bank_Account_Number: customerDetails[0].bank_account,
                Cust_Id: customerId,
                Customer_ID: zohoDealId,
                ...reqBodyData,
                Mobile: customerDetails[0].mobile,
                Email: customerDetails[0].email,
                Account_Type: customerDetails[0].account_type,
                IFSC_Code: customerDetails[0].ifsc_code,
                Market_Place: marketPlaceObject ? marketPlaceObject.value : [],
                Competitors: dealDetails.Competitors,
                No_of_shipments: customerDetails[0].total_bookings,
                Major_Destinations1: dealDetails.Major_Destinations1,
                Expectations_of_the_customer_for_Services_Quot: dealDetails.Expectations_of_the_customer_for_Services_Quot,
                Weight_Package: dealDetails.Weight_Package,
                Type_of_business: customerDetails[0].type_of_business,
                Locked__s: dealDetails.Locked__s,
                Tag: dealDetails.Tag,
                Category : productTypeObjhect ? productTypeObjhect.value : "",
                Prospect_Name: dealDetails.Deal_Name,
                Prospect_Stage: dealDetails.Stage,
                Account: customerDetails[0].account||"",
                Account_Status: customerDetails[0].status||"",
                Account_Type1: customerDetails[0].acc_type||"",
                Billing_City: billingAddressObject ? billingAddressObject.city : "",
                Billing_Code: billingAddressObject ? billingAddressObject.postal_code :"",
                Billing_Country: billingAddressObject ? billingAddressObject.country_code : "",
                Billing_State: billingAddressObject ? billingAddressObject.state : "",
                Billing_Street: billingAddressObject ? billingAddressObject.street : "",
                Account_Number: customerDetails[0].account||"",
                GST_Certificate: null,
                GST_Number: gstNumberObject ? gstNumberObject.value : "",
                IEC_Certificate: null,
                IEC_Code: iecCodeObject ? iecCodeObject.value : "",
                LUT_Certificate: null,
                LUT_Expiration_Date: customerDetails[0].LUT_Expiration_Date||"",
                Sales_Person_Name: customerDetails[0].company_name,
                Seller_ID: "LEX",
                Shipping_City: shippingAddressObject ? shippingAddressObject.city : "",
                Shipping_Code: shippingAddressObject ? shippingAddressObject.postal_code : "",
                Shipping_Country: shippingAddressObject ? shippingAddressObject.country_code : "",
                Shipping_State: shippingAddressObject ? shippingAddressObject.state : "",
                Shipping_Street: shippingAddressObject ? shippingAddressObject.street : "",
                Upload_Address_Proof: null,
                Upload_Identity_Proof: null,
            }
        ]
    };
};

//Create Account Controller
exports.createAccountController = async (req, res) => {
    try {
        const { Customer_id: customerId } = req.params;
        const reqBodyData = req.body;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer_id is required' });
        }
        const customerDetails = await getCustomerDetails(customerId);
        const zohoDealId = customerDetails[0].Zoho_Deal_ID;
        const dealDetails = await getZohoDealDetails(zohoDealId);
        const payload = constructPayload(customerId, zohoDealId, reqBodyData, customerDetails, dealDetails);
        console.log("Payload being sent to Zoho Accounts API:", JSON.stringify(payload, null, 2));
        const zohoCreateAccountResponse = await createZohoAccount(payload);
        console.log("Response from Zoho:", zohoCreateAccountResponse);
        res.status(200).send(zohoCreateAccountResponse);
    } catch (error) {
        console.error("Error creating account:", error.response ? error.response.data : error.message);
        res.status(500).send(error.response ? error.response.data : { message: error.message });
    }
};
