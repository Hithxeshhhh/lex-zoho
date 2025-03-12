require('dotenv').config();
const axios = require('axios');
const zohoAuth = require('../config/zohoAuth');
const fs = require('fs');
const path = require('path');

const {
    ZOHO_SHIPMENTS_API,
    LEX_SHIPMENT_API,
    SHIPMENT_BEARER_TOKEN,
    LEX_UPDATE_SHIPEMENT_API,
    ZOHO_DEAL_API,
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_ACCOUNTS_API
} = process.env;

// Add a delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Add at the top with other variables
let failedUpdates = [];

// Add queue function
const queueFailedUpdate = (shipmentId, payload) => {
    failedUpdates.push({ shipmentId, payload });
    console.log(`Added to failed updates queue: Shipment ID ${shipmentId}`);
    console.log(`Failed updates queue size: ${failedUpdates.length}`);
};

// Add retry function
const processFailedUpdates = async (maxRetries = 3) => {
    console.log(`Processing ${failedUpdates.length} failed updates...`);
    
    if (failedUpdates.length === 0) {
        return { success: true, message: 'No failed updates to process' };
    }

    const currentBatch = [...failedUpdates];
    failedUpdates = []; // Clear the queue

    const results = {
        success: [],
        failed: []
    };

    for (const item of currentBatch) {
        console.log(`Retrying update for Shipment ID: ${item.shipmentId}`);
        let retryCount = maxRetries;
        
        while (retryCount > 0) {
            try {
                const accessToken = await zohoAuth.getAccessToken();
                const response = await axios.put(
                    `${ZOHO_SHIPMENTS_API}/${item.shipmentId}`, 
                    item.payload,
                    {
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                results.success.push({ shipmentId: item.shipmentId, data: response.data });
                break; // Success, exit retry loop
            } catch (error) {
                retryCount--;
                if (retryCount === 0) {
                    results.failed.push({ shipmentId: item.shipmentId, error: error.message });
                    queueFailedUpdate(item.shipmentId, item.payload); // Re-queue if all retries failed
                } else {
                    await delay(2000); // Wait before next retry
                }
            }
        }
    }

    return {
        success: true,
        message: `Processed ${currentBatch.length} failed updates. Succeeded: ${results.success.length}, Failed: ${results.failed.length}`,
        details: results
    };
};

const getShipmentController = async (req, res) => {
    try {
        await delay(200); // Add delay of 0.5 seconds

        const { shipmentIds } = req.body;

        if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).json({ error: 'shipmentIds array is required' });
        }

        const accessToken = await zohoAuth.getAccessToken();

        const promises = shipmentIds.map(async (zohoShipmentId) => {
            try {
                await delay(200); // Add delay of 0.5 seconds

                const shipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const shipmentData = shipmentResponse.data;
                const awb = shipmentData.data[0].Name;
                const shipmentDetails = await getShipmentDetails(awb);

                return { zohoShipmentId, data: shipmentData, shipmentDetails };
            } catch (error) {
                return { zohoShipmentId, error: error.response ? error.response.data : error.message };
            }
        });

        const results = await Promise.all(promises);
        res.status(200).json({ message: 'Batch processing completed', results });
    } catch (error) {
        console.error('Error fetching shipments:', error.message);
        res.status(500).json({ error: `Failed to fetch shipment details: ${error.message}` });
    }
};

const getShipmentDetails = async (awb) => {
    try {
        await delay(200); // Add delay of 0.5 seconds

        const url = `${LEX_SHIPMENT_API}AWB=${awb}`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        throw new Error(`Failed to get shipment details for AWB ${awb}: ${error.message}`);
    }
};

const getZohoAccountDetails = async (customerId) => {
    try {
        await delay(200); // Add delay of 0.5 seconds

        // Get customer details to get Zoho_Cust_ID
        const customerDetails = await getCustomerDetails(customerId);
        const zoho_cust_id = customerDetails[0].Zoho_Cust_ID;
        console.log('Zoho Customer ID:', zoho_cust_id);
        if (!zoho_cust_id) {
            console.log(`No Zoho Customer ID found for customer: ${customerId}`);
            return null;
        }

        // Get account using Zoho_Cust_ID from customer details
        const accountResponse = await axios.get(`${ZOHO_ACCOUNTS_API}/${zoho_cust_id}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${await zohoAuth.getAccessToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (accountResponse.data?.data && accountResponse.data.data.length > 0) {
            return accountResponse.data.data[0];
        }
        
        console.log(`No account found for ID: ${zoho_cust_id}`);
        return null;
    } catch (error) {
        console.error(`Failed to fetch account details: ${error.message}`);
        return null;
    }
};

const updateShipmentDetails = async (awbNumber, zohoShipmentId, retry = true) => {
    try {
        await delay(500); // Delay before making the request

        const url = `${LEX_UPDATE_SHIPEMENT_API}AWB=${awbNumber}&Zoho_Shipment_Id=${zohoShipmentId}`;
        const headers = {
            'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error(`Failed to update shipment details for AWB: ${awbNumber}, Error: ${error.message}`);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }

        if (retry) {
            console.log(`Retrying to update shipment details for AWB: ${awbNumber}`);
            await delay(2000); // Delay before retrying
            return updateShipmentDetails(awbNumber, zohoShipmentId, false); // Retry once
        }

        throw new Error(`Failed to update shipment details for AWB: ${awbNumber}, Error: ${error.message}`);
    }
};

// Add this helper function
const convertDateFormat = (dateString) => {
    if (!dateString) return "";
    try {
        // Split the DD-MM-YYYY format
        const [day, month, year] = dateString.split('-');
        // Return in YYYY-MM-DD format
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.log(`Error converting date format for: ${dateString}`);
        return "";
    }
};

// Add logging function
const logToFile = (data, prefix = '') => {
    const timestamp = new Date().toISOString();
    const logDir = path.join(__dirname, '../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const logFile = path.join(logDir, `update_shipment_logs_${new Date().toISOString().split('T')[0]}.txt`);
    const logEntry = `\n[${timestamp}] ${prefix}\n${JSON.stringify(data, null, 2)}\n`;
    
    fs.appendFileSync(logFile, logEntry);
};

// Add HeartbeatManager class at the top
class HeartbeatManager {
    constructor(res, intervalMs = 30000) {
        this.res = res;
        this.intervalMs = intervalMs;
        this.intervalId = null;
    }

    start() {
        this.intervalId = setInterval(() => {
            if (!this.res.headersSent) {
                return;
            }
            this.res.write('{"heartbeat": true}\n');
        }, this.intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Modify processBatch to send progress updates
const processBatch = async (shipmentIdsBatch) => {
    const results = [];
    for (const zohoShipmentId of shipmentIdsBatch) {
        try {
            await delay(200);
            logToFile({ shipmentId: zohoShipmentId }, 'PROCESSING SHIPMENT');

            const accessToken = await zohoAuth.getAccessToken();
            const existingShipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            logToFile(existingShipmentResponse.data, 'EXISTING SHIPMENT DATA');

            const existingShipmentData = existingShipmentResponse.data.data[0];
            const awb = existingShipmentData.Name;

            // Fetch additional shipment details
            const additionalShipmentDetails = await getShipmentDetails(awb);
            logToFile(additionalShipmentDetails, 'ADDITIONAL SHIPMENT DETAILS');

            await updateShipmentDetails(awb, zohoShipmentId);
            logToFile(additionalShipmentDetails, 'UPDATED SHIPMENT DETAILS');

            // Get deal details using customer ID
            const dealDetails = await getZohoDealDetails(additionalShipmentDetails.Customer_ID);
            logToFile(dealDetails, 'DEAL DETAILS');
            

            const accountDetails = await getZohoAccountDetails(additionalShipmentDetails.Customer_ID);
            logToFile(accountDetails, 'ACCOUNT DETAILS');

            // Create deal object
            const dealObject = dealDetails ? {
                name: dealDetails.Deal_Name || "",
                id: dealDetails.id || ""
            } : null;

            const truncatedDescription = additionalShipmentDetails.Description && additionalShipmentDetails.Description.length > 255
                ? additionalShipmentDetails.Description.substring(0, 255)
                : additionalShipmentDetails.Description;

            const updatedFields = {

                Name: additionalShipmentDetails.Name || "",
                Currency: additionalShipmentDetails.Currency || "",
                Weight_Slab: additionalShipmentDetails.Weight_Slab || "",
                id: additionalShipmentDetails.id || "",
                Destination_State: additionalShipmentDetails.Destination_State || "",
                MIS_Status: additionalShipmentDetails.MIS_Status || "",
                Customer_ID: additionalShipmentDetails.Customer_ID ? additionalShipmentDetails.Customer_ID.toString() : "",
                Destination_Country: additionalShipmentDetails.Destination_Country || "",
                Country: additionalShipmentDetails.Country || "",
                Final_Inv_No: additionalShipmentDetails.Final_Inv_No || "",
                Package_Value: additionalShipmentDetails.Package_Value && !isNaN(additionalShipmentDetails.Package_Value) ? Math.round(parseFloat(additionalShipmentDetails.Package_Value)) : null,
                Cust_ID_11: additionalShipmentDetails.Cust_ID_11 ? additionalShipmentDetails.Cust_ID_11.toString() : "",
                Proforma_Value: additionalShipmentDetails.Proforma_Value && !isNaN(additionalShipmentDetails.Proforma_Value) ? Math.round(parseFloat(additionalShipmentDetails.Proforma_Value)) : null,
                Description: truncatedDescription || "",
                Billed_Weight: additionalShipmentDetails.Billed_Weight ? parseFloat(additionalShipmentDetails.Billed_Weight).toFixed(2) : "",
                Proforma_No: additionalShipmentDetails.Proforma_No || "",
                IOSS_EORI: additionalShipmentDetails.IOSS_EORI || "",
                Date_of_Creation: additionalShipmentDetails.Date_of_Creation 
                ? new Date(additionalShipmentDetails.Date_of_Creation).toLocaleDateString('en-CA') // Ensures YYYY-MM-DD
                : "",
                Final_Inv_Date: additionalShipmentDetails.Final_Inv_Date ? 
                    convertDateFormat(additionalShipmentDetails.Final_Inv_Date) : 
                    "",
                MIS_Weight: additionalShipmentDetails.MIS_Weight || "",
                Record_Status__s: additionalShipmentDetails.Record_Status__s || "",
                Customer_Types: additionalShipmentDetails.Customer_Types || "",
                Seller_ID: additionalShipmentDetails.Seller_ID || "LEX",
                Service_Type: additionalShipmentDetails.Service_Type || "",
                Billed_Wt: additionalShipmentDetails.Billed_Wt ? parseFloat(additionalShipmentDetails.Billed_Wt).toFixed(2) : "",
                Product_Type: additionalShipmentDetails.Product_Type || "",
                MAWB: additionalShipmentDetails.MAWB || "",
                Value_Currency: additionalShipmentDetails.Value_Currency || "",
                Blue_Dart_Delivered_Date: additionalShipmentDetails.Blue_Dart_Delivered_Date ? new Date(additionalShipmentDetails.Blue_Dart_Delivered_Date).toISOString().split('T')[0] : "",
                Booked_Date: additionalShipmentDetails.Booked_Date 
                ? new Date(additionalShipmentDetails.Booked_Date).toLocaleDateString('en-CA') // Ensures YYYY-MM-DD
                : "",
                Created_Time: additionalShipmentDetails.Created_Time ? new Date(additionalShipmentDetails.Created_Time).toISOString().split('T')[0] : "",
                Picked_Date: additionalShipmentDetails.Picked_Date ? new Date(additionalShipmentDetails.Picked_Date).toISOString().split('T')[0] : "",
                Create_Pick_Up_Date: additionalShipmentDetails.Create_Pick_Up_Date ? new Date(additionalShipmentDetails.Create_Pick_Up_Date).toISOString().split('T')[0] : "",
                Receival_Scan_Date: additionalShipmentDetails.Receival_Scan_Date ? new Date(additionalShipmentDetails.Receival_Scan_Date).toISOString().split('T')[0] : "",
                Bagged_Date: additionalShipmentDetails.Bagged_Date ? new Date(additionalShipmentDetails.Bagged_Date).toISOString().split('T')[0] : "",
                Sent_for_Customs_Clearance: additionalShipmentDetails.Sent_for_Customs_Clearance ? new Date(additionalShipmentDetails.Sent_for_Customs_Clearance).toISOString().split('T')[0] : "",
                Customs_Cleared: additionalShipmentDetails.Customs_Cleared ? new Date(additionalShipmentDetails.Customs_Cleared).toISOString().split('T')[0] : "",
                Uplifted: additionalShipmentDetails.Uplifted 
                ? new Date(additionalShipmentDetails.Uplifted).toLocaleDateString('en-CA') // Ensures YYYY-MM-DD
                : "",
                Arrived_at_International_Hub_Date:additionalShipmentDetails.Arrived_at_International_Hub_Date 
                ? new Date(additionalShipmentDetails.Arrived_at_International_Hub_Date).toLocaleDateString('en-CA') // Ensures YYYY-MM-DD
                : "",
                Delivered_Date: additionalShipmentDetails.Delivered_Date 
                ? new Date(additionalShipmentDetails.Delivered_Date).toLocaleDateString('en-CA') // Ensures YYYY-MM-DD
                : "",
                Held_at_Customs: additionalShipmentDetails.Held_at_Customs ? new Date(additionalShipmentDetails.Held_at_Customs).toISOString().split('T')[0] : "",
                Date_of_Cancellation: additionalShipmentDetails.Date_of_Cancellation ? new Date(additionalShipmentDetails.Date_of_Cancellation).toISOString().split('T')[0] : "",
                Sales_Person_Name: additionalShipmentDetails.Sales_Person_Name || "",
                HS_Code: additionalShipmentDetails.HS_CODE || "",
                RTS_Time1: additionalShipmentDetails.Rts_time || "",
                Forwarding_Number: additionalShipmentDetails.Forwarded_number || "",
                First_Mile_Tracking:additionalShipmentDetails.first_mile_tracking_number || "",
                Hub_Weight: additionalShipmentDetails.Hub_weight || "",
                Bag_Name: additionalShipmentDetails.bag_number || "",
                Forward_flag2: additionalShipmentDetails.Forward_flag !== undefined && additionalShipmentDetails.Forward_flag !== null
                ? additionalShipmentDetails.Forward_flag
                : "",
                Billed_Weight_Slab: additionalShipmentDetails.Billed_Weight_Slab || "",
                Reached_Destnation_Country: additionalShipmentDetails.Reached_destination_country 
                ? new Date(additionalShipmentDetails.Reached_destination_country).toLocaleDateString('en-CA')
                : "",
                Create_Pick_Up_Time: additionalShipmentDetails.Create_Pick_Up_Time || "",
                Seller_Name2:additionalShipmentDetails.Seller_Name || "",

                In_transport_to_destination_country: additionalShipmentDetails.In_tranport_destination_country 
                ? new Date(additionalShipmentDetails.In_tranport_destination_country).toLocaleDateString('en-CA')
                : "",
                TOTAL_SALE_AMT:additionalShipmentDetails.Invoice_Amount || "",
                // Prospect_Name: dealObject,
                // Cust_ID_s: accountDetails ? {
                //     name: accountDetails.Account_Name || "",
                //     id: accountDetails.id || ""
                // } : null,
            };

            // Construct Payload
            const payload = {
                data: [{ ...updatedFields }]
            };
            logToFile(payload, 'UPDATE PAYLOAD');

            // Update shipment with retry
            let retryCount = 3;
            while (retryCount > 0) {
                try {
                    const updateResponse = await axios.put(
                        `${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, 
                        payload,
                        {
                            headers: {
                                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    logToFile(updateResponse.data, 'SUCCESSFUL UPDATE RESPONSE');
                    results.push({ zohoShipmentId, status: 'success', data: updateResponse.data });
                    break;
                } catch (error) {
                    logToFile({
                        error: error.message,
                        retryCount,
                        shipmentId: zohoShipmentId
                    }, 'UPDATE RETRY ERROR');
                    
                    retryCount--;
                    if (retryCount === 0) {
                        queueFailedUpdate(zohoShipmentId, payload);
                        results.push({ zohoShipmentId, status: 'error', error: error.message });
                    } else {
                        await delay(2000);
                    }
                }
            }

            // Add progress logging
            logToFile({
                shipmentId: zohoShipmentId,
                status: 'success',
                timestamp: new Date().toISOString()
            }, 'SHIPMENT_PROCESSED');

        } catch (error) {
            logToFile({
                shipmentId: zohoShipmentId,
                error: error.message,
                timestamp: new Date().toISOString()
            }, 'SHIPMENT_ERROR');
            
            results.push({ 
                zohoShipmentId, 
                status: 'error', 
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    return results;
};

// Modify the main controller to use chunked responses
exports.updateShipmentController = async (req, res) => {
    const heartbeat = new HeartbeatManager(res);
    
    try {
        const { shipmentIds } = req.body;
        
        if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).json({ error: 'shipmentIds array is required' });
        }

        // Set headers for chunked transfer
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        // Start the response
        res.write('{\n');
        res.write('"status": "processing",\n');
        res.write('"results": [\n');

        // Start sending heartbeats
        heartbeat.start();

        const BATCH_SIZE = 80;
        let totalProcessed = 0;
        let successCount = 0;
        let failureCount = 0;
        
        // Process shipments in batches
        for (let i = 0; i < shipmentIds.length; i += BATCH_SIZE) {
            const batch = shipmentIds.slice(i, i + BATCH_SIZE);
            
            // Send batch progress
            res.write(JSON.stringify({
                batch_progress: {
                    batch: Math.floor(i/BATCH_SIZE) + 1,
                    size: batch.length,
                    total_processed: totalProcessed,
                    timestamp: new Date().toISOString()
                }
            }) + ',\n');

            try {
                const batchResult = await processBatch(batch);
                
                // Send batch results
                res.write(JSON.stringify({
                    batch_result: {
                        batch: Math.floor(i/BATCH_SIZE) + 1,
                        results: batchResult
                    }
                }) + ',\n');

                // Update counters
                batchResult.forEach(result => {
                    if (result.status === 'success') {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                });

                totalProcessed += batch.length;

            } catch (error) {
                console.error(`Batch processing error:`, error);
                failureCount += batch.length;
                
                // Send batch error
                res.write(JSON.stringify({
                    batch_error: {
                        batch: Math.floor(i/BATCH_SIZE) + 1,
                        error: error.message,
                        failed_shipments: batch
                    }
                }) + ',\n');
            }

            // Add delay between batches
            await delay(1000);
        }

        // Process any failed updates
        const failedProcessingResult = await processFailedUpdates();
        
        // Send final summary
        res.write(JSON.stringify({
            final_summary: {
                total_shipments: shipmentIds.length,
                processed: totalProcessed,
                successful: successCount,
                failed: failureCount,
                failed_updates: failedUpdates.length,
                failed_processing: failedProcessingResult,
                completion_time: new Date().toISOString()
            }
        }) + '\n');

        // End the JSON array and object
        res.write(']\n}');

        // Stop heartbeat and end response
        heartbeat.stop();
        res.end();

    } catch (error) {
        // Stop heartbeat
        heartbeat.stop();
        
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to update shipments',
                message: error.message
            });
        } else {
            // If we've already started sending response, send error in the stream
            res.write(JSON.stringify({
                error: 'Failed to update shipments',
                message: error.message,
                timestamp: new Date().toISOString()
            }) + '\n]}');
            res.end();
        }
    }
};

// Add the getZohoDealDetails function if it's not already present
const getZohoDealDetails = async (customerId) => {
    try {
        await delay(200); // Add delay of 0.5 seconds

        const customerDetails = await getCustomerDetails(customerId);
        const zoho_deal_id = customerDetails[0].Zoho_Deal_ID;
        if (!zoho_deal_id) {
            console.log(`No Zoho Deal ID found for customer: ${customerId}`);
            return null;
        }

        const accessToken = await zohoAuth.getAccessToken();
        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${zoho_deal_id}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (dealResponse.data?.data && dealResponse.data.data.length > 0) {
            return dealResponse.data.data[0];
        }
        
        console.log(`No deal found for ID: ${zoho_deal_id}`);
        return null;
    } catch (error) {
        console.error(`Failed to fetch deal details: ${error.message}`);
        return null;
    }
};

const getCustomerDetails = async (customerId) => {
    try {
        await delay(200); // Add delay of 0.5 seconds

        const response = await axios.get(`${LEX_CUSTOMER_DETAIL_API}Customer_Id=${customerId}`, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch customer details: ${error.message}`);
        return null;
    }
};