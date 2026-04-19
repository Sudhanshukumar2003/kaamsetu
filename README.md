# KaamSetu — India's Verified Blue-Collar Gig Marketplace

> Connecting 300M+ informal workers to fair, verified, digital-first employment.

---

## Project Structure

```
kaamsetu/
├── services/
│   └── api/                   # Core Node.js/Express backend
│       ├── src/
│       │   ├── app.js         # Express app setup
│       │   ├── index.js       # Server entry point
│       │   ├── config/        # Environment configuration
│       │   ├── db/
│       │   │   ├── pool.js    # PostgreSQL connection pool
│       │   │   └── schema.sql # Full DB schema + seed trades
│       │   ├── middleware/
│       │   │   ├── auth.js    # JWT authentication + role guards
│       │   │   └── validate.js
│       │   ├── routes/
│       │   │   ├── auth.routes.js     # OTP login, register, /me
│       │   │   ├── worker.routes.js   # Profile, KYC, availability
│       │   │   ├── hirer.routes.js    # Profile, worker search
│       │   │   ├── gig.routes.js      # Full gig lifecycle
│       │   │   ├── payment.routes.js  # Razorpay escrow
│       │   │   ├── review.routes.js   # Ratings & reviews
│       │   │   ├── trades.routes.js   # Trade list + price ranges
│       │   │   └── admin.routes.js    # Admin dashboard
│       │   ├── services/
│       │   │   ├── otp.service.js         # OTP generation + Twilio SMS
│       │   │   ├── jwt.service.js         # JWT sign/verify
│       │   │   ├── kyc.service.js         # IDfy Aadhaar eKYC
│       │   │   ├── payment.service.js     # Razorpay escrow + payouts
│       │   │   └── notification.service.js # WhatsApp + FCM push
│       │   ├── utils/
│       │   │   ├── logger.js   # Winston logger
│       │   │   └── response.js # Standardised API responses
│       │   └── __tests__/
│       │       ├── auth.test.js
│       │       └── gig.test.js
│       ├── .env.example
│       ├── Dockerfile
│       └── package.json
├── apps/
│   ├── worker-app/            # React Native (Android-first)
│   └── hirer-web/             # Next.js hirer web app
├── infra/
│   └── docker/
│       └── docker-compose.yml
└── shared/
    └── types/                 # Shared TypeScript types (future)
```

---

## Prerequisites

- Node.js 22+
- Docker + Docker Compose
- npm 10+

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone https://github.com/your-org/kaamsetu.git
cd kaamsetu
npm install
cd services/api && npm install
```

### 2. Start infrastructure

```bash
cd infra/docker
docker-compose up -d postgres redis
```

This starts:
- **PostgreSQL 16 + PostGIS** on `localhost:5432` (auto-runs schema.sql)
- **Redis 7** on `localhost:6379`

### 3. Configure environment

```bash
cd services/api
cp .env.example .env
# Edit .env — for dev, OTP_TEST_MODE=true means OTP is always 123456
```

### 4. Run the API

```bash
cd services/api
npm run dev
```

Server starts at `http://localhost:3000`

### 5. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","env":"development","ts":"..."}
```

---

## API Reference

### Base URL
`http://localhost:3000/api`

### Authentication
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

### Auth Endpoints

#### `POST /auth/send-otp`
Send OTP to a phone number.

```json
{ "phone": "9876543210", "role": "worker" }
```

Response:
```json
{ "success": true, "data": { "isNewUser": true } }
```

---

#### `POST /auth/verify-otp`
Verify OTP, register if new user, return JWT.

```json
{
  "phone": "9876543210",
  "code": "123456",
  "role": "worker",
  "fullName": "Ramesh Kumar"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "refreshToken": "<refresh_jwt>",
    "user": { "id": "...", "phone": "9876543210", "role": "worker" }
  }
}
```

---

#### `GET /auth/me`
Returns current user + role-specific profile.

---

### Worker Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/workers/me` | Get own profile |
| `PUT`  | `/workers/me` | Update profile, location, trade |
| `POST` | `/workers/me/availability` | Toggle available/busy |
| `POST` | `/workers/me/kyc/initiate` | Start Aadhaar eKYC |
| `POST` | `/workers/me/kyc/verify` | Complete KYC with OTP + selfie |
| `PUT`  | `/workers/me/bank-details` | Save UPI ID for payouts |
| `GET`  | `/workers/:workId/profile` | Public worker profile |

---

### Gig Lifecycle

```
[Hirer] POST /gigs → status: open
[Worker] POST /gigs/:id/accept → status: accepted
[Hirer] POST /payments/initiate → status: matched (escrow held)
[Worker] POST /gigs/:id/checkin → status: in_progress
[Worker] POST /gigs/:id/complete → status: completed
[Hirer] POST /gigs/:id/confirm → payment released, both can review
```

---

### Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/gigs` | Hirer | Create new gig |
| `GET`  | `/gigs/matches` | Worker | See nearby matching gigs |
| `GET`  | `/gigs` | Both | List own gigs |
| `GET`  | `/gigs/:id` | Both | Gig detail |
| `POST` | `/gigs/:id/accept` | Worker | Accept a gig |
| `POST` | `/gigs/:id/checkin` | Worker | Geo check-in |
| `POST` | `/gigs/:id/complete` | Worker | Mark job done |
| `POST` | `/gigs/:id/confirm` | Hirer | Confirm + release payment |
| `POST` | `/gigs/:id/dispute` | Both | Raise dispute |
| `POST` | `/payments/initiate` | Hirer | Create escrow order |
| `POST` | `/payments/webhook` | System | Razorpay webhook |
| `GET`  | `/payments/history` | Both | Payment history |
| `POST` | `/reviews` | Both | Leave review |
| `GET`  | `/trades` | Public | List all trades |
| `GET`  | `/trades/:slug/price-range` | Public | Fair price index |
| `GET`  | `/hirers/search-workers` | Hirer | Search verified workers |

---

### Admin Endpoints (role: admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/admin/stats` | Platform dashboard metrics |
| `GET`  | `/admin/workers` | List workers with filters |
| `GET`  | `/admin/gigs` | Monitor all gigs |
| `GET`  | `/admin/disputes` | List open disputes |
| `PUT`  | `/admin/disputes/:id/resolve` | Resolve dispute |
| `PUT`  | `/admin/users/:id/suspend` | Suspend user |
| `PUT`  | `/admin/users/:id/unsuspend` | Unsuspend user |

---

## Running Tests

```bash
# Start test DB
docker-compose up -d postgres_test

# Run all tests
cd services/api
DB_PORT=5433 DB_NAME=kaamsetu_test npm test

# Watch mode
npm run test:watch
```

---

## Third-Party Integrations

### IDfy (KYC)
- Sign up at [idfy.com](https://idfy.com)
- Get `API_KEY` and `ACCOUNT_ID` from dashboard
- Set `OTP_TEST_MODE=true` in dev to skip real KYC calls

### Razorpay (Payments)
- Create account at [razorpay.com](https://razorpay.com)
- Use Test Mode keys during development
- Enable Razorpay X for payout functionality
- Set up webhook at `/api/payments/webhook`

### Twilio (WhatsApp + SMS)
- Create account at [twilio.com](https://twilio.com)
- Join WhatsApp Sandbox for development
- Apply for WhatsApp Business API for production

### Firebase (Push Notifications)
- Create project at [firebase.google.com](https://console.firebase.google.com)
- Download `firebase-credentials.json`
- Set `FIREBASE_CREDENTIALS_PATH` in `.env`

---

## Environment Variables

See `.env.example` for full list. Critical ones:

| Variable | Description |
|----------|-------------|
| `OTP_TEST_MODE=true` | Always accept OTP `123456` in dev |
| `JWT_SECRET` | Change to random 64-char string in production |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard |
| `IDFY_API_KEY` | From IDfy dashboard |
| `TWILIO_ACCOUNT_SID` | From Twilio console |

---

## V1 Success Metrics

| Metric | Target |
|--------|--------|
| Verified workers onboarded | 100+ |
| End-to-end gigs completed | 50+ |
| Worker repeat rate | 60%+ |
| Payment release time (avg) | < 3 hours |
| NPS (workers) | > 40 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 + Express 4 |
| Database | PostgreSQL 16 + PostGIS |
| Cache | Redis 7 |
| Auth | JWT + Aadhaar OTP |
| KYC | IDfy eKYC + face match |
| Payments | Razorpay (escrow + payouts) |
| Notifications | Twilio WhatsApp + Firebase FCM |
| Infrastructure | AWS Mumbai (EC2, RDS, S3) |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## License
Private — KaamSetu Technologies Pvt. Ltd.
