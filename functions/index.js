/**
 * LectureLet API - Firebase Cloud Functions
 * Hosts the full Express backend so you don't need Render.
 *
 * Deploy: firebase deploy --only functions
 * URL: https://<region>-<project>.cloudfunctions.net/api
 * Set EXPO_PUBLIC_API_URL to that URL + /api (e.g. https://us-central1-lecturelet-c03be.cloudfunctions.net/api)
 */

const functions = require('firebase-functions');
const server = require('./backend-src/server');
const getAppReady = server.getAppReady || (() => Promise.resolve(server));

let appReady = null;

exports.api = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onRequest(async (req, res) => {
    if (!appReady) {
      appReady = getAppReady();
    }
    const app = await appReady;
    app(req, res);
  });
