require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const multer = require('multer');

const LEX_UPDATE_ZOHO_API = process.env.LEX_UPDATE_ZOHO_API;
const BEARER_TOKEN = process.env.SHIPMENT_BEARER_TOKEN;

// Multer setup for file upload
const upload = multer({ dest: 'uploads/' });

// Function to introduce a delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to make request with retry mechanism
async function makeRequestWithRetry(url, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
            });
            return response.data; // Success
        } catch (error) {
            if (error.response?.status === 429) { // Rate limited
                const retryAfter = error.response.headers['retry-after'] 
                    ? parseInt(error.response.headers['retry-after']) * 1000 
                    : (attempt + 1) * 500; // Increase delay on each retry
                console.log(`Rate limited. Retrying in ${retryAfter}ms...`);
                await sleep(retryAfter);
            } else {
                throw error; // If not a rate limit issue, stop retrying
            }
        }
        attempt++;
    }
    throw new Error('Max retries reached.');
}

exports.updateDetailstoZohoController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        let uniqueRequests = new Set();
        let requests = [];
        let results = [];
        let successCount = 0;
        let failureCount = 0;

        // Read uploaded CSV file
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    const { customer_id, zoho_cust_id, zoho_deal_id } = row;
                    const key = `${customer_id}_${zoho_cust_id}_${zoho_deal_id}`;
                    
                    if (!uniqueRequests.has(key)) {
                        uniqueRequests.add(key);
                        requests.push({ customer_id, zoho_cust_id, zoho_deal_id });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Processing ${requests.length} unique requests in batches...`);

        const BATCH_SIZE = 1000; // Reduced batch size to avoid API overload
        for (let i = 0; i < requests.length; i += BATCH_SIZE) {
            const batch = requests.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${i / BATCH_SIZE + 1} with ${batch.length} requests...`);

            for (const req of batch) {
                try {
                    const cleanDealId = req.zoho_deal_id.trim().replace('zcrm_', '');
                    const cleanCustId = req.zoho_cust_id.trim().replace('zcrm_', '');
                    const cleanCustomerId = req.customer_id.trim();

                    const url = `${LEX_UPDATE_ZOHO_API}Customer_Id=${encodeURIComponent(cleanCustomerId)}&Zoho_Deal_Id=${encodeURIComponent(cleanDealId)}&Zoho_Cust_Id=${encodeURIComponent(cleanCustId)}`;
                    
                    console.log('Request URL:', url);

                    const data = await makeRequestWithRetry(url); // Retry if rate limited

                    results.push({
                        customer_id: cleanCustomerId,
                        status: 'success',
                        data: data
                    });
                    successCount++;

                } catch (error) {
                    console.error('Request failed:', req.customer_id);
                    console.error('Error details:', error.response?.data || error.message);
                    
                    results.push({
                        customer_id: req.customer_id,
                        status: 'error',
                        error: error.response?.data || error.message
                    });
                    failureCount++;
                }

                await sleep(100); // Wait for 200ms before the next request
            }
        }

        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.error('Error deleting temporary file:', error.message);
            
        } // Delete uploaded file after processing

        res.status(200).json({
            message: 'Update process completed',
            total_processed: requests.length,
            successful_updates: successCount,
            failed_updates: failureCount,
            results: results
        });
    } catch (error) {
        console.error('Error in update process:', error);
        res.status(500).json({ error: 'Failed to process updates', message: error.message });
    }
};
