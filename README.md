# Pulse Relay 🚀

**Turn any Android phone into your own SMS gateway.** No Twilio. No Vonage. No monthly bills.

Pulse Relay lets you send OTP codes and notifications using your phone's SIM card via a simple API. Perfect for testing, hackathons, and local development.

---

## ⚡ Quick Example (30 Seconds)

```bash
# 1. Start your phone's local SMS server (open the app, tap "Start Local Server")
# 2. Configure the backend with your phone's IP
# 3. Send an OTP from anywhere:

curl -X POST http://localhost:3002/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'

# → OTP arrives on phone in 2 seconds
```

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR APPLICATIONS                        │
│              (Web, Mobile, Backend Services)                 │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /auth/send-otp
                     ↓
        ┌────────────────────────────┐
        │   OTP Auth Service         │
        │   (Node.js, Port 3002)     │ ← Generate & verify OTP codes
        │   MongoDB (Cloud)          │   Store with TTL expiry
        └────────────────┬───────────┘
                         │ HTTP to phone local IP:8080
                         ↓
        ┌────────────────────────────┐
        │   Pulse Relay App          │
        │   (Android on Your Phone)  │ ← Receive commands
        │   Port 8080 (Local only)   │   Send real SMS
        └────────────────────────────┘
                         │ Sends SMS via cellular
                         ↓
              [ User receives SMS ]
```

**Components:**
- **NativeGateway**: Android app that physically sends SMS (your phone)
- **OTP Auth Service**: Generates OTP codes + talks to phone (backend)
- **Backend Queue**: Optional - relay for app integrations (backend)
- **Frontend Dashboard**: View logs and test OTP flow (web)

---

## 📋 Choose Your Path

| Want to... | Time | Start here |
|-----------|------|-----------|
| Just send OTP | 15 min | [Quick Start](#-quick-start-5-minutes) ↓ |
| Full system | 30 min | [Complete Setup](#-complete-setup-30-minutes) ↓ |
| Development | 45 min | [Full Guide](#-complete-setup-30-minutes) + Deploy to Vercel |

---

## ⚡ Quick Start (5 Minutes)

**Prerequisites:** Android phone with SMS, laptop with Node.js 18+

### 1️⃣ Install Android App

1. Download `PulseRelay.apk` from [Releases](../../releases)
2. Transfer to phone and install
   - Tap **Settings → Unknown Apps → Allow**
   - If **Play Protect blocks it**: Open Play Store → Profile → Play Protect → Settings → Turn off "Scan apps with Play Protect"
3. Open app → **Grant SMS Permissions** → **Ignore Battery Optimization**
4. Tap **Start Local Server** (note the IP shown, e.g., `192.168.1.100:8080`)

### 2️⃣ Configure Backend (.env)

```bash
cd otp-auth-service
cp .env.example .env
```

Edit `.env`:
```env
PORT=3002
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/otp_auth?retryWrites=true
LOCAL_PULSE_RELAY_URL=http://192.168.1.100:8080     # ← Your phone IP from app
LOCAL_PULSE_RELAY_USER=sms                           # ← From app settings
LOCAL_PULSE_RELAY_PASS=your_password                 # ← From app settings
OTP_HASH_SECRET=any_random_secret_key_here
```

### 3️⃣ Start the Backend

```bash
Node otp-auth-service
npm install
node server.js
```

### 4️⃣ Test OTP Send

```bash
curl -X POST http://localhost:3002/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

✅ Check your phone — OTP arrived!

---

## 🔧 Complete Setup (30 Minutes)

All 4 components running locally.

### Prerequisites Checklist

Before starting, verify you have:

```bash
# Required
node -v              # Node.js 18+
npm -v               # 7+
java -version        # Java 17+
adb version          # Android Platform Tools
git --version        # Git

# Optional but recommended
which docker         # Docker (if deploying later)
which android        # Android Studio

# Special: Android Phone
- 📱 Android phone with SMS & Wi-Fi
- 🌐 Phone + laptop on SAME network (critical!)
- ☑️ USB debugging enabled on phone (Settings → Developer Options → USB Debugging)
```

**Don't have all tools?** See [Install Tools](#-install-tools-quick-guide) below.

### Step 1: Android App Setup

#### Install from Release or Build Locally

**Option A: Use Pre-built APK (Recommended)**
```bash
# Download from Releases
# Install on phone (allow unknown sources)
# Skip to "Configure the App" below
```

**Option B: Build from Source**
```bash
cd NativeGateway
chmod +x gradlew
./gradlew installDebug    # (requires phone connected via USB)
```

#### Configure the App

1. **Open Pulse Relay app**
2. **Grant Permissions:**
   - Allow SMS (required)
   - Disable Battery Optimization (prevents background stop)
3. **Disable Android Restrictions** (if SMS doesn't arrive):
   - Settings → Apps → Pulse Relay → App info
   - Notifications: Enable all channels
   - Battery: Set to "Unrestricted"
   - Permissions: Verify SMS is allowed
4. **Start Local Server:**
   - Tap "Start Local Server"
   - Note the URL shown (e.g., `http://192.168.1.100:8080`)
   - Note the username & password displayed

#### Get Phone's IP & Credentials via ADB

If app settings aren't visible:
```bash
# Get phone IP on Wi-Fi
adb shell "ip -4 addr | grep wlan"    # Look for inet address

# Read local server credentials
adb shell run-as com.kalpsms.localsms \
  cat shared_prefs/com.kalpsms.localsms_preferences.xml | grep -E "USERNAME|PASSWORD|PORT"
```

---

### Step 2: Database Setup (MongoDB)

1. Create free MongoDB Atlas cluster:
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up, create a free tier cluster
   - Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/`

2. Enable Network Access:
   - IP Whitelist → Add IP (or 0.0.0.0 for testing)

---

### Step 3: Backend Services (.env Files)

#### OTP Auth Service

```bash
cd otp-auth-service
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=3002
MONGODB_URI=mongodb+srv://your_user:your_pass@cluster.mongodb.net/otp_auth?retryWrites=true&w=majority

# Phone gateway credentials (from Step 1)
LOCAL_PULSE_RELAY_URL=http://192.168.1.100:8080
LOCAL_PULSE_RELAY_USER=sms
LOCAL_PULSE_RELAY_PASS=your_phone_password

# OTP settings
OTP_HASH_SECRET=something_random_and_long_here
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_SECONDS=30
SESSION_TTL_DAYS=7

# Debug
RETURN_OTP_IN_RESPONSE=true    # Show OTP in response (development only!)
```

#### Backend Queue Service

```bash
cd backend
npm install
# Edit .env if needed (most defaults are fine)
```

---

### Step 4: Frontend Dashboard

```bash
cd frontend
npm install
```

---

### Step 5: Start All Services (Open 4 Terminals)

**Terminal 1: Phone Local Server**
- Already running on phone (from Step 1)
- Test: `curl http://phone_ip:8080/health` (or use your password if required)

**Terminal 2: Backend Queue**
```bash
cd backend
node server.js
# Expected: ✓ Server running on http://localhost:3001
```

**Terminal 3: OTP Auth Service**
```bash
cd otp-auth-service
node server.js
# Expected: ✓ Connected to MongoDB
# Expected: ✓ Server running on http://localhost:3002
```

**Terminal 4: Frontend UI**
```bash
cd frontend
npm run dev
# Expected: ✓ Local: http://localhost:5173
# Expected: ✓ Network: http://YOUR_LAPTOP_IP:5173
```

---

## ✅ Verify Everything Works

### Health Check: Phone Gateway

```bash
PHONE_IP="192.168.1.100"  # Change to your phone IP
PHONE_USER="sms"           # From app
PHONE_PASS="your_password" # From app

curl -u "$PHONE_USER:$PHONE_PASS" http://$PHONE_IP:8080/health
# Expected: { "status": "ok" }
```

### Health Check: OTP Service

```bash
curl http://localhost:3002/health
# Expected: { "status": "ok", "mongodb": "connected" }
```

### Health Check: Backend Queue

```bash
curl http://localhost:3001/api/messages
# Expected: JSON array or object (even if empty)
```

### Health Check: Frontend

Open browser to `http://localhost:5173`
- Should load without errors
- Docs visible at `/docs`

---

## 🧪 End-to-End OTP Test

### Test Flow

```bash
# 1. Send OTP to a real phone number
curl -X POST http://localhost:3002/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'

# Response should be:
# { "message": "OTP sent", "phone": "+1234567890" }

# 👉 Check your phone for SMS with OTP code

# 2. Verify the OTP
curl -X POST http://localhost:3002/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "otp": "123456"}'

# Response should be:
# { "message": "OTP verified", "token": "eyJhbGc..." }

# 3. Use token to access protected endpoint
TOKEN="eyJhbGc..."
curl -X GET http://localhost:3002/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Response should be:
# { "phone": "+1234567890", "verified": true }
```

---

## 🔍 Deep Dive: What Happens

### When you send OTP:

```
1. Web/App sends: POST /auth/send-otp with phone number
   ↓
2. OTP Service generates 6-digit code (e.g., 234891)
   ↓
3. Stores in MongoDB: { phone, otp, hash, expiresAt: now + 5min }
   ↓
4. Calls your phone gateway: POST http://192.168.1.100:8080/message
      Body: { phoneNumbers: ["+1234567890"], message: "Your OTP is 234891" }
   ↓
5. Phone receives request
   ↓
6. Android app queries device SIM for SMS sending
   ↓
7. Phone sends REAL SMS via cellular network
   ↓
8. User receives SMS: "Your OTP is 234891"
```

**You can trace this in logs:**
```bash
# Check OTP service logs
tail -f otp-auth-service/logs.txt

# Check phone logs via ADB
adb logcat | grep "PulseRelay"
```

---

## 🛠️ Troubleshooting

### "Can't reach phone gateway"

**Problem:** OTP service returns `503 Gateway Unavailable` or connection timeout

**Checklist:**
```bash
# 1. Is phone IP correct?
adb shell "ip -4 addr | grep wlan"

# 2. Is phone local server running?
# (Open app, check if "Local Server" shows as running with IP displayed)

# 3. Can you reach it from laptop?
curl http://192.168.1.100:8080/health

# 4. Are laptop & phone on SAME network?
# ⚠️ CRITICAL: Both must be on same Wi-Fi (not one on Wi-Fi, one on hotspot)

# 5. Is credentials in .env correct?
cat otp-auth-service/.env | grep LOCAL_PULSE_RELAY
```

**Fix:**
- Restart phone app: Close → Re-open → Tap "Start Local Server"
- Update .env with correct IP: `LOCAL_PULSE_RELAY_URL=http://YOUR_ACTUAL_IP:8080`
- Restart OTP service: `npm run dev` or `node server.js`

---

### "SMS not arriving"

**Problem:** OTP sends successfully (no 503), but phone doesn't receive SMS

**Checklist:**
```bash
# 1. Phone has cellular signal?
adb shell "dumpsys telephony.registry | grep hasIccCard"  # Should be true

# 2. SMS permissions granted?
adb shell "pm list permissions | grep android.permission.SEND_SMS"

# 3. Battery optimization blocking app?
# (Open Settings → Apps → Pulse Relay → Battery → Set Unrestricted)

# 4. 3rd party SMS app overriding?
# (Disable other SMS apps or grant them permissions too)

# 5. Check phone logs
adb logcat | grep -E "SMS|localsms|PulseRelay"
```

**Fix:**
- Check: Settings → Notifications → Enable all channels for Pulse Relay
- Check: Settings → Battery → Disable optimization for Pulse Relay
- Restart phone

---

### "MongoDB connection failed"

**Problem:** OTP service crashes with `MongoConnectionError`

**Fix:**
```bash
# 1. Verify URI is correct
cat otp-auth-service/.env | grep MONGODB_URI

# 2. Test connection directly
# Replace with your credentials
node -e "
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect('YOUR_MONGODB_URI', (err, client) => {
  console.log(err ? 'Connection failed: ' + err : 'Connected OK');
  process.exit();
});
"

# 3. Whitelist your IP in MongoDB Atlas
# → Go to Atlas → Security → Network Access → Add IP
```

---

### "Port already in use"

**Problem:** `EADDRINUSE` error when starting services

**Fix:**
```bash
# Find process on port
lsof -i :3002    # OTP service
lsof -i :3001    # Backend
lsof -i :5173    # Frontend

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3003 node server.js
```

---

### "Frontend can't reach OTP service"

**Problem:** Frontend shows `Failed to connect to API` or `CORS error`

**Fix:**
```bash
# 1. Is OTP service running?
curl http://localhost:3002/health

# 2. Is frontend using correct API URL?
grep -r "localhost:3002" frontend/src/

# 3. CORS issue? Check OTP service:
grep -r "cors\|CORS" otp-auth-service/server.js

# Solution: Ensure OTP service has CORS enabled
# (Should be in server setup)
```

---

## 🚀 Deploy to Production

### To Vercel (Frontend)

```bash
cd frontend
vercel
# Follow prompts, it will deploy to vercel.com
```

### To Cloud (Backend)

- **Railway:** Drag `otp-auth-service` folder
- **Heroku:** `heroku create` + `git push heroku`
- **AWS Lambda:** Package with serverless-http

⚠️ **Security:** Update `.env` with production secrets before deploying!

---

## 🔒 Security Best Practices

1. **Use `.env.example` template:**
   ```bash
   # Never commit real .env
   echo ".env" >> .gitignore
   ```

2. **Rotate credentials:**
   - Change `LOCAL_PULSE_RELAY_PASS` in app every 3 months
   - Update in `.env` accordingly

3. **Use HTTPS in production:**
   - OTP service should be behind NGINX with SSL
   - Phone gateway stays on local network (no HTTPS needed)

4. **Rate limit OTP requests:**
   - Default limits in `.env`: `OTP_MAX_ATTEMPTS=5`, `OTP_RESEND_SECONDS=30`

5. **Don't expose phone IP:**
   - Keep `LOCAL_PULSE_RELAY_URL` internal only
   - Never put real IP in client-side code

---

## 📱 Mobile Client Integration

### Send OTP from React Native / Flutter

```javascript
// React Native example
fetch('http://YOUR_BACKEND/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: '+1234567890' })
})
.then(r => r.json())
.then(data => console.log('OTP sent:', data));
```

### Listen for OTP SMS (Android native)

```kotlin
// Your app can intercept SMS
val sms = intent.getStringExtra("sms_body")
val otp = sms.substring(0, 6)  // Extract first 6 digits
```

---

## 📚 Additional Resources

- **API Reference:** [COMPLETE_USAGE_AND_API_GUIDE.md](COMPLETE_USAGE_AND_API_GUIDE.md)
- **Release Checklist:** [HACKATHON_PROJECT_GUIDE.md](HACKATHON_PROJECT_GUIDE.md)
- **YouTube Demo:** https://youtu.be/fwpzjvzSN14?si=tVJXcWxhqVgpWyJ7
- **Frontend Docs:** http://localhost:5173/docs (after running frontend)

---

## 🐛 Install Tools (Quick Guide)

### macOS

```bash
# Install Homebrew if not already done
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install tools
brew install node java android-sdk
```

### Linux (Ubuntu/Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Java 17
sudo apt-get install -y openjdk-17-jdk

# Android SDK
sudo apt-get install -y android-sdk android-sdk-platform-tools
```

### Windows

```powershell
# Install Chocolatey (run as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install tools
choco install nodejs openjdk17 android-sdk git
```

---

## � Tips & Gotchas

- **Different network?** You MUST be on the same Wi-Fi as your phone. Work from a coffee shop Wi-Fi? Phone must be on the same coffee shop Wi-Fi.
- **Still not working?** Check: Is phone local server running? → Is IP in .env correct? → Restart both phone app and backend service.
- **Want to lock it down?** Use `LOCAL_PULSE_RELAY_USER` and `LOCAL_PULSE_RELAY_PASS` with strong passwords.

---

## 🎓 What Next?

1. **Production Deployment?** Check [HACKATHON_PROJECT_GUIDE.md](HACKATHON_PROJECT_GUIDE.md) for release steps
2. **API Reference?** See [COMPLETE_USAGE_AND_API_GUIDE.md](COMPLETE_USAGE_AND_API_GUIDE.md) for all endpoints
3. **Need a demo?** Watch the [YouTube walkthrough](https://youtu.be/fwpzjvzSN14?si=tVJXcWxhqVgpWyJ7)

---

## 📄 License

Open source. No restrictions. Use freely for personal, commercial, or hackathon projects.

---

**Made with ❤️ for developers who want to own their SMS stack.**
