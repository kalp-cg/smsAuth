# LocalSMS Complete Usage and API Guide

This document is a full, practical guide to run, use, and test the LocalSMS project.
It is intentionally separate from README files and designed for new users.

## 1. What This Project Contains

The repository has these main parts:

1. `NativeGateway` (Android Kotlin app)
- Runs on your Android phone
- Exposes a local HTTP API (default port `8080`)
- Sends SMS using your device SIM

2. `otp-auth-service` (Node.js API)
- OTP generation and verification
- Calls phone local gateway to send OTP SMS
- Default port `3002`

3. `backend` (Node.js queue API)
- Simple queue-based SMS relay API
- Default port `3001`

4. `frontend` (React + Vite)
- Web UI for OTP login flow
- Default port `5173`

## 2. Prerequisites

Install the following:

1. Node.js 18+
2. npm
3. Java 17+
4. Android SDK + Platform Tools (`adb`)
5. Android phone with SMS permissions enabled in app

Optional (recommended): Android Studio

## 3. First Time Setup

From repository root:

```bash
cd backend && npm install
cd ../otp-auth-service && npm install
cd ../frontend && npm install
```

For Android app build/install:

```bash
cd ../NativeGateway
chmod +x gradlew
./gradlew installDebug
```

## 4. Start All Services

Open separate terminals.

### Terminal A: Backend queue service

```bash
cd backend
npm run start
```

Expected: running on `http://127.0.0.1:3001`

### Terminal B: OTP service

```bash
cd otp-auth-service
npm run start
```

Expected: running on `http://127.0.0.1:3002`

### Terminal C: Frontend

```bash
cd frontend
npm run dev -- --host
```

Expected:
- Local: `http://localhost:5173`
- LAN (for phone): `http://<YOUR_LAPTOP_LAN_IP>:5173`

## 5. Configure OTP Service (.env)

File: `otp-auth-service/.env`

Required values:

```env
PORT=3002
MONGODB_URI=<your_mongo_uri_or_placeholder>
OTP_HASH_SECRET=<your_secret>
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_SECONDS=30
SESSION_TTL_DAYS=7

LOCAL_SMS_GATEWAY_URL=http://<PHONE_LAN_IP>:8080
LOCAL_SMS_GATEWAY_USER=sms
LOCAL_SMS_GATEWAY_PASS=<phone_local_server_password>

SMS_TEMPLATE=Your OTP is {{OTP}}. Valid for {{MINUTES}} minutes.
RETURN_OTP_IN_RESPONSE=false
```

Notes:
1. `LOCAL_SMS_GATEWAY_URL` must use current phone local IP.
2. Password can change if app is reinstalled/reset.
3. If OTP API returns `401` from gateway, update `LOCAL_SMS_GATEWAY_PASS` and restart OTP service.

## 6. Get Phone Local IP and Credentials

### Get phone local IP (ADB)

```bash
adb shell "ip addr"
```

Look for active Wi-Fi interface with `inet` address, for example `10.139.82.131`.

### Read local server credentials from installed app (ADB)

```bash
adb shell run-as com.kalpsms.localsms cat /data/data/com.kalpsms.localsms/shared_prefs/com.kalpsms.localsms_preferences.xml
```

Check these keys:
1. `localserver.USERNAME`
2. `localserver.PASSWORD`
3. `localserver.PORT`

## 7. API Endpoints You Can Test

### A) Queue Backend API (`3001`)

Base URL: `http://127.0.0.1:3001`

1. `POST /api/messages/send`
- Queue messages for Android polling flow

2. `GET /api/messages/pending`
- See pending queue items

3. `POST /api/messages/status`
- Android reports sent/failed state

4. `GET /api/messages`
- View all queued messages

### B) OTP Auth API (`3002`)

Base URL: `http://127.0.0.1:3002`

1. `GET /health`
2. `POST /auth/send-otp`
3. `POST /auth/verify-otp`
4. `GET /auth/me` (Bearer token)
5. `POST /auth/logout` (Bearer token)

### C) Phone Local Gateway API (`8080`)

Base URL: `http://<PHONE_IP>:8080`

Use Basic Auth from app local server settings.

Common endpoints:
1. `GET /health`
2. `POST /message`
3. `GET /messages`
4. `GET /docs` (if enabled)

## 8. Ready-to-Use curl Requests

### 8.1 Queue backend send SMS

```bash
curl -X POST "http://127.0.0.1:3001/api/messages/send" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumbers":["+919727659973"],"message":"hello buddy"}'
```

### 8.2 Queue backend list messages

```bash
curl "http://127.0.0.1:3001/api/messages"
```

### 8.3 OTP send

```bash
curl -X POST "http://127.0.0.1:3002/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919727659973"}'
```

### 8.4 OTP verify

```bash
curl -X POST "http://127.0.0.1:3002/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919727659973","otp":"123456"}'
```

### 8.5 OTP health

```bash
curl "http://127.0.0.1:3002/health"
```

### 8.6 Direct phone local gateway health

```bash
curl -u "sms:<PASSWORD>" "http://<PHONE_IP>:8080/health"
```

### 8.7 Direct phone local gateway send SMS

```bash
curl -X POST "http://<PHONE_IP>:8080/message" \
  -u "sms:<PASSWORD>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumbers":["+919727659973"],"message":"hello buddy"}'
```

## 9. Postman Request Templates

Create a Postman environment:

1. `QUEUE_BASE` = `http://127.0.0.1:3001`
2. `OTP_BASE` = `http://127.0.0.1:3002`
3. `PHONE_BASE` = `http://<PHONE_IP>:8080`
4. `PHONE_USER` = `sms`
5. `PHONE_PASS` = `<PASSWORD>`
6. `authToken` = (empty initially)

### 9.1 Send OTP

- Method: `POST`
- URL: `{{OTP_BASE}}/auth/send-otp`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "phoneNumber": "+919727659973"
}
```

### 9.2 Verify OTP

- Method: `POST`
- URL: `{{OTP_BASE}}/auth/verify-otp`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "phoneNumber": "+919727659973",
  "otp": "123456"
}
```

Postman Tests tab to auto-save token:

```javascript
const json = pm.response.json();
if (json.token) {
  pm.environment.set("authToken", json.token);
}
```

### 9.3 Auth me

- Method: `GET`
- URL: `{{OTP_BASE}}/auth/me`
- Headers: `Authorization: Bearer {{authToken}}`

### 9.4 Auth logout

- Method: `POST`
- URL: `{{OTP_BASE}}/auth/logout`
- Headers: `Authorization: Bearer {{authToken}}`

### 9.5 Queue send SMS

- Method: `POST`
- URL: `{{QUEUE_BASE}}/api/messages/send`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "phoneNumbers": ["+919727659973"],
  "message": "hello buddy"
}
```

### 9.6 Phone direct send SMS

- Method: `POST`
- URL: `{{PHONE_BASE}}/message`
- Auth: Basic Auth
  - Username: `{{PHONE_USER}}`
  - Password: `{{PHONE_PASS}}`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "phoneNumbers": ["+919727659973"],
  "message": "hello buddy"
}
```

## 10. Common Problems and Fixes

1. `OTP send -> 500 LocalSMS send failed (401)`
- Wrong phone gateway password.
- Fix `.env` `LOCAL_SMS_GATEWAY_PASS` and restart OTP service.

2. `OTP send -> 429 Too Many Requests`
- Wait `OTP_RESEND_SECONDS` (default 30s).

3. `EADDRINUSE :3002`
- Another process is already using port 3002.
- Stop old process and restart.

4. Phone API unreachable
- Ensure laptop and phone are on same Wi-Fi.
- Ensure app local server is enabled in phone app.
- Re-check phone IP after Wi-Fi reconnect.

5. Android install error: package appears invalid
- Do not share unsigned release APK.
- Share debug APK or signed release APK.

## 11. Recommended Quick Verification Flow

1. `GET /health` on OTP service
2. Send direct phone gateway message (`/message`)
3. Send OTP (`/auth/send-otp`)
4. Verify OTP (`/auth/verify-otp`)
5. Test frontend login from browser

## 12. Security Checklist

1. Never commit real `.env` secrets.
2. Rotate `OTP_HASH_SECRET` for production.
3. Keep phone gateway credentials private.
4. Avoid exposing port `8080` or `3002` to public internet.
5. Use local network/private VPN only.

---

If you keep this file updated when credentials or ports change, any teammate can set up and test the full project without reading all module README files.
