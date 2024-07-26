require('dotenv').config();
const axios = require('axios');

const { ZOHO_ACCOUNTS_API, ZOHO_OAUTH_TOKEN } = process.env

if (!ZOHO_ACCOUNTS_API || !ZOHO_OAUTH_TOKEN) {
    throw new Error('Zoho API configuration is missing. Please check environment variables.')
}

exports.getAccountController = async (req, res) => {
    try {
        const { Zoho_Account_id: accountId } = req.params

        //Validating request parameters
        if (!accountId) {
            return res.status(400).json({ error: 'Zoho account id is required' });
        }

        //calling the account get api serving account id to it
        const accountApiResponse = await axios.get(`${process.env.ZOHO_ACCOUNTS_API}/${accountId}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_OAUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        })
        
        res.status(200).send(accountApiResponse.data);
    } catch (error) {
        console.log('Error fetching Zoho account', error);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error fetching Zoho deal',
                message: error.response.data
            });
        } else if (error.request) {
            return res.status(500).json({
                error: 'No response received from Zoho API',
                message: error.message
            });
        } else {
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
}