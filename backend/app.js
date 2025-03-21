const express = require("express");
const cors = require("cors");
const http = require("http");
const https = require("https");
const fs = require("fs");
const router = require("./routes/routes");
const logRoutes = require('./routes/logs.routes');
const cron = require('node-cron');
const { syncShipments } = require('./shipmentSyncCron');
require("dotenv").config(); // Ensure to invoke the config function

const app = express();

// CORS Configuration
const corsOptions = {
    origin: [
        'http://localhost:5173', // Your local development frontend
        'http://localhost:3000',
        'https://lexship.biz', // Add your production domain
        /\.lexship\.biz$/ // Allow all subdomains of lexship.biz
    ],
    methods: ['GET', 'POST', 'PUT','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Add CORS headers middleware as backup
app.use((req, res, next) => {
    // Check if origin matches allowed patterns
    const origin = req.headers.origin;
    if (corsOptions.origin.some(pattern => 
        typeof pattern === 'string' 
            ? pattern === origin 
            : pattern.test(origin)
    )) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

const port = process.env.PORT || 3000;
app.use("/api/v1", router);
app.use('/api/v1', logRoutes);

// Initialize cron job for shipment sync
console.log('Initializing shipment sync cron job...');
cron.schedule('0 4 * * *', async () => {
    console.log('Running scheduled shipment sync...');
    try {
        await syncShipments();
        console.log('Scheduled shipment sync completed successfully');
    } catch (error) {
        console.error('Error in scheduled shipment sync:', error);
    }
});

if (process.env.NODE_ENV === "local") {
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`Servers running on ${port}...`);
  });
} else {
  let keyPath = process.env.KEY_DEV;
  let certPath = process.env.CERT_DEV;
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  const server = https.createServer(options, app);
  server.listen(port, () => {
    console.log(`Server running on ${port}...`);
  });
} 