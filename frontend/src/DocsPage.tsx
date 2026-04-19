const quickSteps = [
  'Install dependencies for backend, otp-auth-service, and frontend.',
  'Install the Android app on a real phone and enable local server + SMS permissions.',
  'Start backend on port 3001.',
  'Start otp-auth-service on port 3002.',
  'Start frontend with host mode for LAN testing.',
  'Set phone gateway URL, user, and password in otp-auth-service/.env.',
  'Run the health and OTP requests from Postman or curl.'
];

const endpoints = [
  { service: 'Queue Backend', method: 'POST', path: '/api/messages/send', notes: 'Queue SMS to relay pipeline' },
  { service: 'Queue Backend', method: 'GET', path: '/api/messages/pending', notes: 'List pending queue messages' },
  { service: 'Queue Backend', method: 'GET', path: '/api/messages', notes: 'List all queue messages' },
  { service: 'OTP Service', method: 'GET', path: '/health', notes: 'Health check for auth service' },
  { service: 'OTP Service', method: 'POST', path: '/auth/send-otp', notes: 'Generate and send OTP SMS' },
  { service: 'OTP Service', method: 'POST', path: '/auth/verify-otp', notes: 'Verify OTP and return token' },
  { service: 'OTP Service', method: 'GET', path: '/auth/me', notes: 'Validate bearer token' },
  { service: 'OTP Service', method: 'POST', path: '/auth/logout', notes: 'Invalidate active token' },
  { service: 'Phone Gateway', method: 'GET', path: '/health', notes: 'Direct phone local server health' },
  { service: 'Phone Gateway', method: 'POST', path: '/message', notes: 'Direct SMS send from phone API' }
];

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="docs-code">
      <code>{code}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="docs-hero">
        <h1>LocalSMS Deployment Guide</h1>
        <p>
          This page is the full step-by-step onboarding and API testing guide for teammates.
          Use this as the single source when deploying or testing the project.
        </p>
      </header>

      <section className="docs-section">
        <h2>Quick Start</h2>
        <ol>
          {quickSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="docs-section">
        <h2>Install and Run Commands</h2>
        <CodeBlock
          code={`cd backend && npm install\ncd ../otp-auth-service && npm install\ncd ../frontend && npm install`}
        />
        <CodeBlock code={`cd NativeGateway\nchmod +x gradlew\n./gradlew installDebug`} />
        <CodeBlock code={`cd backend && npm run start`} />
        <CodeBlock code={`cd otp-auth-service && npm run start`} />
        <CodeBlock code={`cd frontend && npm run dev -- --host`} />
      </section>

      <section className="docs-section">
        <h2>Required .env Values (otp-auth-service)</h2>
        <CodeBlock
          code={`PORT=3002\nMONGODB_URI=<mongo_uri>\nOTP_HASH_SECRET=<secret>\nOTP_TTL_MINUTES=5\nOTP_MAX_ATTEMPTS=5\nOTP_RESEND_SECONDS=30\nSESSION_TTL_DAYS=7\nLOCAL_SMS_GATEWAY_URL=http://<PHONE_IP>:8080\nLOCAL_SMS_GATEWAY_USER=sms\nLOCAL_SMS_GATEWAY_PASS=<phone_password>\nSMS_TEMPLATE=Your OTP is {{OTP}}. Valid for {{MINUTES}} minutes.\nRETURN_OTP_IN_RESPONSE=false`}
        />
        <p>
          Keep PHONE_IP and phone password updated after app reinstall. A 401 from /auth/send-otp usually
          means gateway credentials are outdated.
        </p>
      </section>

      <section className="docs-section">
        <h2>Get Phone IP and Credentials</h2>
        <CodeBlock code={`adb shell "ip addr"`} />
        <CodeBlock
          code={`adb shell run-as com.kalpsms.localsms cat /data/data/com.kalpsms.localsms/shared_prefs/com.kalpsms.localsms_preferences.xml`}
        />
      </section>

      <section className="docs-section">
        <h2>API Catalog</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Method</th>
                <th>Path</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((row) => (
                <tr key={`${row.service}-${row.method}-${row.path}`}>
                  <td>{row.service}</td>
                  <td>{row.method}</td>
                  <td>{row.path}</td>
                  <td>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <h2>Ready Curl Requests</h2>
        <CodeBlock
          code={`curl -X POST "http://127.0.0.1:3002/auth/send-otp" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"phoneNumber":"+919727659973"}'`}
        />
        <CodeBlock
          code={`curl -X POST "http://127.0.0.1:3002/auth/verify-otp" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"phoneNumber":"+919727659973","otp":"123456"}'`}
        />
        <CodeBlock
          code={`curl -X POST "http://<PHONE_IP>:8080/message" \\\n+  -u "sms:<PASSWORD>" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"phoneNumbers":["+919727659973"],"message":"hello buddy"}'`}
        />
      </section>

      <section className="docs-section">
        <h2>Postman Setup</h2>
        <ol>
          <li>Create environment variables: QUEUE_BASE, OTP_BASE, PHONE_BASE, PHONE_USER, PHONE_PASS, authToken.</li>
          <li>Use OTP send request: POST {`{{OTP_BASE}}`}/auth/send-otp.</li>
          <li>Use OTP verify request: POST {`{{OTP_BASE}}`}/auth/verify-otp.</li>
          <li>Save token in Tests tab using pm.environment.set("authToken", token).</li>
          <li>Use Authorization header: Bearer {`{{authToken}}`} for /auth/me and /auth/logout.</li>
        </ol>
      </section>

      <section className="docs-section docs-warning">
        <h2>Troubleshooting</h2>
        <ul>
          <li>401 during OTP send: update LOCAL_SMS_GATEWAY_PASS and restart otp-auth-service.</li>
          <li>429 during OTP send: wait 30 seconds before sending again.</li>
          <li>Port 3002 in use: kill old process on 3002 and restart service.</li>
          <li>Phone API unreachable: verify both laptop and phone are on same Wi-Fi and app local server is enabled.</li>
        </ul>
      </section>
    </main>
  );
}
