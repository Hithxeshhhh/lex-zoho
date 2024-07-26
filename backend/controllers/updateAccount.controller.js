require('dotenv').config();
const axios = require('axios');

const {
    ZOHO_ACCOUNTS_API,
    ZOHO_OAUTH_TOKEN
} = process.env

exports.updateAccountController = async (req, res) => {
    try {
        // Validate request parameters
        const zohoAccountId = req.params.Zoho_Account_id;
        if (!zohoAccountId) {
            return res.status(400).send('Zoho_Account_id is required');
        }

        // Validate request body
        const toBeUpdated = req.body;
        if (!toBeUpdated || Object.keys(toBeUpdated).length === 0) {
            return res.status(400).send('Request body is required');
        }

        // Construct payload
        const payload = {
            data: [
                {
                    ...toBeUpdated
                }
            ]
        };

        // Make API call to update account
        const updateAccountApiResponse = await axios.put(
            `${ZOHO_ACCOUNTS_API}/${zohoAccountId}`,
            payload,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Log successful API response
        console.log('Successfully updated account:', updateAccountApiResponse.data);

        // Send response
        res.status(200).send(updateAccountApiResponse.data);
    } catch (error) {
        // Log error and send appropriate response
        console.error('Error updating account:', error.message);
        res.status(500).send('Internal server error');
    }
};
