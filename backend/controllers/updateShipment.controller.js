require('dotenv').config();
const axios = require('axios')

const {
    ZOHO_OAUTH_TOKEN,
    ZOHO_SHIPMENTS_API,
    LEX_SHIPMENT_API,
    SHIPMENT_BEARER_TOKEN,
    LEX_UPDATE_SHIPEMENT_API,
    ZOHO_DEAL_API,
    LEX_CUSTOMER_DETAIL_API,
    BEARER_TOKEN,
} = process.env



const getShipmentController = async (req, res) => {
    try {
        const { shipmentIds } = req.body;

        // Validating request parameters
        if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).json({ error: 'shipmentIds array is required' });
        }

        // Calling the shipment get API for each shipment ID
        const promises = shipmentIds.map(async (zohoShipmentId) => {
            try {
                const shipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                const shipmentData = shipmentResponse.data;
                const awb = shipmentData.data[0].Name; // Extracting the Name value

                // Call getShipmentDetails with the extracted awb
                const shipmentDetails = await getShipmentDetails(awb);

                return { zohoShipmentId, data: shipmentData, shipmentDetails };
            } catch (error) {
                return { zohoShipmentId, error: error.response ? error.response.data : error.message };
            }
        });

        const results = await Promise.all(promises);

        // Print the results
        console.log('Shipment API responses:', results);

        // Send Response
        res.status(200).json({ message: 'Batch processing completed', results });
    } catch (error) {
        console.error('Error fetching shipments:', error.message);
        res.status(500).json({ error: `Failed to fetch shipment details: ${error.message}` });
    }
};


const getShipmentDetails = async (awb) => {
    try {
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

const updateShipmentDetails = async (awb, zohoShipmentId) => {
    try {
        const url = `${LEX_UPDATE_SHIPEMENT_API}AWB=${awb}&Zoho_Shipment_Id=${zohoShipmentId}`;
        const headers = {
            'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
       const response =  await axios.post(url,{}, { headers });
       console.log(`Response for AWB ${awb}:`, response.data); // Print the response data
    } catch (error) {
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

// Add a delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const processBatch = async (shipmentIdsBatch) => {
    try {
        const results = [];
        for (const zohoShipmentId of shipmentIdsBatch) {
            try {
                await delay(100);

                console.log(`Processing shipment ID: ${zohoShipmentId}`);
                const existingShipmentResponse = await axios.get(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                const existingShipmentData = existingShipmentResponse.data.data[0];
                const awb = existingShipmentData.Name;

                // Fetch additional shipment details
                const additionalShipmentDetails = await getShipmentDetails(awb);
                await updateShipmentDetails(awb, zohoShipmentId);

                // Get deal details using customer ID
                const dealDetails = await getZohoDealDetails(additionalShipmentDetails.Customer_ID);
                console.log('Deal Details:', JSON.stringify(dealDetails, null, 2));
                console.log('Additional Shipment Details:', JSON.stringify(additionalShipmentDetails, null, 2));

                // Create deal object
                const dealObject = dealDetails ? {
                    name: dealDetails.Deal_Name || "",
                    id: dealDetails.id || ""
                } : null;

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
                    Description: additionalShipmentDetails.Description || "",
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
                    Uplifted: additionalShipmentDetails.Uplifted ? new Date(additionalShipmentDetails.Uplifted).toISOString().split('T')[0] : "",
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
                    Reached_Destnation_Country: additionalShipmentDetails.Reached_destination_country_date
                    ? additionalShipmentDetails.Reached_destination_country_date.split(' ')[0]
                    : "",
                    Create_Pick_Up_Time: additionalShipmentDetails.Create_Pick_Up_Time || "",
                    Seller_Name2:additionalShipmentDetails.Seller_Name || "",
                    // Prospect_Name: dealObject,
                };

                // Construct Payload
                const payload = {
                    data: [{ ...updatedFields }]
                };
                   console.log('Payload:', JSON.stringify(payload, null, 2));
                // Update shipment
                const updateResponse = await axios.put(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, payload, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                results.push({ zohoShipmentId, status: 'success', data: updateResponse.data });
            } catch (error) {
                console.error(`Error updating shipment ${zohoShipmentId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
                results.push({ zohoShipmentId, status: 'error', error: error.message });
            }
        }
        return results;
    } catch (error) {
        throw new Error(`Batch processing failed: ${error.message}`);
    }
};

exports.updateShipmentController = async (req, res) => {
    try {
        const { shipmentIds } = req.body;

        // Validating request parameters
        if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).json({ error: 'shipmentIds array is required' });
        }

        const BATCH_SIZE = 90;
        const results = [];
        
        // Process shipmentIds in batches of 90
        for (let i = 0; i < shipmentIds.length; i += BATCH_SIZE) {
            const batch = shipmentIds.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} with ${batch.length} shipments`);
            const batchResult = await processBatch(batch);
            results.push(...batchResult);
        }

        // Group results by status
        const successfulUpdates = results.filter(r => r.status === 'success');
        const failedUpdates = results.filter(r => r.status === 'error');

        res.status(200).json({ 
            message: 'Batch processing completed',
            summary: {
                total: results.length,
                successful: successfulUpdates.length,
                failed: failedUpdates.length
            },
            results 
        });
    } catch (error) {
        console.error('Error updating shipments:', error.message);
        res.status(500).json({ error: `Failed to update shipments: ${error.message}` });
    }
};

// Add the getZohoDealDetails function if it's not already present
const getZohoDealDetails = async (customerId) => {
    try {
        const customerDetails = await getCustomerDetails(customerId);
        const zoho_deal_id = customerDetails[0].Zoho_Deal_ID;
        if (!zoho_deal_id) {
            console.log(`No Zoho Deal ID found for customer: ${customerId}`);
            return null;
        }

        const dealResponse = await axios.get(`${ZOHO_DEAL_API}/${zoho_deal_id}`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
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