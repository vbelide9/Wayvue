// Firebase Function entry point. Thin wrapper around the Express app in ./app.js — a synced
// copy of server/index.js (the single source of truth). The Hosting rewrite in firebase.json
// (`/api/**` → function "api") forwards the original `/api/*` path, which the app's routes
// already expect, so no path rewriting is needed here.
//
// To refresh after changing server/, re-run the sync (see functions/README-sync or the deploy
// notes): copy server/{index.js→app.js, services, utils, fileLogger.js} into functions/.
const functions = require('firebase-functions');
const app = require('./app');

exports.api = functions.runWith({ maxInstances: 2 }).https.onRequest(app);
