#!/usr/bin/env node
require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const { createShipmentController } = require('./controllers/createShipment.controller');
const { updateShipmentController } = require('./controllers/updateShipment.controller');
const { getAccessToken } = require('./config/zohoAuth');

const {
    LEX_SHIPMENT_API,
    SHIPMENT_BEARER_TOKEN
} = process.env;

// Helper function to fetch AWBs from LEX API
async function fetchAWBsFromLEX(fromDate, toDate) {
    console.log('Fetching AWBs for dates:', fromDate, toDate);
    try {
        const response = await axios({
            method: 'get',
            url: 'https://live1.lexship.com/api/shipment/zoho',
            data: {
                fromdate: fromDate,
                todate: toDate
            },
            headers: {
                'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // Clean and parse the response
        let rawData = response.data;
        if (typeof rawData === 'string') {
            // Remove the "Customer Shipment Count XXX" prefix
            rawData = rawData.replace(/^Customer Shipment Count \d+/, '').trim();
            // Parse the remaining JSON array
            try {
                rawData = JSON.parse(rawData);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                return [];
            }
        }

        console.log(`Total AWBs in response: ${rawData.length}`);

        if (!Array.isArray(rawData)) {
            console.error('Expected array response, got:', typeof rawData);
            return [];
        }

        const awbNumbers = rawData.map(item => item.full_awb_number);
        console.log(`Successfully extracted ${awbNumbers.length} AWB numbers`);
        return awbNumbers;
    } catch (error) {
        console.error('Error fetching AWBs:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        return [];
    }
}

// Helper function to check shipment details
async function checkShipmentDetails(awb) {
    try {
        const response = await axios.get(`https://live1.lexship.com/api/shipment/details`, {
            params: { AWB: awb },
            headers: {
                'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error checking shipment details for AWB ${awb}:`, error.message);
        return null;
    }
}

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Main sync function
async function syncShipments() {
    try {
        console.log('Starting shipment sync process...');

        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const formattedDate = formatDate(yesterday);
        
        console.log('Fetching AWBs for date:', formattedDate);

        // Fetch AWBs from LEX API
        const awbs = await fetchAWBsFromLEX(formattedDate, formattedDate);
        console.log(`Fetched ${awbs.length} AWBs from LEX API`);

        if (awbs.length === 0) {
            console.log('No AWBs to process');
            return;
        }

        const awbsToCreate = [];
        const shipmentIdsToUpdate = [];

        // Check each AWB
        for (const awb of awbs) {
            const shipmentDetails = await checkShipmentDetails(awb);
            
              if (!shipmentDetails.id) {
                awbsToCreate.push(awb);
            } else {
                shipmentIdsToUpdate.push(shipmentDetails.id);
            }
            
            // Add a small delay between API calls
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Create new shipments if any
        if (awbsToCreate.length > 0) {
            console.log(`Creating ${awbsToCreate.length} new shipments`);
            const mockReq = {
                body: { AWB: awbsToCreate }
            };
            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        console.log(`Shipment creation completed with status ${code}:`, data);
                    }
                })
            };
            await createShipmentController(mockReq, mockRes);
        }

        // Update existing shipments if any
        if (shipmentIdsToUpdate.length > 0) {
            console.log(`Updating ${shipmentIdsToUpdate.length} existing shipments`);
            const mockReq = {
                body: { shipmentIds: shipmentIdsToUpdate }
            };
            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        console.log(`Shipment updates completed with status ${code}:`, data);
                    }
                })
            };
            await updateShipmentController(mockReq, mockRes);
        }

        console.log('Shipment sync process completed successfully');
    } catch (error) {
        console.error('Error in shipment sync process:', error.message);
    }
}

// Only export the function
module.exports = {
    syncShipments
}; 
