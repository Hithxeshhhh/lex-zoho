require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
    ZOHO_SHIPMENTS_API,
    ZOHO_OAUTH_TOKEN,
    LEX_SHIPMENT_API,
    SHIPMENT_BEARER_TOKEN,
    LEX_UPDATE_SHIPEMENT_API,
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
    ZOHO_DEAL_API,
    ZOHO_ACCOUNTS_API
} = process.env;

const zohoAuth = require('../config/zohoAuth');

if (!ZOHO_SHIPMENTS_API || !ZOHO_OAUTH_TOKEN || !LEX_SHIPMENT_API || 
    !SHIPMENT_BEARER_TOKEN || !LEX_CUSTOMER_DETAIL_API || !BEARER_TOKEN || !ZOHO_DEAL_API || !ZOHO_ACCOUNTS_API) {
    throw new Error('API configuration is missing. Please check environment variables.');
}

// Function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let failedUpdates = [];

// Modify the updateShipmentDetails function to not throw after retries
const updateShipmentDetails = async (awbNumber, zohoShipmentId, retryCount = 3, delayMs = 1000) => {
    try {
        await delay(delayMs);

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

        if (retryCount > 0) {
            const nextDelay = delayMs * 2; // Exponential backoff
            console.log(`Retrying to update shipment details for AWB: ${awbNumber} (${retryCount} attempts left). Next retry in ${nextDelay}ms`);
            return updateShipmentDetails(awbNumber, zohoShipmentId, retryCount - 1, nextDelay);
        }

        // Instead of throwing, return an error object
        return { 
            error: true, 
            message: `Failed to update shipment details for AWB: ${awbNumber} after multiple attempts: ${error.message}`,
            awb: awbNumber,
            zohoShipmentId: zohoShipmentId
        };
    }
};

const queueFailedUpdate = (awb, zohoShipmentId) => {
    failedUpdates.push({ awb, zohoShipmentId });
    console.log(`Added to failed updates queue: AWB ${awb} with Zoho ID ${zohoShipmentId}`);
    console.log(`Failed updates queue size: ${failedUpdates.length}`);
};

// Add a new function to process failed updates
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
        console.log(`Retrying update for AWB: ${item.awb} with Zoho ID: ${item.zohoShipmentId}`);
        
        try {
            const result = await updateShipmentDetails(item.awb, item.zohoShipmentId, maxRetries, 2000);
            
            if (result.error) {
                // If still failed after retries, add back to failed queue
                queueFailedUpdate(item.awb, item.zohoShipmentId);
                results.failed.push(item);
            } else {
                results.success.push(item);
            }
        } catch (error) {
            console.error(`Error during retry for AWB: ${item.awb}`, error);
            queueFailedUpdate(item.awb, item.zohoShipmentId);
            results.failed.push(item);
        }
        
        // Add delay between retries
        await delay(3000);
    }

    return { 
        success: true, 
        message: `Processed ${currentBatch.length} failed updates. Succeeded: ${results.success.length}, Failed: ${results.failed.length}`,
        details: results
    };
};

const getShipmentDetails = async (awb) => {
    try {
        await delay(500); 

        const url = `${LEX_SHIPMENT_API}AWB=${awb}`;
        const headers = {
            'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch shipment details for AWB: ${awb}, Error: ${error.message}`);
    }
};

const getCustomerDetails = async (customerId) => {
    try {
        await delay(500); 

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

const getZohoDealDetails = async (customerId) => {
    try {
        await delay(500); 

        const customerDetails = await getCustomerDetails(customerId);
        const zoho_deal_id = customerDetails[0].Zoho_Deal_ID;
        if (!zoho_deal_id) {
            console.log(`No Zoho Deal ID found for customer: ${customerId}`);
            return null;
        }

        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${zoho_deal_id}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${await zohoAuth.getAccessToken()}`,
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

const getZohoAccountDetails = async (customerId) => {
    try {
        await delay(500); 

        // Get customer details to get Zoho_Cust_ID
        const customerDetails = await getCustomerDetails(customerId);
        const zoho_cust_id = customerDetails[0].Zoho_Cust_ID;
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

const mapShipmentDetailsToPayload = async (details) => {
    await delay(500); 

    // Add debug logs
    
    
    // Get customer details
    const customerDetails = await getCustomerDetails(details.Customer_ID);
    
    
    // Get deal details using customer ID
    const dealDetails = await getZohoDealDetails(details.Customer_ID);
    
    
    // Get account details using customer ID
    const accountDetails = await getZohoAccountDetails(details.Customer_ID);
    

    const dealObject = dealDetails ? {
        name: dealDetails.Deal_Name || "",
        id: dealDetails.id || ""
    } : null;

    // Truncate Description if it exceeds 255 characters
    const truncatedDescription = details.Description && details.Description.length > 255
        ? details.Description.substring(0, 255)
        : details.Description;

    const payload = {
        data: [{
            
            Name: details.Name || "",  
            Currency: details.Currency || "",
            Weight_Slab: details.Weight_Slab || "",
            Destination_State: details.Destination_State || "",
            MIS_Status: details.MIS_Status || "",
            Customer_ID: details.Customer_ID ? details.Customer_ID.toString() : "",
            Destination_Country: details.Destination_Country || "",
            Country: details.Country || "",
            Final_Inv_No: details.Final_Inv_No || "",
            Package_Value: details.Package_Value && !isNaN(details.Package_Value) ? Math.round(parseFloat(details.Package_Value)) : null,
            Cust_ID_11: details.Cust_ID_11 ? details.Cust_ID_11.toString() : "",
            Proforma_Value: details.Proforma_Value && !isNaN(details.Proforma_Value) ? Math.round(parseFloat(details.Proforma_Value)) : null,
            Description: truncatedDescription || "",
            Billed_Weight: details.Billed_Weight ? parseFloat(details.Billed_Weight).toFixed(2) : "",
            Proforma_No: details.Proforma_No || "",
            IOSS_EORI: details.IOSS_EORI || "",
            Date_of_Creation: details.Date_of_Creation ? new Date(details.Date_of_Creation).toISOString().split('T')[0] : "",
            Final_Inv_Date: details.Final_Inv_Date ? convertDateFormat(details.Final_Inv_Date) : "",
            MIS_Weight: details.MIS_Weight || "",
            Record_Status__s: details.Record_Status__s || "",
            Customer_Types: details.Customer_Types || "",
            SellerName: dealObject,
            Seller_ID: details.Seller_ID || "LEX",
            Service_Type: details.Service_Type || "",
            Billed_Wt: details.Billed_Wt ? parseFloat(details.Billed_Wt).toFixed(2) : "",
            Product_Type: details.Product_Type || "",
            MAWB: details.MAWB || "",
            Value_Currency: details.Value_Currency || "",
            Blue_Dart_Delivered_Date: details.Blue_Dart_Delivered_Date ? new Date(details.Blue_Dart_Delivered_Date).toISOString().split('T')[0] : "",
            Booked_Date: details.Booked_Date ? new Date(details.Booked_Date).toLocaleDateString('en-CA') : "",
            Created_Time: details.Created_Time ? new Date(details.Created_Time).toISOString().split('T')[0] : "",
            Picked_Date: details.Picked_Date ? new Date(details.Picked_Date).toISOString().split('T')[0] : "",
            Create_Pick_Up_Date: details.Create_Pick_Up_Date ? new Date(details.Create_Pick_Up_Date).toISOString().split('T')[0] : "",
            Receival_Scan_Date: details.Receival_Scan_Date ? new Date(details.Receival_Scan_Date).toISOString().split('T')[0] : "",
            Bagged_Date: details.Bagged_Date ? new Date(details.Bagged_Date).toISOString().split('T')[0] : "",
            Sent_for_Customs_Clearance: details.Sent_for_Customs_Clearance ? new Date(details.Sent_for_Customs_Clearance).toISOString().split('T')[0] : "",
            Customs_Cleared: details.Customs_Cleared ? new Date(details.Customs_Cleared).toISOString().split('T')[0] : "",
            Uplifted: details.Uplifted ? new Date(details.Uplifted).toISOString().split('T')[0] : "",
            Arrived_at_International_Hub_Date: details.Arrived_at_International_Hub_Date ? new Date(details.Arrived_at_International_Hub_Date).toLocaleDateString('en-CA') : "",
            Delivered_Date: details.Delivered_Date ? new Date(details.Delivered_Date).toLocaleDateString('en-CA') : "",
            Held_at_Customs: details.Held_at_Customs ? new Date(details.Held_at_Customs).toISOString().split('T')[0] : "",
            Date_of_Cancellation: details.Date_of_Cancellation ? new Date(details.Date_of_Cancellation).toISOString().split('T')[0] : "",
            Sales_Person_Name: details.Sales_Person_Name || "",
            Prospect_Name: dealObject,
            Cust_ID_s: accountDetails ? {
                name: accountDetails.Account_Name || "",
                id: accountDetails.id || ""
            } : null,
            HS_Code: details.HS_CODE || "",
            RTS_Time1: details.Rts_time || "",
            Forwarding_Number: details.Forwarded_number || "",
            First_Mile_Tracking: details.first_mile_tracking_number || "",
            Hub_Weight: details.Hub_weight || "",
            Bag_Name: details.bag_number || "",
            Forward_flag2: details.Forward_flag !== undefined && details.Forward_flag !== null ? details.Forward_flag : "",
            Billed_Weight_Slab: details.Billed_Weight_Slab || "",
            Reached_Destnation_Country: details.Reached_destination_country ? details.Reached_destination_country.split(' ')[0] : "",
            Create_Pick_Up_Time: details.Create_Pick_Up_Time || "",
            Seller_Name2: details.Seller_Name || "",
            In_transport_to_destination_country: details.In_tranport_destination_country 
                    ? new Date(details.In_tranport_destination_country).toLocaleDateString('en-CA')
                    : "",
            TOTAL_SALE_AMT:details.Invoice_Amount || "",
        }]
    };

    // Debug final payload
    console.log('Final Payload:', JSON.stringify(payload, null, 2));
    
    return payload;
};

const processBatch = async (awbBatch) => {
    const promises = awbBatch.map(async (awb) => {
        await delay(500);

        const shipmentDetails = await getShipmentDetails(awb);
        const mappedPayload = await mapShipmentDetailsToPayload(shipmentDetails);
        return { awb, shipmentData: mappedPayload.data[0] };
    });

    const payloadData = await Promise.all(promises);
    const payload = { data: payloadData.map(item => item.shipmentData) };

    // Create shipment
    const response = await axios.post(`${ZOHO_SHIPMENTS_API}`, payload, {
        headers: {
            'Authorization': `Zoho-oauthtoken ${await zohoAuth.getAccessToken()}`,
            'Content-Type': 'application/json',
        }
    });

    console.log('Response structure:', JSON.stringify(response.data, null, 2));

    // Extract Zoho Shipment IDs and update shipment details
    if (response.data?.data) {
        for (let i = 0; i < response.data.data.length; i++) {
            const responseItem = response.data.data[i];
            console.log('Processing response item:', responseItem);
            
            const zohoShipmentId = responseItem?.details?.id;
            const awb = awbBatch[i];
            
            console.log('Extracted values:', {
                zohoShipmentId,
                awb,
                responseItemDetails: responseItem?.details
            });

            if (zohoShipmentId && awb) {
                console.log(`Updating shipment details for AWB: ${awb} with Zoho ID: ${zohoShipmentId}`);
                try {
                    const updateResult = await updateShipmentDetails(awb, zohoShipmentId);
                    
                    // Check if update failed and queue it if necessary
                    if (updateResult && updateResult.error) {
                        queueFailedUpdate(awb, zohoShipmentId);
                    }
                } catch (error) {
                    console.error(`Unexpected error updating shipment details for AWB: ${awb}`);
                    // Queue the failed update instead of stopping everything
                    queueFailedUpdate(awb, zohoShipmentId);
                }
            } else {
                console.warn(`Missing required data for update - AWB: ${awb}, ZohoID: ${zohoShipmentId}`);
            }
        }
    }

    return response.data;
};

// Modify the controller to process failed updates at the end
exports.createShipmentController = async (req, res) => {
    try {
        const { AWB } = req.body;

        if (!AWB || !Array.isArray(AWB) || AWB.length === 0) {
            return res.status(400).json({ error: 'AWB array is required' });
        }

        const BATCH_SIZE = 80;
        const results = [];
        let totalProcessed = 0;
        let successCount = 0;
        let failureCount = 0;
        
        // Process AWBs in batches of 80
        for (let i = 0; i < AWB.length; i += BATCH_SIZE) {
            const batch = AWB.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} with ${batch.length} AWBs`);
            
            try {
                const batchResult = await processBatch(batch);
                results.push(batchResult);

                // Count successes and failures from batch
                if (batchResult.data) {
                    batchResult.data.forEach(item => {
                        if (item.details && item.details.id) {
                            successCount++;
                        } else {
                            failureCount++;
                        }
                    });
                }

                totalProcessed += batch.length;
            } catch (error) {
                console.error(`Batch processing error:`, error);
                failureCount += batch.length;
            }

            // Add delay between batches
            await delay(2000);
        }

        // Process any failed updates
        const failedProcessingResult = await processFailedUpdates();
        
        res.status(200).json({ 
            message: 'Shipment processing completed',
            summary: {
                total_shipments: AWB.length,
                processed: totalProcessed,
                successful: successCount,
                failed: failureCount,
                failed_updates: failedUpdates.length
            },
            data: results,
            failedUpdates: {
                processed: failedProcessingResult,
                remaining: failedUpdates.length,
                items: failedUpdates
            }
        });
    } catch (error) {
        console.error('Error creating Zoho shipment:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        
        res.status(500).json({ 
            error: 'Failed to process shipments',
            summary: {
                total_shipments: AWB.length,
                processed: totalProcessed,
                successful: successCount,
                failed: failureCount,
                failed_updates: failedUpdates.length
            },
            partialResults: results
        });
    }
};

// Add a new endpoint to retry failed updates
exports.retryFailedUpdates = async (req, res) => {
    try {
        const result = await processFailedUpdates(5); // Try with 5 retries
        res.status(200).json(result);
    } catch (error) {
        console.error('Error processing failed updates:', error);
        res.status(500).json({ 
            error: 'Failed to process updates',
            message: error.message
        });
    }
};