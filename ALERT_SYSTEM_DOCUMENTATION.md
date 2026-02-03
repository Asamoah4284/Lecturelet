# TradingView-Style Alert System

Production-ready alert system with Firebase (Firestore, Cloud Functions, FCM), custom notification sounds, and React Native sound picker.

---

## 1. Firestore Data Model

### Collection: `users`
User profile; stores selected alert/notification sound.

| Field | Type | Description |
|-------|------|-------------|
| `notificationSound` | string | `'default'` \| `'r1'` \| `'r2'` \| `'r3'` \| `'none'` |
| (other profile fields) | | |

- **Applying preference**: When an alert triggers, Cloud Function / backend fetches `users/{userId}.notificationSound` and injects the corresponding sound into the FCM payload.

### Collection: `alerts`
One document per alert; condition evaluated by Cloud Function; trigger once per condition.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Firestore user ID (Firebase UID) |
| `conditionType` | string | `'value_above'` \| `'value_below'` |
| `threshold` | number | Value to compare against |
| `symbol` | string \| null | Identifier for data source (e.g. ticker); used to read `marketData/{symbol}.value` |
| `title` | string | Notification title |
| `body` | string \| null | Notification body |
| `triggeredAt` | Timestamp \| null | Set when condition fires (ensures single-fire) |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

### Collection: `marketData`
Source of “current value” for alert evaluation. Document ID = `symbol`; field `value` = number.

| Document ID | Field | Type | Description |
|-------------|--------|------|-------------|
| e.g. `BTC` | `value` | number | Current value used for `value_above` / `value_below` |

- Example: To test an alert for symbol `BTC` with threshold 50000, create `marketData/BTC` with `{ value: 50000 }` (or higher for `value_above`). After the next evaluator run, the alert will fire once and `triggeredAt` will be set.

### Collection: `deviceTokens`
FCM tokens per user (existing). Used by `sendAlertToUser` to send the push.

---

## 2. Cloud Function: Alert Evaluation

**Function**: `evaluateAlerts` (scheduled).

- **Schedule**: Every 2 minutes (UTC).
- **Logic**:
  1. `getAllActiveAlerts()` (alerts where `triggeredAt == null`).
  2. For each alert, read current value from `marketData/{alert.symbol}.value`.
  3. If no document or no `value`, skip.
  4. If condition met (`value_above` ⇒ `currentValue >= threshold`, `value_below` ⇒ `currentValue <= threshold`):
     - `markAlertTriggered(alert.id)` in a **transaction** (so it runs only once).
     - If `markAlertTriggered` returns true (was not already triggered), call `sendAlertToUser(alert.userId, title, body, data)`.
  5. `sendAlertToUser` loads `users/{userId}.notificationSound`, builds FCM payload with that sound (and Android channelId), and sends to all of the user’s device tokens.

**Deploy**: `npm run predeploy` (or copy backend into functions) then `firebase deploy --only functions`.

---

## 3. FCM Notification Payload Examples

### Android (FCM)

- **Custom sound** (e.g. `r1.wav`): use a **channel** that has that sound; reference the **same** sound in the notification.
- **Fallback**: If the sound file is missing in the app, use `sound: 'default'` and a channel that uses default sound.

```json
{
  "token": "<FCM_TOKEN>",
  "notification": {
    "title": "Alert",
    "body": "Condition met: BTC value_above 50000"
  },
  "data": {
    "type": "alert",
    "alertId": "<ALERT_ID>",
    "symbol": "BTC",
    "conditionType": "value_above",
    "threshold": "50000"
  },
  "android": {
    "priority": "high",
    "notification": {
      "sound": "r1.wav",
      "channelId": "default_r1"
    }
  }
}
```

- Sound filename must match a file in `android/app/src/main/res/raw/` (e.g. `r1.wav` → raw resource name is typically `r1`; Expo/plugin may expect `r1.wav` in the payload). Use **lowercase** filenames.
- `channelId` must match an Android channel created in the app with that same sound (e.g. `default_r1` for Sound 1).

### iOS (APNs via FCM)

- **Custom sound**: set `aps.sound` to the **filename** (e.g. `r1.wav`) as present in the app bundle.
- **Silent mode**: iOS respects silent mode unless the app uses critical alerts (special entitlement). Normal alerts will not play sound when the device is in silent mode.
- **Fallback**: If the file is missing, use `aps.sound: "default"`.

```json
{
  "token": "<FCM_TOKEN>",
  "notification": {
    "title": "Alert",
    "body": "Condition met: BTC value_above 50000"
  },
  "data": {
    "type": "alert",
    "alertId": "<ALERT_ID>",
    "symbol": "BTC"
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "r1.wav",
        "badge": 1,
        "content-available": 0
      }
    }
  }
}
```

- Sound file must be in the app bundle (e.g. via Xcode or Expo config plugin). Filename **lowercase** recommended.

---

## 4. Sound Assets

### Android

- **Location**: `android/app/src/main/res/raw/`
- **Format**: `.wav` (or supported format); filenames **lowercase** (e.g. `r1.wav`, `r2.wav`, `r3.wav`).
- **Expo**: In `app.json` → `plugins` → `expo-notifications` → `sounds`: list paths to these files; prebuild will copy them into `res/raw/`.
- **Reference in payload**: Use the **base filename** (e.g. `r1.wav`) in FCM `android.notification.sound` and ensure an Android **notification channel** with the same sound and a stable `channelId` (e.g. `default_r1`) is created in the app. Send the notification with that `channelId`.

### iOS

- **Location**: Add sound files to the Xcode project (main bundle), or rely on Expo config plugin to include them.
- **Reference**: In FCM `apns.payload.aps.sound` use the **filename** (e.g. `r1.wav`). Lowercase recommended.
- **Silent mode**: Notifications will not play sound when the device is in silent mode unless you use critical alerts (requires Apple entitlement).

### Fallback

- If the user chooses an invalid or missing sound, backend/function uses `sound: 'default'` (and on Android a channel that uses default sound).
- Implemented in `getSoundFilenameForPayload()` and `buildAlertMessage()`: invalid preference → `'default'`; `'none'` → no sound (Android channel `default_silent` / iOS omit or default as appropriate).

---

## 5. React Native: Sound Picker and Persistence

### Screen: `AlertSoundPickerScreen`

- **List**: Default, Sound 1 (r1), Sound 2 (r2), Sound 3 (r3), None (Silent).
- **Preview on tap**: Schedules a local notification in 1 second with the selected sound so the user hears it immediately.
- **Select**: Tapping an option sets it as selected (visual checkmark) and saves.
- **Persistence**: Saves to backend `PUT /api/auth/profile` with `{ notificationSound: value }`; backend updates Firestore `users/{userId}.notificationSound`. Also stored in AsyncStorage and in-memory user data for the app.

### Navigation

- Screen is registered as `AlertSoundPicker`. Open it from Settings (e.g. “Alert sound”) with `navigation.navigate('AlertSoundPicker')`.

### Flow

1. User opens Alert Sound Picker.
2. Load current preference from API or AsyncStorage.
3. On tap: preview (local notification) + set selection + call API to save; backend writes Firestore.
4. When an alert fires, Cloud Function / backend reads `users/{userId}.notificationSound` and uses it in the FCM payload.

---

## 6. Platform Constraints and Fallbacks

- **iOS**  
  - Respects silent mode (no sound unless critical alerts).  
  - Notification permissions required; request alert, sound, badge.  
  - Use `aps.sound` with filename or `default`; fallback to `default` if file missing.

- **Android**  
  - Use a **notification channel** per sound (or default/silent). Channel sound is fixed after creation; to change, delete and recreate the channel.  
  - High priority and correct `channelId` so the notification appears and uses the right sound.  
  - Fallback: if custom sound is missing, use a channel that has `sound: 'default'`.

- **Missing custom sound**  
  - Backend uses `getSoundFilenameForPayload()` and returns `'default'` for unknown values; `buildAlertMessage` uses that so FCM always sends a valid sound or silent.

---

## 7. Common Failure Points and Debugging

### Alerts not firing

- **Scheduled function not running**: Check Firebase Console → Functions → `evaluateAlerts` logs and invocations. Ensure the function is deployed and the schedule is enabled.
- **No current value**: Ensure `marketData/{symbol}` exists and has a numeric `value`. Check Cloud Function logs for “skipped” alerts.
- **Already triggered**: `triggeredAt` is set; only one fire per alert. Create a new alert to test again.

### Notifications not received (app closed)

- **FCM token**: Ensure the app registers the FCM token and saves it to Firestore (e.g. `deviceTokens`). If the token is Expo push token instead of FCM, replace with FCM registration.
- **Android**: Use a channel with high importance and correct `channelId` in the payload. Check device battery/Doze; unrestrict the app if needed.
- **iOS**: Ensure `UIBackgroundModes` includes `remote-notification`. Use a real device; check notification permissions.

### Custom sound not playing

- **Android**  
  - Confirm the sound file exists in `res/raw/` (after prebuild/build).  
  - Confirm the app creates a channel with that sound (e.g. `default_r1` with `sound: 'r1.wav'`).  
  - Send the notification with `android.notification.channelId` matching that channel and `android.notification.sound` set to the same filename.  
  - If the channel was created earlier without the custom sound, uninstall the app, rebuild, and reinstall so the channel is recreated.

- **iOS**  
  - Confirm the sound file is in the app bundle (check Xcode or built IPA).  
  - Use exact filename in `aps.sound` (e.g. `r1.wav`).  
  - Device in silent mode will not play sound unless using critical alerts.

### Silent notifications

- **iOS**: Silent mode or “Do Not Disturb” can suppress sound. This is expected unless you use critical alerts.
- **Android**: Check that the notification channel is not muted and that the app has notification permission. Verify `priority: 'high'` and correct `channelId` in the FCM payload.
- **Payload**: Ensure you send a **notification** payload (title/body) so the system displays and plays the notification. Data-only messages may not show or play sound.

### Debugging checklist

1. Cloud Function: Log `getAllActiveAlerts()` count and each alert id/symbol/threshold/currentValue and whether condition met and whether `markAlertTriggered` returned true.
2. FCM: Log the built message (token redacted) before `messaging.send()`: `android.notification.sound`, `android.notification.channelId`, `apns.payload.aps.sound`.
3. Firestore: Confirm `users/{userId}.notificationSound` and `deviceTokens` for that user.
4. App: Confirm FCM token is registered and that the same channel IDs and sound filenames exist in the client (Expo notification config / native code).

---

## 8. File Reference

| Component | Path |
|-----------|------|
| Firestore alerts service | `backend/src/services/firestore/alerts.js` |
| FCM alert helper + buildAlertMessage | `backend/src/services/fcm/pushNotificationService.js` |
| Cloud Function evaluateAlerts | `functions/index.js` |
| Alerts API (create, list, get) | `backend/src/routes/alerts.js` |
| Sound picker screen | `frontend/screens/AlertSoundPickerScreen.js` |
| Sound config | `frontend/config/notificationSounds.js` |
| Notification channels (Android) | `frontend/services/notificationService.js` |
