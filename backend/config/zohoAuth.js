const axios = require('axios');
require('dotenv').config();

class ZohoAuth {
    constructor() {
        this.clientId = process.env.ZOHO_CLIENT_ID;
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
        this.tokenUrl = process.env.ZOHO_TOKEN_URL;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async refreshAccessToken() {
        try {
            console.log('Refreshing Zoho access token...');
            const response = await axios.post(`${this.tokenUrl}`, null, {
                params: {
                    refresh_token: this.refreshToken,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token'
                }
            });
            console.log('Token refreshed successfully');
            this.accessToken = response.data.access_token;
            // Set expiry to slightly less than 1 hour to ensure we refresh before expiration
            this.tokenExpiry = Date.now() + (3500 * 1000); // 58.33 minutes
            return this.accessToken;
        } catch (error) {
            console.error('Error refreshing Zoho token:', error);
            throw error;
        }
    }

    async getAccessToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.refreshAccessToken();
        }
        return this.accessToken;
    }
}

const zohoAuth = new ZohoAuth();
module.exports = zohoAuth; 