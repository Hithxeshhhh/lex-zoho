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

if (!ZOHO_SHIPMENTS_API || !ZOHO_OAUTH_TOKEN || !LEX_SHIPMENT_API || 
    !SHIPMENT_BEARER_TOKEN || !LEX_CUSTOMER_DETAIL_API || !BEARER_TOKEN || !ZOHO_DEAL_API || !ZOHO_ACCOUNTS_API) {
    throw new Error('API configuration is missing. Please check environment variables.');
}

const updateShipmentDetails = async (awbNumber, zohoShipmentId) => {
    try {
        const url = `${LEX_UPDATE_SHIPEMENT_API}AWB=${awbNumber}&Zoho_Shipment_Id=${zohoShipmentId}`;
        const headers = {
            'Authorization': `Bearer ${SHIPMENT_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        };
        await axios.get(url, { headers });
    } catch (error) {
        throw new Error(`Failed to update shipment details for AWB: ${awbNumber}, Error: ${error.message}`);
    }
};

const getShipmentDetails = async (awb) => {
    try {
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

const getZohoAccountDetails = async (customerId) => {
    try {
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
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
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
    // Add debug logs
    console.log('Shipment Details:', JSON.stringify(details, null, 2));
    
    // Get customer details
    const customerDetails = await getCustomerDetails(details.Customer_ID);
    console.log('Customer Details:', JSON.stringify(customerDetails, null, 2));
    
    // Get deal details using customer ID
    const dealDetails = await getZohoDealDetails(details.Customer_ID);
    console.log('Deal Details:', JSON.stringify(dealDetails, null, 2));
    
    // Get account details using customer ID
    const accountDetails = await getZohoAccountDetails(details.Customer_ID);
    console.log('Account Details:', JSON.stringify(accountDetails, null, 2));

    const dealObject = dealDetails ? {
        name: dealDetails.Deal_Name || "",
        id: dealDetails.id || ""
    } : null;

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
            Description: details.Description || "",
            Billed_Weight: details.Billed_Weight ? parseFloat(details.Billed_Weight).toFixed(2) : "",
            Proforma_No: details.Proforma_No || "",
            IOSS_EORI: details.IOSS_EORI || "",
            Date_of_Creation: details.Date_of_Creation ? new Date(details.Date_of_Creation).toISOString().split('T')[0] : "",
            Final_Inv_Date: details.Final_Inv_Date ? 
                convertDateFormat(details.Final_Inv_Date) : 
                "",
            MIS_Weight: details.MIS_Weight || "",
            Record_Status__s: details.Record_Status__s || "",
            Customer_Types: details.Customer_Types || "",
            Seller_Name: dealObject,
            Seller_ID: details.Seller_ID || "",
            Service_Type: details.Service_Type || "",
            Billed_Wt: details.Billed_Wt ? parseFloat(details.Billed_Wt).toFixed(2) : "",
            Product_Type: details.Product_Type || "",
            MAWB: details.MAWB || "",
            Value_Currency: details.Value_Currency || "",
            Blue_Dart_Delivered_Date: details.Blue_Dart_Delivered_Date ? new Date(details.Blue_Dart_Delivered_Date).toISOString().split('T')[0] : "",
            Booked_Date: details.Booked_Date ? new Date(details.Booked_Date).toISOString().split('T')[0] : "",
            Created_Time: details.Created_Time ? new Date(details.Created_Time).toISOString().split('T')[0] : "",
            Picked_Date: details.Picked_Date ? new Date(details.Picked_Date).toISOString().split('T')[0] : "",
            Create_Pick_Up_Date: details.Create_Pick_Up_Date ? new Date(details.Create_Pick_Up_Date).toISOString().split('T')[0] : "",
            Receival_Scan_Date: details.Receival_Scan_Date ? new Date(details.Receival_Scan_Date).toISOString().split('T')[0] : "",
            Bagged_Date: details.Bagged_Date ? new Date(details.Bagged_Date).toISOString().split('T')[0] : "",
            Sent_for_Customs_Clearance: details.Sent_for_Customs_Clearance ? new Date(details.Sent_for_Customs_Clearance).toISOString().split('T')[0] : "",
            Customs_Cleared: details.Customs_Cleared ? new Date(details.Customs_Cleared).toISOString().split('T')[0] : "",
            Uplifted: details.Uplifted ? new Date(details.Uplifted).toISOString().split('T')[0] : "",
            Arrived_at_International_Hub_Date: details.Arrived_at_International_Hub_Date ? new Date(details.Arrived_at_International_Hub_Date).toISOString().split('T')[0] : "",
            Delivered_Date: details.Delivered_Date ? new Date(details.Delivered_Date).toISOString().split('T')[0] : "",
            Held_at_Customs: details.Held_at_Customs ? new Date(details.Held_at_Customs).toISOString().split('T')[0] : "",
            Date_of_Cancellation: details.Date_of_Cancellation ? new Date(details.Date_of_Cancellation).toISOString().split('T')[0] : "",
            Sales_Person_Name: details.Sales_Person_Name || "",
            Prospect_Name: dealObject,
            Cust_ID_s: accountDetails ? {
                name: accountDetails.Account_Name || "",
                id: accountDetails.id || ""
            } : null,
            HS_Code: details.HS_CODE || "",
        }]
    };

    // Debug final payload
    console.log('Final Payload:', JSON.stringify(payload, null, 2));
    
    return payload;
};

exports.createShipmentController = async (req, res) => {
    try {
        const { AWB } = req.body;

        if (!AWB || !Array.isArray(AWB) || AWB.length === 0) {
            return res.status(400).json({ error: 'AWB array is required' });
        }

        const promises = AWB.map(async (awb) => {
            const shipmentDetails = await getShipmentDetails(awb);
            const mappedPayload = await mapShipmentDetailsToPayload(shipmentDetails);
            return { awb, shipmentData: mappedPayload.data[0] };
        });

        const payloadData = await Promise.all(promises);
        const payload = { data: payloadData.map(item => item.shipmentData) };

        // Create shipment
        const response = await axios.post(`${ZOHO_SHIPMENTS_API}`, payload, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
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
                const awb = AWB[i];
                
                console.log('Extracted values:', {
                    zohoShipmentId,
                    awb,
                    responseItemDetails: responseItem?.details
                });

                if (zohoShipmentId && awb) {
                    console.log(`Updating shipment details for AWB: ${awb} with Zoho ID: ${zohoShipmentId}`);
                    await updateShipmentDetails(awb, zohoShipmentId);
                } else {
                    console.warn(`Missing required data for update - AWB: ${awb}, ZohoID: ${zohoShipmentId}`);
                }
            }
        } else {
            console.warn('No data array found in response:', response.data);
        }

        res.status(200).json({ 
            message: 'Shipment created and updated successfully',
            data: response.data 
        });
    } catch (error) {
        console.error('Error creating Zoho shipment:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        res.status(500).json({ error: 'Failed to create shipment' });
    }
};

//update shipment details


require('dotenv').config();
const axios = require('axios')

const {
    ZOHO_OAUTH_TOKEN,
    ZOHO_SHIPMENTS_API,
    LEX_SHIPMENT_API,
    SHIPMENT_BEARER_TOKEN,
    LEX_UPDATE_SHIPEMENT_API,
    
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

exports.updateShipmentController = async (req, res) => {
    try {
        // Validate request parameters
        const { shipmentIds } = req.body;
        if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            return res.status(400).send('shipmentIds array is required');
        }

        // Process each shipment ID
        const promises = shipmentIds.map(async (zohoShipmentId) => {
            try {
                // Fetch existing shipment details
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

                // First, get the Prospect ID when fetching existing shipment data
                const prospectId = existingShipmentData.Prospect_Name?.id;

                // Then modify the Seller_Name mapping in updatedFields
                const updatedFields = {

                    Name: additionalShipmentDetails.Name || "",
                    Currency: additionalShipmentDetails.Currency || "",
                    Weight_Slab: additionalShipmentDetails.Weight_Slab || "",
                //     Prospect_Name: {
                //     name: details.Prospect_Name?.name || "", //automatically mapped by Zoho
                //     id: details.Prospect_Name?.id || ""
                // },
                // Cust_ID_s: {
                //     name: additionalShipmentDetails.Cust_ID_s?.name || "", // FROM LEX SHIPMENT API
                //     id: !isNaN(additionalShipmentDetails.Cust_ID_s?.id) ? additionalShipmentDetails.Cust_ID_s.id : ""
                // },
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
                    Date_of_Creation: additionalShipmentDetails.Date_of_Creation ? new Date(additionalShipmentDetails.Date_of_Creation).toISOString().split('T')[0] : "",
                    Final_Inv_Date: additionalShipmentDetails.Final_Inv_Date ? 
                        convertDateFormat(additionalShipmentDetails.Final_Inv_Date) : 
                        "",
                    MIS_Weight: additionalShipmentDetails.MIS_Weight || "",
                    Record_Status__s: additionalShipmentDetails.Record_Status__s || "",
                    Customer_Types: additionalShipmentDetails.Customer_Types || "",
                    // Seller_Name: additionalShipmentDetails.Seller_Name ? {
                    //     name: additionalShipmentDetails.Seller_Name,
                    //     id: prospectId || existingShipmentData.Seller_Name?.id || ""
                    // } : null,
                    Seller_ID: additionalShipmentDetails.Seller_ID || "LEX",
                    Service_Type: additionalShipmentDetails.Service_Type || "",
                    Billed_Wt: additionalShipmentDetails.Billed_Wt ? parseFloat(additionalShipmentDetails.Billed_Wt).toFixed(2) : "",
                    Product_Type: additionalShipmentDetails.Product_Type || "",
                    MAWB: additionalShipmentDetails.MAWB || "",
                    Value_Currency: additionalShipmentDetails.Value_Currency || "",
                    Blue_Dart_Delivered_Date: additionalShipmentDetails.Blue_Dart_Delivered_Date ? new Date(additionalShipmentDetails.Blue_Dart_Delivered_Date).toISOString().split('T')[0] : "",
                    Booked_Date: additionalShipmentDetails.Booked_Date ? new Date(additionalShipmentDetails.Booked_Date).toISOString().split('T')[0] : "",
                    Created_Time: additionalShipmentDetails.Created_Time ? new Date(additionalShipmentDetails.Created_Time).toISOString().split('T')[0] : "",
                    Picked_Date: additionalShipmentDetails.Picked_Date ? new Date(additionalShipmentDetails.Picked_Date).toISOString().split('T')[0] : "",
                    Create_Pick_Up_Date: additionalShipmentDetails.Create_Pick_Up_Date ? new Date(additionalShipmentDetails.Create_Pick_Up_Date).toISOString().split('T')[0] : "",
                    Receival_Scan_Date: additionalShipmentDetails.Receival_Scan_Date ? new Date(additionalShipmentDetails.Receival_Scan_Date).toISOString().split('T')[0] : "",
                    Bagged_Date: additionalShipmentDetails.Bagged_Date ? new Date(additionalShipmentDetails.Bagged_Date).toISOString().split('T')[0] : "",
                    Sent_for_Customs_Clearance: additionalShipmentDetails.Sent_for_Customs_Clearance ? new Date(additionalShipmentDetails.Sent_for_Customs_Clearance).toISOString().split('T')[0] : "",
                    Customs_Cleared: additionalShipmentDetails.Customs_Cleared ? new Date(additionalShipmentDetails.Customs_Cleared).toISOString().split('T')[0] : "",
                    Uplifted: additionalShipmentDetails.Uplifted ? new Date(additionalShipmentDetails.Uplifted).toISOString().split('T')[0] : "",
                    Arrived_at_International_Hub_Date: additionalShipmentDetails.Arrived_at_International_Hub_Date ? new Date(additionalShipmentDetails.Arrived_at_International_Hub_Date).toISOString().split('T')[0] : "",
                    Delivered_Date: additionalShipmentDetails.Delivered_Date ? new Date(additionalShipmentDetails.Delivered_Date).toISOString().split('T')[0] : "",
                    Held_at_Customs: additionalShipmentDetails.Held_at_Customs ? new Date(additionalShipmentDetails.Held_at_Customs).toISOString().split('T')[0] : "",
                    Date_of_Cancellation: additionalShipmentDetails.Date_of_Cancellation ? new Date(additionalShipmentDetails.Date_of_Cancellation).toISOString().split('T')[0] : "",
                    Sales_Person_Name: additionalShipmentDetails.Sales_Person_Name || "",
                    HS_Code: additionalShipmentDetails.HS_CODE || "",
                    // Add other fields as needed
                };

                // Construct Payload
                const payload = {
                    data: [
                        {
                            ...updatedFields,
                            
                        }
                    ]
                };

                // Log the payload for debugging
                console.log(`Updating shipment ${zohoShipmentId} with payload:`, JSON.stringify(payload, null, 2));

                // Update shipment
                const updateResponse = await axios.put(`${ZOHO_SHIPMENTS_API}/${zohoShipmentId}`, payload, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                return updateResponse.data;
            } catch (error) {
                console.error(`Error updating shipment ${zohoShipmentId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
                return { error: `Failed to update shipment ${zohoShipmentId}: ${error.message}` };
            }
        });

        const results = await Promise.all(promises);

        res.status(200).json({ message: 'Batch update completed', results });
    } catch (error) {
        console.error('Error updating shipments:', error.message);
        res.status(500).json({ error: `Failed to update shipments: ${error.message}` });
    }
};
