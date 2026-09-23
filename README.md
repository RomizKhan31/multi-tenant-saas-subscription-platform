# Multi-Tenant SaaS Subscription Platform

A production-ready, maintainable, secure multi-tenant SaaS subscription platform built with **Next.js (App Router)**, **Express REST API**, **MongoDB/Mongoose**, and **Stripe**.

---

## 1. Architecture & Design Principles

### Layered Backend Architecture

```
HTTP Client / Next.js
       │
       ▼
Routes (`backend/src/routes`)
       │ (Input Validation & Rate Limiting)
       ▼
Middleware (`backend/src/middleware`)
       │ (requireAuth, requireRole, requireOrganizationAccess)
       ▼
Controllers (`backend/src/controllers`)
       │ (HTTP orchestration & status codes)
       ▼
Services (`backend/src/services`)
       │ (Business logic, atomic transactions, Stripe orchestration)
       ▼
Repositories (`backend/src/repositories`)
       │ (MongoDB queries & tenant filtering with ClientSession)
       ▼
MongoDB (`Mongoose Models`)
```

- **Business Logic Isolation**: Controllers handle HTTP requests and delegate domain logic directly to Services.
- **Data Access Layer**: Repositories abstract all database interactions and enforce multi-tenant isolation filters (`organizationId`).
- **Atomic Operations**: Critical flows (e.g. Stripe checkout completion, member invitation acceptance) pass Mongoose `ClientSession` through repositories to execute within atomic transactions with compensating rollback mechanisms.

---

## 2. Multi-Tenant Data Isolation Strategy

Strict multi-tenancy is enforced at both API and database levels. **Organization A can never read, modify, or delete Organization B's data.**

### Tenant Ownership & Scoping

Every tenant-owned document includes an `organizationId` reference:
- `User` (`organizationId`)
- `Subscription` (`organizationId`)
- `Payment` (`organizationId`)
- `Transaction` (`organizationId`)
- `Invitation` (`organizationId`)
- `PendingRegistration` (`sessionId`)

### Query Isolation Pattern

Repositories guarantee that tenant queries are scoped by the authenticated user's `organizationId`:

```typescript
// SECURE - Enforced organization-scoped query
const payments = await Payment.find({
  organizationId: authenticatedUser.organizationId
});

// PREVENTED - IDOR and cross-tenant access rejected
const payment = await Payment.findOne({
  _id: requestedPaymentId,
  organizationId: authenticatedUser.organizationId
});
```

### Authorization Middleware Pipeline

```typescript
requireAuth               // Verifies JWT signature, expiration, and decodes user context
requireRole([...])        // Enforces role permissions (PLATFORM_ADMIN, ORGANIZATION_ADMIN, ORGANIZATION_MEMBER)
requireOrganizationAccess // Verifies user belongs to an active tenant organization
```

Sensitive tenant context is **never** blindly trusted from client request bodies or URL parameters; it is extracted server-side from `req.user.organizationId`.

---

## 3. Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Library**: React 19, TypeScript
- **Server/API State**: TanStack Query (`@tanstack/react-query` v5)
- **HTTP Client**: Axios with automatic JWT injection & error handling
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB 7.0 with Mongoose ODM
- **Payments**: Stripe Node SDK (Test/Sandbox Mode)
- **Email**: Resend transactional email integration
- **Security**: JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `express-rate-limit`, `zod`

### Infrastructure & CI/CD
- **Containerization**: Multi-stage `Dockerfile` and `docker-compose.yml`
- **CI Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) with automated MongoDB service, backend test suite, and frontend build

---

## 4. User Roles & Capabilities

| Feature / Panel | PLATFORM_ADMIN | ORGANIZATION_ADMIN | ORGANIZATION_MEMBER |
| :--- | :---: | :---: | :---: |
| Overview / Statistics | Platform-wide | Organization-level | - |
| Manage All Organizations (Suspend/Reactivate) | Yes | - | - |
| Organization Full Details & History | Yes | - | - |
| Manage Plans (Create, Edit, Toggle) | Yes | - | - |
| View Cross-Tenant Transactions & Filter | Yes | - | - |
| Edit Organization Profile & Billing Email | - | Yes | - |
| Invite, Remove & Change Member Roles | - | Yes | - |
| Subscribe, Upgrade & Cancel Subscription | - | Yes | - |
| View Payments & Download Invoices | - | Yes | - |
| View Tenant Transactions & Status Filter | - | Yes | - |
| View Read-Only Organization Info | - | - | Yes |
| Edit Own Profile & Change Password | Yes | Yes | Yes |

---

## 5. Registration & Paid Onboarding Flow

Organizations are **never** activated based on frontend redirects or query parameters. The Stripe webhook is the authoritative source of truth:

```
1. User submits Signup Form (/register)
   [Org Name, Admin Name, Email, Password, Plan Selection]
                 │
                 ▼
2. POST /api/auth/register-onboard
   - Input validation (Zod) & email uniqueness check
   - Password pre-hashed
   - PendingRegistration record saved in MongoDB
   - Stripe Checkout Session created with metadata: { pendingRegistrationId }
                 │
                 ▼
3. User completes payment on Stripe Checkout
                 │
                 ▼
4. Stripe fires checkout.session.completed webhook
                 │
                 ▼
5. POST /api/webhooks/stripe
   - Verifies raw request body with STRIPE_WEBHOOK_SECRET
   - Idempotency check: rejects duplicate stripeEventId
   - Atomic Database Transaction:
       a. Creates Organization (Status: ACTIVE)
       b. Creates Admin User with hashed password (Role: ORGANIZATION_ADMIN)
       c. Creates Subscription record linked to Plan
       d. Creates Payment record (Status: SUCCESS)
       e. Creates Transaction ledger record
       f. Marks PendingRegistration as completed
   - Sends confirmation email via Resend
                 │
                 ▼
6. Frontend Polling (/payment/success)
   - Polls /api/auth/onboard-status?sessionId=...
   - Displays confirmation & redirects to Sign In upon webhook completion
```

---

## 6. Stripe Webhook Security & Idempotency

### Signature Verification
- Incoming webhooks capture the raw request buffer (`req.rawBody`) before parsing.
- Verified using `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`.
- Any invalid or tampered signature is rejected with HTTP 400.

### Idempotency Protection
- Every Stripe event has a unique `stripeEventId`.
- The `WebhookEvent` collection records all processed events with a unique index.
- If an event is received more than once, it is safely ignored and returns HTTP 200 `{ received: true, duplicate: true }`.

### Atomic Transactions & Compensating Rollback
- On MongoDB replica sets (production / Atlas), native multi-document transactions ensure ACID atomicity.
- In standalone environments or upon failure, automated compensating rollbacks revert organization status and clean up partial records, logging the event status to prevent inconsistent data.

---

## 7. Email Notification Events

Transactional emails are integrated via **Resend**:
1. **Welcome & Activation**: Sent upon successful Stripe payment confirmation.
2. **Member Invitation**: Sent with secure invitation token link (`/accept-invitation?token=...`).
3. **Password Reset**: Sent with time-limited token link (`/reset-password?token=...`).
4. **Payment Succeeded**: Sent upon successful checkout or recurring charge.
5. **Payment Failed**: Sent if a renewal payment fails.
6. **Subscription Cancelled**: Sent when cancellation is scheduled.
7. **Expiring Subscription Notice**: Background scheduler checks subscriptions expiring within 7 days and sends renewal reminders.

---

## 8. Getting Started

### Prerequisites
- Node.js 20+
- MongoDB 7.0+ (running locally or via Docker)
- npm

### Option A: Running with Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/RomizKhan31/multi-tenant-saas-subscription-platform.git
cd multi-tenant-saas-subscription-platform

# Start MongoDB, Backend, and Frontend containers
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

---

### Option B: Running Locally

#### 1. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Ensure `.env` contains valid configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/multi-tenant-saas
JWT_SECRET=super_secret_jwt_key_with_at_least_32_characters
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
```

Seed initial database records (Plans, Admin accounts, Organizations):
```bash
npm run seed
```

Start the backend server:
```bash
npm run dev
```

#### 2. Setup Frontend

```bash
cd ../frontend
npm install
```

Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 9. Demo Credentials

Pre-seeded credentials are provided for testing all three roles:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Platform Admin** | `platform-admin@example.com` | `PlatformAdmin123!` |
| **Organization Admin** | `org-admin@example.com` | `OrgAdmin123!` |
| **Organization Member** | `org-member@example.com` | `OrgMember123!` |

*Quick-fill demo buttons are also provided directly on the Login page.*

---

## 10. Automated Testing

The backend includes comprehensive test suites covering all critical assessment criteria:

```bash
cd backend
npm test
```

### Test Suites (44 Tests, 100% Passing)

1. **`auth.test.ts`**:
   - User registration & duplicate email validation
   - Weak password & invalid email format rejection
   - Login credential authentication & JWT token generation
   - Expired JWT token rejection
   - Protected route access control

2. **`authorization.test.ts`**:
   - `requireRole` middleware checks across all three roles
   - Role escalation prevention

3. **`multitenancy.test.ts`**:
   - Strict tenant data isolation
   - Cross-tenant read prevention (`GET /api/payments`)
   - Cross-tenant update prevention (`PUT /api/members/:id/role`)
   - Cross-tenant delete prevention (`DELETE /api/members/:id`)

4. **`payment.test.ts`**:
   - Stripe checkout session generation
   - Success and failure webhook scenarios
   - Downloadable invoice generation with tenant ownership verification

5. **`webhook.test.ts`**:
   - Stripe raw body signature verification
   - Idempotency check: duplicate event rejection
   - Complete onboarding webhook flow (`PendingRegistration` -> Active `Organization`)
   - Expired checkout session handling
   - Database failure rollback simulation

---

## 11. API Reference Summary

### Authentication & Onboarding
- `POST /api/auth/register-onboard` - Register organization & create Stripe checkout session
- `GET /api/auth/onboard-status` - Check onboarding activation status via polling
- `POST /api/auth/login` - Authenticate user & return JWT token
- `POST /api/auth/forgot-password` - Request password reset link
- `POST /api/auth/reset-password` - Set new password with reset token
- `POST /api/auth/change-password` - Change password (authenticated)
- `POST /api/auth/accept-invitation` - Complete invited member account setup

### Organizations
- `GET /api/organizations` - List all organizations with search & status filters (Platform Admin)
- `GET /api/organizations/:id/details` - Full profile, members, subscriptions, payments & transactions (Platform Admin)
- `GET /api/organizations/:id/members` - Member count & list (Platform Admin)
- `POST /api/organizations/:id/suspend` - Suspend tenant access (Platform Admin)
- `POST /api/organizations/:id/reactivate` - Reactivate tenant (Platform Admin)
- `GET /api/organizations/current` - Get current tenant profile (Org Admin & Member)
- `PUT /api/organizations/profile` - Update organization profile & billing email (Org Admin)

### Subscription Plans
- `GET /api/plans/active` - List active subscription plans (Public)
- `GET /api/plans` - List all plans (Platform Admin)
- `POST /api/plans` - Create subscription plan (Platform Admin)
- `PUT /api/plans/:id` - Update subscription plan (Platform Admin)
- `POST /api/plans/:id/disable` - Disable plan (Platform Admin)
- `POST /api/plans/:id/enable` - Enable plan (Platform Admin)

### Subscriptions & Billing
- `GET /api/subscriptions` - View current organization subscription (Org Admin)
- `GET /api/subscriptions/current-plan` - View current plan info (Org Member)
- `GET /api/subscriptions/all` - View all platform subscriptions (Platform Admin)
- `POST /api/subscriptions/cancel` - Schedule subscription cancellation (Org Admin)
- `POST /api/subscriptions/check-expiring` - Trigger subscription expiration checks (System/Admin)

### Payments & Invoices
- `POST /api/payments/checkout` - Create Stripe checkout session for plan switch (Org Admin)
- `GET /api/payments` - List organization payments (Org Admin)
- `GET /api/payments/all` - List all platform payments (Platform Admin)
- `GET /api/payments/:id/invoice` - View/download itemized invoice with tenant verification (Org Admin)

### Transactions
- `GET /api/transactions` - Organization transactions with status filter (Org Admin)
- `GET /api/transactions/all` - Cross-tenant transactions with org & status filters (Platform Admin)

### Team Management
- `GET /api/members` - List organization team members (Org Admin & Member)
- `POST /api/members/invite` - Invite new team member by email (Org Admin)
- `PUT /api/members/:userId/role` - Update member role (Org Admin)
- `DELETE /api/members/:userId` - Remove member from organization (Org Admin)

### Webhooks
- `POST /api/webhooks/stripe` - Authoritative Stripe webhook handler with raw signature verification

---

## 12. Security Checklist

- [x] Passwords hashed with bcrypt (salt rounds: 10)
- [x] JWT expiration and signature verification enforced
- [x] No sensitive secrets in client-side code
- [x] Stripe card credentials never touch backend servers
- [x] Raw request buffer capture for Stripe signature verification
- [x] Webhook idempotency protection via unique event storage
- [x] Database transactions with compensating rollbacks on payment failure
- [x] Tenant scoping on every organization database query
- [x] Cross-tenant reads, updates, and deletes rejected
- [x] Helmet security headers and CORS origin restrictions
- [x] Rate limiting configured on authentication and payment routes

---

## 13. License

This project was built for the Octopi Digital Full-Stack Developer Technical Assessment.