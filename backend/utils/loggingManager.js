// creating this reusable module to manage logging status
// This module will be used in the createShipment and updateShipment controllers

const LoggingManager = {
    isLoggingEnabled: false,
    enableLogging() {
        this.isLoggingEnabled = true;
        return { status: 'enabled' };
    },
    disableLogging() {
        this.isLoggingEnabled = false;
        return { status: 'disabled' };
    },
    getStatus() {
        return {
            isEnabled: this.isLoggingEnabled
        };
    }
};

module.exports = LoggingManager;
