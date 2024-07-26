require('dotenv').config();
const axios = require('axios')

const {
    ZOHO_SHIPMENTS_API,
    ZOHO_OAUTH_TOKEN
} = process.env

exports.createShipmentController = async (req, res) => {
    try {
        console.log('clicked')
        const headers = {
            'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
            'Content-Type': 'application/json'
        }
        const payload = {
            data:[
                {
                    "Account_Status":"active",
                    "Customer_Name":"444217000001307032", //account_id
                    "Billed_Wt":"0.60",
                    "Name":"Dummy Shipment 1101", //account_id
                    "Billed_Weight":"0.6",
                    "Cust_ID_s":"234",
                    "Country":"GB",
                    "Created_By":"444217000001307032",//account_id
                    "Customer_ID":"444217000001307032",//account_id
                    "Customer_Types":"LEX",
                    "Customer_Wt":"0.54",
                    "Email":"abc@gmail.com",
                    "Hub_Wt":"0.60",
                    "IGST":"200",
                    "INV_TOTAL":"800",
                    "Product_Type":"Gift",
                    "Proforma_Value":"800",
                    "Prospect_Name":"444217000001319012",//prospect_id
                    "TOTAL_SALE_AMT":"800",
                    "Top_Countries":"GB" 
                }
            ]
        }
        const response = await axios.post(ZOHO_SHIPMENTS_API,payload,{headers});
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error creating Zoho shipment:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        res.status(500).send(`Failed to create Zoho shipment: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`);
    }
}