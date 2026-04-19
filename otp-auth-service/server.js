const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3002);
const MONGODB_URI = process.env.MONGODB_URI;
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || 'change_me_before_production';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 30);
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const LOCAL_SMS_GATEWAY_URL = (process.env.LOCAL_SMS_GATEWAY_URL || 'http://10.153.40.168:8080').replace(/\/$/, '');
const LOCAL_SMS_GATEWAY_USER = process.env.LOCAL_SMS_GATEWAY_USER || 'sms';
const LOCAL_SMS_GATEWAY_PASS = process.env.LOCAL_SMS_GATEWAY_PASS || '';
const LOCAL_SMS_SIM_NUMBER = Number(process.env.LOCAL_SMS_SIM_NUMBER || 0);
const SMS_TEMPLATE = process.env.SMS_TEMPLATE || 'Your OTP is {{OTP}}. Valid for {{MINUTES}} minutes.';
const RETURN_OTP_IN_RESPONSE = String(process.env.RETURN_OTP_IN_RESPONSE || 'false').toLowerCase() === 'true';

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment');
}

const otpRequestSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },
    isVerified: { type: Boolean, default: true },
    verifiedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpRequest = mongoose.model('OtpRequest', otpRequestSchema);
const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);

function normalizePhoneNumber(phoneNumber) {
  const cleaned = String(phoneNumber || '').trim().replace(/[\s-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
    return null;
  }

  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(`${otp}:${OTP_HASH_SECRET}`).digest('hex');
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function formatSmsMessage(otp) {
  return SMS_TEMPLATE.replace('{{OTP}}', otp).replace('{{MINUTES}}', String(OTP_TTL_MINUTES));
}

async function sendSmsViaLocalGateway(phoneNumber, message) {
  const auth = Buffer.from(`${LOCAL_SMS_GATEWAY_USER}:${LOCAL_SMS_GATEWAY_PASS}`).toString('base64');
  const payload = {
    phoneNumbers: [phoneNumber],
    message
  };

  if (LOCAL_SMS_SIM_NUMBER > 0) {
    payload.simNumber = LOCAL_SMS_SIM_NUMBER;
  }

  const response = await fetch(`${LOCAL_SMS_GATEWAY_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LocalSMS send failed (${response.status}): ${text}`);
  }

  return text;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing bearer token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const now = new Date();
  const session = await Session.findOne({ token, expiresAt: { $gt: now } }).lean();

  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  req.phoneNumber = session.phoneNumber;
  next();
}

app.get('/health', (_, res) => {
  res.json({ success: true, service: 'otp-auth-service' });
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    const now = new Date();
    const resendCutoff = new Date(now.getTime() - OTP_RESEND_SECONDS * 1000);
    const recentRequest = await OtpRequest.findOne({
      phoneNumber,
      verifiedAt: null,
      createdAt: { $gte: resendCutoff },
      expiresAt: { $gt: now }
    }).lean();

    if (recentRequest) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP`
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

    await OtpRequest.updateMany({ phoneNumber, verifiedAt: null }, { $set: { expiresAt: now } });

    await sendSmsViaLocalGateway(phoneNumber, formatSmsMessage(otp));

    await OtpRequest.create({
      phoneNumber,
      otpHash,
      attempts: 0,
      expiresAt,
      verifiedAt: null
    });

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      phoneNumber,
      expiresAt,
      ...(RETURN_OTP_IN_RESPONSE ? { otp } : {})
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    const otp = String(req.body.otp || '').trim();

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'OTP must be a 6-digit code' });
    }

    const now = new Date();
    const otpRequest = await OtpRequest.findOne({
      phoneNumber,
      verifiedAt: null,
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    if (!otpRequest) {
      return res.status(400).json({ success: false, error: 'OTP expired or not requested' });
    }

    if (otpRequest.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, error: 'Maximum OTP attempts exceeded' });
    }

    const incomingHash = hashOtp(otp);
    const matched = timingSafeEqualStr(incomingHash, otpRequest.otpHash);

    if (!matched) {
      otpRequest.attempts += 1;
      await otpRequest.save();
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
    }

    otpRequest.verifiedAt = now;
    await otpRequest.save();

    await User.updateOne(
      { phoneNumber },
      { $set: { isVerified: true, verifiedAt: now } },
      { upsert: true }
    );

    const token = crypto.randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await Session.create({
      token,
      phoneNumber,
      expiresAt: sessionExpiresAt
    });

    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      sessionExpiresAt,
      user: {
        phoneNumber,
        isVerified: true
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findOne({ phoneNumber: req.phoneNumber }).lean();
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  return res.json({
    success: true,
    user: {
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      verifiedAt: user.verifiedAt
    }
  });
});

app.post('/auth/logout', authMiddleware, async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.slice('Bearer '.length).trim();
  await Session.deleteOne({ token });
  return res.json({ success: true, message: 'Logged out' });
});

async function start() {
  let connected = false;

  // Try configured MongoDB first; if it fails, fall back to an in-memory DB for local development.
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log('Connected to configured MongoDB');
  } catch (error) {
    console.warn(`Configured MongoDB unavailable: ${error.message}`);
    console.warn('Falling back to in-memory MongoDB for local development');

    const mem = await MongoMemoryServer.create();
    const memUri = mem.getUri('otp_auth');
    await mongoose.connect(memUri);
    connected = true;
    console.log('Connected to in-memory MongoDB');
  }

  if (!connected) {
    throw new Error('Unable to connect to MongoDB');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OTP Auth Service running on port ${PORT}`);
    console.log('Auth API bound to 0.0.0.0 for LAN access');
  });
}

start().catch((error) => {
  console.error('Failed to start OTP Auth Service:', error.message);
  process.exit(1);
});
