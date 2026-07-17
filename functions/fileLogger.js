const fs = require('fs');
const os = require('os');
const path = require('path');

// Cloud Functions' working directory is read-only — only os.tmpdir() is writable — and even
// that shouldn't hard-fail the request path, so writes are best-effort.
const logPath = path.join(os.tmpdir(), 'wayvue-debug.log');

const logDebug = (message) => {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch {
        // read-only FS / disk full → skip logging rather than break the API
    }
};

module.exports = logDebug;
