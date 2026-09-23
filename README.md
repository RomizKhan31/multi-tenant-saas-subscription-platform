# Multi-Tenant SaaS Subscription Platform

A production-ready, maintainable, secure multi-tenant SaaS subscription platform built with Next.js, Express, MongoDB, and Stripe.

## Project Overview

This platform enables multiple organizations to register, select subscription plans, pay through Stripe, and manage their own organizations and members. The platform guarantees strict multi-tenant data isolation where Organization A can never access, modify, or see Organization B's data.

## Architecture

```
Next.js Frontend (App Router)
   ↓
Express REST API
   ↓
Services (Business Logic)
   ↓
Repositories (Data Access)
   ↓
MongoDB

Express
   ↓
Stripe (Checkout & Webhooks)

Stripe
   ↓
Webhook
   ↓
Express
   ↓
MongoDB (Transaction)
```

### Layered Architecture

- **Frontend**: Next.js with App Router, TypeScript, Tailwind CSS, TanStack Query
- **API Layer**: Express.js REST API with TypeScript
- **Controller Layer**: Request/response handling and validation
- **Service Layer**: Business logic and orchestration
- **Repository Layer**: Data access and MongoDB queries
- **Database**: MongoDB with Mongoose ODM

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- TanStack Query (React Query)
- Axios
- Lucide React

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- Stripe
- Resend (Email)
- JWT (Authentication)
- Zod (Validation)
- Helmet (Security)
- CORS

### Database
- MongoDB with proper indexing and relationships

## Database Design

### Collections

#### User
- `email` (unique, indexed)
- `password` (hashed with bcrypt)
- `name`
- `role` (PLATFORM_ADMIN, ORGANIZATION_ADMIN, ORGANIZATION_MEMBER)
- `organizationId` (indexed)
- `status` (ACTIVE, INACTIVE)
- `createdAt`, `updatedAt`

#### Organization
- `name` (indexed)
- `contactEmail`
- `billingEmail`
- `status` (ACTIVE, TRIAL, SUSPENDED, CANCELLED)
- `createdAt`, `updatedAt`

#### Plan
- `name` (indexed)
- `price`
- `billingInterval` (MONTHLY, YEARLY)
- `features` (array)
- `isActive`
- `createdAt`, `updatedAt`

#### Subscription
- `organizationId` (indexed)
- `planId`
- `status` (ACTIVE, PENDING, FAILED, CANCELLED, EXPIRED)
- `stripeSubscriptionId` (indexed, sparse)
- `stripeCustomerId`
- `currentPeriodStart`, `currentPeriodEnd`
- `cancelAtPeriodEnd`
- `createdAt`, `updatedAt`

#### Payment
- `organizationId` (indexed)
- `subscriptionId`
- `amount`
- `currency`
- `status` (PENDING, SUCCESS, FAILED, REFUNDED, ROLLED_BACK)
- `stripePaymentIntentId` (indexed, sparse)
- `stripeCheckoutSessionId`
- `createdAt`, `updatedAt`

#### Transaction
- `organizationId` (indexed)
- `paymentId`
- `amount`
- `currency`
- `status` (PENDING, SUCCESS, FAILED, REFUNDED, ROLLED_BACK)
- `description`
- `createdAt`, `updatedAt`

#### Invitation
- `organizationId` (indexed)
- `email` (indexed)
- `role`
- `status` (PENDING, ACCEPTED, EXPIRED, REVOKED)
- `token` (unique, indexed)
- `expiresAt` (indexed)
- `createdAt`, `updatedAt`

#### PasswordResetToken
- `userId` (indexed)
- `token` (unique, indexed)
- `expiresAt` (indexed)
- `createdAt`

#### WebhookEvent
- `stripeEventId` (unique, indexed)
- `eventType`
- `processed` (indexed)
- `processedAt`
- `error`
- `createdAt`

### Multi-Tenancy Strategy

Every organization-owned resource has an `organizationId` field. All organization-scoped queries include tenant filtering:

```javascript
// Correct - Tenant-scoped query
Payment.find({
  organizationId: authenticatedUser.organizationId
})

// Incorrect - Allows cross-tenant access
Payment.find({
  _id: requestedPaymentId
})
```

### Cross-Tenant Access Prevention

1. **Server-side authorization**: All protected endpoints verify user role and organization membership
2. **Repository-level filtering**: All queries include organizationId where applicable
3. **Middleware checks**: `requireOrganizationAccess` ensures user has organization context
4. **Role-based access**: `requireRole` middleware enforces role permissions

## Authentication

### Login Flow
1. User submits email and password
2. Server validates credentials
3. Server generates JWT token with user info
4. Token stored in localStorage
5. Token sent in Authorization header for subsequent requests

### JWT Strategy
- Secret: `JWT_SECRET` environment variable
- Expiration: 7 days (configurable via `JWT_EXPIRES_IN`)
- Payload: userId, email, role, organizationId

### Password Hashing
- Algorithm: bcrypt with salt rounds of 10
- Never store plaintext passwords
- Hashing performed in User model pre-save hook

### Password Reset Flow
1. User requests reset with email
2. Server generates reset token (expires in 1 hour)
3. Token stored in database
4. Reset link sent to email (via Resend)
5. User clicks link and enters new password
6. Server validates token and updates password
7. Token deleted after use

## Payment Flow

```
Signup
   ↓
Validate input
   ↓
Create pending organization/subscription
   ↓
Create Stripe Checkout Session
   ↓
Stripe Checkout
   ↓
Payment
   ↓
Stripe webhook
   ↓
Verify webhook signature
   ↓
Idempotency check (stripeEventId)
   ↓
MongoDB transaction
   ↓
Activate organization
   ↓
Create subscription
   ↓
Create payment record
   ↓
Create transaction record
   ↓
Send success email
```

### Transaction / Rollback

Payment confirmation uses MongoDB transactions to ensure atomicity:

```javascript
START TRANSACTION
  → Update organization status
  → Create/update subscription
  → Update payment status
  → Create transaction record
IF EVERYTHING SUCCESS:
  COMMIT
IF ANYTHING FAILS:
  ROLLBACK
  → Mark payment as ROLLED_BACK
  → Create failed transaction record
```

## Stripe Webhooks

### Signature Verification
- Raw request body is used for verification
- `STRIPE_WEBHOOK_SECRET` environment variable
- Rejects invalid signatures immediately

### Idempotency
- Every Stripe event has a unique `stripeEventId`
- Events are stored in `WebhookEvent` collection
- Before processing, check if event already exists
- Duplicate events are safely ignored

### Handled Events
- `checkout.session.completed` - Successful payment
- `checkout.session.expired` - Abandoned checkout
- `payment_intent.succeeded` - Payment success
- `payment_intent.payment_failed` - Payment failure
- `invoice.payment_succeeded` - Recurring payment
- `invoice.payment_failed` - Recurring payment failure
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Subscription cancellation

## Security

### Authentication & Authorization
- JWT-based authentication with expiration
- Role-based access control (RBAC)
- Organization membership verification
- Server-side authorization on all protected endpoints

### Input Validation
- Zod schema validation on all API endpoints
- Email format validation
- Password strength validation
- ID validation

### Rate Limiting
- Login: 5 requests per 15 minutes
- Registration: 5 requests per 15 minutes
- Password reset: 5 requests per 15 minutes
- Member invitation: 10 requests per hour
- Payment checkout: 5 requests per hour
- General: 100 requests per 15 minutes

### Security Headers
- Helmet middleware for security headers
- CORS configuration
- No sensitive data in frontend code
- Environment variables for secrets

### Payment Security
- Never store card numbers or CVV
- Stripe handles all sensitive payment data
- Server-side payment verification via webhooks
- No payment credentials exposed to frontend

### Secrets Management
- All secrets in environment variables
- `.env` files in `.gitignore`
- `.env.example` files with placeholder values
- Never commit real API keys or secrets

## Email

### Provider
- Resend (transactional email service)

### Notification Events
- Member invitation
- Payment succeeded
- Payment failed
- Subscription upgraded
- Subscription downgraded
- Subscription cancelled
- Subscription expiring soon (scheduled job)

### Configuration
- `RESEND_API_KEY` environment variable
- `EMAIL_FROM` environment variable

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB 6+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
cp env.example .env.local
# Edit .env.local with your values
npm run dev
```

Frontend runs on `http://localhost:3000`

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/multi-tenant-saas

# JWT
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Email (Resend)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Test Credentials

### Platform Admin
- Email: `platform-admin@example.com`
- Password: `PlatformAdmin123!`
- Role: PLATFORM_ADMIN

### Organization Admin
- Email: `org-admin@example.com`
- Password: `OrgAdmin123!`
- Role: ORGANIZATION_ADMIN

### Organization Member
- Email: `org-member@example.com`
- Password: `OrgMember123!`
- Role: ORGANIZATION_MEMBER

**Note**: These are placeholder credentials. You need to create users via the registration API or seed the database with actual test users.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated)

### Organizations
- `GET /api/organizations` - List organizations (Platform Admin)
- `GET /api/organizations/:id` - Get organization details (Platform Admin)
- `GET /api/organizations/:id/members` - Get organization members (Platform Admin)
- `POST /api/organizations/:id/suspend` - Suspend organization (Platform Admin)
- `POST /api/organizations/:id/reactivate` - Reactivate organization (Platform Admin)
- `PUT /api/organizations/profile` - Update organization (Org Admin)

### Plans
- `POST /api/plans` - Create plan (Platform Admin)
- `GET /api/plans` - List plans (Platform Admin)
- `GET /api/plans/active` - Get active plans
- `GET /api/plans/:id` - Get plan (Platform Admin)
- `PUT /api/plans/:id` - Update plan (Platform Admin)
- `POST /api/plans/:id/disable` - Disable plan (Platform Admin)
- `POST /api/plans/:id/enable` - Enable plan (Platform Admin)

### Subscriptions
- `GET /api/subscriptions` - Get current subscription (Org Admin)
- `POST /api/subscriptions/upgrade` - Upgrade subscription (Org Admin)
- `POST /api/subscriptions/downgrade` - Downgrade subscription (Org Admin)
- `POST /api/subscriptions/cancel` - Cancel subscription (Org Admin)
- `GET /api/subscriptions/all` - List all subscriptions (Platform Admin)

### Payments
- `POST /api/payments/checkout` - Create checkout session (Org Admin)
- `GET /api/payments` - Get organization payments (Org Admin)
- `GET /api/payments/all` - List all payments (Platform Admin)
- `GET /api/payments/:id` - Get payment (Platform Admin)

### Transactions
- `GET /api/transactions` - Get organization transactions (Org Admin)
- `GET /api/transactions/all` - List all transactions (Platform Admin)
- `GET /api/transactions/:id` - Get transaction (Platform Admin)

### Members
- `POST /api/members/invite` - Invite member (Org Admin)
- `POST /api/members/accept` - Accept invitation (Public)
- `DELETE /api/members/:userId` - Remove member (Org Admin)
- `PUT /api/members/:userId/role` - Change member role (Org Admin)
- `GET /api/members` - Get organization members (Org Admin, Org Member)

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook endpoint (Public, signature verified)

## Testing

### Running Tests

```bash
cd backend
npm test
```

### Test Coverage

The project includes comprehensive tests for:

- **Authentication**: Valid/invalid login, expired tokens, protected routes
- **Authorization**: Role-based access control for all three roles
- **Multi-Tenancy**: Cross-tenant access prevention (GET, UPDATE, DELETE)
- **Payment**: Checkout creation, success/failure, webhook verification
- **Webhooks**: Duplicate event handling, signature verification
- **Transactions**: MongoDB transaction rollback scenarios

### Critical Test Scenarios

1. **Tenant Isolation**: Organization A attempting to access Organization B data
2. **Duplicate Webhook**: Same Stripe event sent twice
3. **Transaction Rollback**: Force failure during multi-record operation
4. **Authorization**: Platform Admin, Org Admin, Org Member access patterns
5. **Payment Flow**: Complete signup → checkout → webhook → activation flow

## AI Usage

This project was developed with assistance from AI tools (Cascade/Claude) for:

- Code generation and boilerplate creation
- Architecture planning and design
- Documentation writing
- Debugging and error resolution

All code was reviewed and validated against the assessment requirements. The implementation follows best practices for production-ready applications.

## Known Limitations

1. **Scheduled Jobs**: Subscription expiry reminder emails require a scheduled job implementation (e.g., node-cron)
2. **PDF Invoices**: Invoice generation is not implemented (optional bonus feature)
3. **Custom Email Configuration**: Organization-specific email configuration is not implemented (optional bonus feature)
4. **Frontend Polish**: Dashboard UIs are functional but could benefit from enhanced design
5. **Test Data**: Database seeding scripts for test data are not included
6. **CI/CD**: GitHub Actions pipeline is not implemented (optional bonus feature)

## Git History

The project follows a meaningful commit history:

```
feat: setup express backend with layered architecture
feat: setup Next.js frontend with role-specific dashboards
```

Additional commits will be added as features are implemented and tested.

## License

ISC

## Support

For questions or issues, please refer to the project documentation or contact the development team.