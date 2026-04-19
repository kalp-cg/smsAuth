# Pulse Relay 🚀

**Pulse Relay** is a totally secure, locally-hosted Android SMS Gateway & OTP Authentication Microservice. This architecture empowers you to turn any Android device into your own personal, high-throughput SMS API gateway—completely bypassing expensive third-party providers like Twilio or Vonage for OTP authentication and local notifications.

---

## 🌟 Architecture Overview

This project is a 3-part microservice architecture:

1. **NativeGateway:** A Native Android application that listens for HTTP commands and physically sends SMS messages via your device's cellular carrier.
2. **OTP-Auth-Service (Backend):** A Node.js and MongoDB-powered microservice that creates secure OTP codes, stores them with TTL expiry in the cloud, and triggers the NativeGateway over your local network to send the SMS to the user.
3. **Frontend Dashboard:** A React.js administrative UI to view logs, authentication states, and test integrations directly.

---

## 🎬 Demo and Docs Links

1. YouTube Demo: https://youtu.be/fwpzjvzSN14?si=tVJXcWxhqVgpWyJ7
2. Local Frontend Docs: http://localhost:5173/docs
3. Deployment: Frontend is deployed on Vercel.

---

## 📲 1. Setting up the Android Gateway (Release App)

To make things easy, we have bundled the entire Android system into a ready-to-use APK.

### Installation
1. Go to the **[Releases Section](../../releases)** (or look in your local `release/` folder).
2. Download the `PulseRelay.apk`.
3. Transfer it to your Android device and install it (you may need to allow "Install from Unknown Sources").

### Configuration
1. Open the **Pulse Relay** app on your phone.
2. Run through the permission checks: **Grant SMS Permissions** and **Ignore Battery Optimization** (so the background server continues to run when your screen is off).
3. Start the Local Server. The app will display an Local IP address (e.g., `http://192.168.1.100:8080`).
4. Configure a username and password inside the app settings to keep your SMS network private.

---

## ⚙️ 2. Setting up the OTP Authentication Backend

The backend links your production web app/login system with the local native Gateway so it can fire OTP codes seamlessly.

### Prerequisites
* Node.js v18+
* A completely free MongoDB Atlas cluster.

### Setup and Environment Variables
1. Navigate to the `otp-auth-service` folder.
2. Install standard dependencies:
   ```bash
   cd otp-auth-service
   npm install
   ```
3. Create a `.env` file from the supplied `.env.example` template:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` settings carefully:
   ```env
   PORT=3002
   MONGODB_URI=mongodb+srv://<db_user>:<db_password>@cluster0.mongodb.net/otp_auth?retryWrites=true&w=majority&appName=PulseRelay
   
   # Set these matching what you typed into your Android Application!
   LOCAL_PULSE_RELAY_URL=http://<YOUR_PHONE_IP>:8080
   LOCAL_PULSE_RELAY_USER=admin
   LOCAL_PULSE_RELAY_PASS=my_secure_password
   ```

5. Launch the OTP Microservice!
   ```bash
   node server.js
   ```

It will now spin up an API at `http://localhost:3002`.

---

## 🖥 3. Setting up the Frontend Dashboard

The frontend is a local dashboard to track your SMS health, login systems, and authentication tokens.

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```
2. Run the local development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🧪 How To Use It

Once everything is up, you essentially have your own Twilio setup. You can trigger an OTP from any app using a simple POST request to the local Auth service:

```bash
curl -X POST http://localhost:3002/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

**What Happens:**
1. Your Node.js backend generates a token `645831` and saves it to MongoDB.
2. It talks privately to your Android Phone at `192.168.1.100`.
3. The Pulse Relay Android App automatically dials the cellular API and texts your user.

---
### 🔒 Security Warning
Ensure that your Android Local Server user & password remain strictly inside `.env` files that *never* get checked into Git. Use internal IP addresses to ensure external actors can't trigger random texts from your phone.

*Created locally as a secure standard API alternative.*
