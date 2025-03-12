const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);

const downloadLogsByDate = async (req, res) => {
    try {
        const { date, type } = req.query;

        if (!date) {
            return res.status(400).json({
                error: 'Date parameter is required (format: YYYY-MM)'
            });
        }

        // Only accept YYYY-MM format now
        if (!date.match(/^\d{4}-\d{2}$/)) {
            return res.status(400).json({
                error: 'Date must be in YYYY-MM format'
            });
        }

        // Validate log type
        const validTypes = ['update', 'create', 'all'];
        const logType = type?.toLowerCase() || 'all';
        
        if (!validTypes.includes(logType)) {
            return res.status(400).json({
                error: 'Invalid log type. Must be "update", "create", or "all"'
            });
        }

        const logDir = path.join(__dirname, '../logs');

        if (!fs.existsSync(logDir)) {
            return res.status(404).json({
                error: 'Logs directory not found'
            });
        }

        // Find matching log files
        const files = fs.readdirSync(logDir);
        const matchingFiles = files.filter(file => {
            const dateMatch = file.includes(`_${date}`);
            if (!dateMatch) return false;

            switch(logType) {
                case 'all':
                    return file.includes('update_shipment_logs_') || 
                           file.includes('create_shipment_logs_');
                case 'update':
                    return file.includes('update_shipment_logs_');
                case 'create':
                    return file.includes('create_shipment_logs_');
                default:
                    return false;
            }
        });

        if (matchingFiles.length === 0) {
            return res.status(404).json({
                error: 'No logs found for the specified month and type'
            });
        }

        // Process all matching files
        let combinedLogs = '';
        for (const file of matchingFiles) {
            const filePath = path.join(logDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            combinedLogs += `\n=== ${file} ===\n${content}\n`;
        }

        // Compress the logs
        const compressedLogs = await gzip(combinedLogs);

        // Set response headers
        const fileName = logType === 'all' 
            ? `all_logs_${date}.txt.gz`
            : `${logType}_logs_${date}.txt.gz`;

        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Length', compressedLogs.length);

        res.send(compressedLogs);

    } catch (error) {
        console.error('Error downloading logs:', error);
        res.status(500).json({
            error: 'Failed to download logs',
            message: error.message
        });
    }
};

const getAvailableLogDates = async (req, res) => {
    try {
        const logDir = path.join(__dirname, '../logs');

        if (!fs.existsSync(logDir)) {
            return res.status(404).json({
                error: 'Logs directory not found'
            });
        }

        const files = fs.readdirSync(logDir);
        
        // Process only update and create shipment logs
        const logInfo = files
            .filter(file => 
                file.startsWith('update_shipment_logs_') || 
                file.startsWith('create_shipment_logs_')
            )
            .map(file => {
                const type = file.startsWith('update_') ? 'update' : 'create';
                const match = file.match(/(?:update_|create_)?shipment_logs_(\d{4}-\d{2})/);
                
                if (match) {
                    const stats = fs.statSync(path.join(logDir, file));
                    return {
                        date: match[1],
                        type: type,
                        filename: file,
                        size: stats.size,
                        modified: stats.mtime
                    };
                }
                return null;
            })
            .filter(info => info !== null)
            .sort((a, b) => b.date.localeCompare(a.date));

        // Group logs by month
        const groupedLogs = logInfo.reduce((acc, log) => {
            if (!acc[log.date]) {
                acc[log.date] = {
                    date: log.date,
                    types: {}
                };
            }
            acc[log.date].types[log.type] = {
                size: log.size,
                modified: log.modified,
                filename: log.filename
            };
            return acc;
        }, {});

        res.status(200).json({
            total_files: logInfo.length,
            available_dates: Object.values(groupedLogs)
        });

    } catch (error) {
        console.error('Error getting available log dates:', error);
        res.status(500).json({
            error: 'Failed to get available log dates',
            message: error.message
        });
    }
};

module.exports = {
    downloadLogsByDate,
    getAvailableLogDates
}; 