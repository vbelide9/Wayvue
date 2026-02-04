const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'debug.log');

const logDebug = (message) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
};

module.exports = logDebug;
