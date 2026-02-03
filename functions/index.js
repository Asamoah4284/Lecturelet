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

/**
 * TradingView-style alert evaluator.
 * Runs every 2 minutes; evaluates active alerts, triggers once per condition, sends FCM with user's selected sound.
 * Current value source: Firestore collection "marketData", document id = alert.symbol, field "value" (number).
 */
exports.evaluateAlerts = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
  })
  .pubsub.schedule('every 2 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const { getAllActiveAlerts, markAlertTriggered } = require('./backend-src/services/firestore/alerts');
    const { sendAlertToUser } = require('./backend-src/services/fcm/pushNotificationService');
    const admin = require('firebase-admin');
    const db = admin.firestore();

    const active = await getAllActiveAlerts();
    if (active.length === 0) return null;

    const marketRef = db.collection('marketData');
    for (const alert of active) {
      try {
        let currentValue = null;
        if (alert.symbol) {
          const snap = await marketRef.doc(String(alert.symbol)).get();
          if (snap.exists && typeof snap.data().value === 'number') {
            currentValue = snap.data().value;
          }
        }
        if (currentValue === null) continue;

        const threshold = Number(alert.threshold);
        const conditionType = alert.conditionType || 'value_above';
        const met =
          conditionType === 'value_above'
            ? currentValue >= threshold
            : conditionType === 'value_below'
              ? currentValue <= threshold
              : false;

        if (!met) continue;

        const wasNew = await markAlertTriggered(alert.id);
        if (!wasNew) continue;

        const title = alert.title || 'Alert';
        const body = alert.body || `Condition met: ${alert.symbol} ${conditionType} ${threshold}`;
        await sendAlertToUser(alert.userId, title, body, {
          type: 'alert',
          alertId: alert.id,
          symbol: alert.symbol || '',
          conditionType,
          threshold: String(threshold),
        });
      } catch (err) {
        console.error('Alert evaluation error', alert.id, err);
      }
    }
    return null;
  });
