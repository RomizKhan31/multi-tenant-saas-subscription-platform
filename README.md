# Multi-Tenant SaaS Subscription Platform

A full-stack **multi-tenant SaaS subscription platform** built with **Next.js, React, Express.js, TypeScript, MongoDB, Mongoose, JWT, Stripe, and Resend**.

The platform allows multiple organizations to use the same application while maintaining strict organization-level data isolation. It supports authentication, role-based access control, subscription plans, Stripe payments, team management, payment records, transaction management, and platform administration.

> **Project Type:** Full-Stack SaaS Application
> **Architecture:** Next.js Frontend + Express.js REST API
> **Database:** MongoDB
> **Authentication:** JWT
> **Payment:** Stripe Test/Sandbox Mode
> **Email:** Resend

---

## Table of Contents

* [Features](#features)
* [Architecture](#architecture)
* [Technology Stack](#technology-stack)
* [Database Design](#database-design)
* [Multi-Tenant Data Isolation](#multi-tenant-data-isolation)
* [Authentication and Authorization](#authentication-and-authorization)
* [Subscription and Payment Flow](#subscription-and-payment-flow)
* [Transactions and Rollback Strategy](#transactions-and-rollback-strategy)
* [User Roles](#user-roles)
* [Security](#security)
* [Email Notifications](#email-notifications)
* [Project Structure](#project-structure)
* [Environment Variables](#environment-variables)
* [Local Development](#local-development)
* [Stripe Local Webhook Testing](#stripe-local-webhook-testing)
* [Testing](#testing)
* [AI-Assisted Development](#ai-assisted-development)
* [Known Limitations](#known-limitations)
* [Future Improvements](#future-improvements)
* [API Overview](#api-overview)
* [Design Decisions Summary](#design-decisions-summary)
* [Project Purpose](#project-purpose)
* [License](#license)

---

# Features

## Platform Management

* Platform administrator dashboard
* Organization management
* Organization suspension/reactivation
* Subscription plan management
* Platform-wide payment monitoring
* Platform-wide transaction monitoring
* Organization-level statistics

## Multi-Tenancy

* Multiple organizations supported within one application
* Organization-level data isolation
* Tenant-aware repository queries
* Cross-tenant access prevention
* Organization-aware authorization

## Authentication

* JWT-based authentication
* Secure password hashing using bcrypt
* Login and registration
* Password reset
* Change password
* Protected API routes
* Role-based authorization

## Subscription & Billing

* Subscription plan management
* Stripe Checkout integration
* Subscription upgrades
* Subscription cancellation
* Payment records
* Transaction records
* Invoice access
* Subscription expiration checks

## Team Management

* Organization member invitations
* Member role management
* Member removal
* Organization-specific member listing
* Secure invitation acceptance

## Security

* JWT authentication
* Role-based authorization
* Organization-level authorization
* Tenant-scoped database queries
* Helmet security headers
* CORS configuration
* API rate limiting
* Zod request validation
* Stripe webhook signature verification
* Webhook idempotency
* Password hashing
* Server-side secret management

---

# Architecture

The backend follows a layered architecture that separates HTTP handling, authorization, business logic, and database access.

```text
                    ┌─────────────────────────┐
                    │       Next.js App       │
                    │      React / Axios      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Express Routes     │
                    │   Validation / Routing  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       Middleware        │
                    │ Auth / Role / Tenant    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       Controllers       │
                    │    HTTP Request Layer   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        Services         │
                    │     Business Logic      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       Repositories      │
                    │   Tenant-Scoped Queries │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     MongoDB / Mongoose  │
                    └─────────────────────────┘
```

### Architecture Responsibilities

**Routes**

Define API endpoints and connect requests to controllers.

**Middleware**

Handles:

* JWT authentication
* Role authorization
* Organization access
* Request validation
* Rate limiting

**Controllers**

Handle HTTP requests and responses while delegating business logic to services.

**Services**

Contain application and business logic such as:

* Organization onboarding
* Subscription management
* Payment processing
* Invitations
* Transactions

**Repositories**

Encapsulate database operations and enforce tenant-aware queries.

**Models**

Define MongoDB/Mongoose schemas and relationships.

---

# Technology Stack

## Frontend

| Technology     | Purpose                      |
| -------------- | ---------------------------- |
| Next.js 16     | React framework / App Router |
| React 19       | UI development               |
| TypeScript     | Type safety                  |
| TanStack Query | Server/API state management  |
| Axios          | HTTP communication           |
| Tailwind CSS   | Styling                      |
| Lucide React   | Icons                        |

## Backend

| Technology         | Purpose              |
| ------------------ | -------------------- |
| Node.js            | Runtime              |
| Express.js         | REST API             |
| TypeScript         | Type safety          |
| MongoDB            | Database             |
| Mongoose           | MongoDB ODM          |
| JWT                | Authentication       |
| bcryptjs           | Password hashing     |
| Zod                | Input validation     |
| Helmet             | HTTP security        |
| CORS               | Cross-origin control |
| express-rate-limit | Rate limiting        |

## External Services

| Service                 | Purpose                             |
| ----------------------- | ----------------------------------- |
| Stripe                  | Subscription and payment processing |
| Resend                  | Transactional email                 |
| MongoDB Atlas / MongoDB | Database hosting                    |

---

# Database Design

The application uses **MongoDB with Mongoose**.

The main domain entities are:

```text
Organization
     │
     ├── Users
     ├── Subscriptions
     ├── Payments
     ├── Transactions
     └── Invitations

Plan
     │
     └── Subscriptions

PendingRegistration
     │
     └── Stripe Checkout Session

WebhookEvent
     │
     └── Stripe Event Idempotency
```

## Main Collections

### Organization

Represents a SaaS tenant.

Typical responsibilities include:

* Organization identity
* Organization status
* Organization profile
* Billing information
* Tenant lifecycle

---

### User

Represents users belonging to an organization.

Important fields include:

```text
organizationId
role
email
passwordHash
profile information
```

The `organizationId` establishes the user's tenant relationship.

---

### Plan

Represents platform-level subscription plans.

Example plans:

```text
Classic
Standard
Premium
```

Plans are platform-managed resources rather than organization-owned resources.

---

### Subscription

Connects an organization to a subscription plan.

```text
Organization
      │
      └── Subscription ──> Plan
```

---

### Payment

Stores payment information associated with an organization.

Conceptually:

```text
Payment
 ├── organizationId
 ├── amount
 ├── status
 ├── Stripe reference
 └── timestamps
```

---

### Transaction

Represents financial transaction records.

Organization users can access transactions belonging to their organization, while platform administrators can access platform-level transaction information.

---

### Invitation

Stores organization member invitations.

Each invitation belongs to the organization that created it.

---

### PendingRegistration

Stores temporary onboarding information before an organization is fully activated.

The application does not rely only on the frontend Stripe success redirect to activate an organization.

---

### WebhookEvent

Stores processed Stripe webhook event identifiers.

This provides webhook idempotency and prevents duplicate processing.

---

# Multi-Tenant Data Isolation

Multi-tenant data isolation is a core security requirement of this application.

The platform uses a:

> **Shared database + logical tenant isolation**

architecture.

Each organization is treated as an independent tenant.

```text
                         MongoDB
                            │
             ┌──────────────┴──────────────┐
             │                             │
       Organization A                Organization B
        organizationId=A              organizationId=B
             │                             │
       ┌─────┼─────┐                 ┌─────┼─────┐
       │     │     │                 │     │     │
     Users Payments ...            Users Payments ...
```

Organization A must never be able to access Organization B's tenant-owned resources.

---

## Tenant Ownership

Tenant-owned records contain an `organizationId`.

For example:

```text
User
Payment
Transaction
Subscription
Invitation
```

This identifier establishes the organization boundary.

---

# API-Level Isolation

The organization identifier is derived from the **authenticated server-side user context**.

The client is not trusted to define its own organization.

For example:

```ts
const organizationId = req.user.organizationId;
```

Tenant-owned queries are then scoped using this trusted value.

### Tenant-Scoped Query

```ts
const payments = await Payment.find({
  organizationId: req.user.organizationId,
});
```

For a specific resource:

```ts
const payment = await Payment.findOne({
  _id: paymentId,
  organizationId: req.user.organizationId,
});
```

Therefore, changing the resource ID alone does not allow access to another organization's resource.

---

# Protection Against IDOR

A vulnerable query could look like:

```ts
Payment.findById(paymentId);
```

This only verifies whether a resource exists.

The application instead uses:

```ts
Payment.findOne({
  _id: paymentId,
  organizationId: authenticatedOrganizationId,
});
```

The request must satisfy **both conditions**:

```text
Resource ID matches
        +
Organization ID matches
        ↓
      Access
```

If the organization does not match:

```text
        Request
           │
           ▼
    Resource lookup
           │
           ▼
organizationId mismatch
           │
           ▼
    Access rejected
```

This helps prevent IDOR-style cross-tenant access.

---

# Tenant Authorization Flow

```text
Request
   │
   ▼
JWT Verification
   │
   ▼
Authenticated User
   │
   ▼
Organization Context
   │
   ▼
Role Authorization
   │
   ▼
Tenant-Scoped Service
   │
   ▼
Tenant-Scoped Repository
   │
   ▼
MongoDB
```

The tenant boundary is therefore enforced at multiple application layers instead of relying only on frontend restrictions.

---

# Authentication and Authorization

The application uses **JWT-based stateless authentication**.

## Login Flow

```text
User
 │
 ▼
POST /api/auth/login
 │
 ▼
Validate credentials
 │
 ▼
Compare password with bcrypt hash
 │
 ▼
Generate JWT
 │
 ▼
Authenticated API request
 │
 ▼
JWT verification middleware
 │
 ▼
Authenticated user context
```

The server uses the authenticated context to determine:

* User identity
* Organization
* Role
* Permissions

---

# Role-Based Access Control

The platform contains three primary roles:

| Role                  | Scope                                  |
| --------------------- | -------------------------------------- |
| `PLATFORM_ADMIN`      | Entire platform                        |
| `ORGANIZATION_ADMIN`  | Own organization                       |
| `ORGANIZATION_MEMBER` | Limited access within own organization |

## Platform Admin

Can manage platform-wide resources such as:

* Organizations
* Subscription plans
* Platform statistics
* Payments
* Transactions
* Organization status

## Organization Admin

Can manage resources within their organization:

* Organization profile
* Team members
* Member roles
* Subscription
* Payments
* Transactions
* Billing

## Organization Member

Has limited access to their organization, including:

* Organization information
* Own profile
* Password management

---

# Subscription and Payment Flow

Stripe Checkout is used for payment processing.

The application does not directly handle raw card information.

## Organization Onboarding

```text
1. User submits registration
          │
          ▼
2. Validate registration
          │
          ▼
3. Create PendingRegistration
          │
          ▼
4. Create Stripe Checkout Session
          │
          ▼
5. User completes payment on Stripe
          │
          ▼
6. Stripe sends webhook
          │
          ▼
7. Verify webhook signature
          │
          ▼
8. Check webhook idempotency
          │
          ▼
9. Database transaction
          │
          ├── Create Organization
          ├── Create Organization Admin
          ├── Create Subscription
          ├── Create Payment
          ├── Create Transaction
          └── Complete Registration
          │
          ▼
10. Send confirmation email
```

### Important Payment Principle

The frontend success redirect is **not treated as proof of payment**.

The Stripe webhook is used as the authoritative payment confirmation mechanism.

This prevents account activation based solely on manipulated frontend redirects.

---

# Stripe Webhook Security

Stripe webhook signatures are verified before processing.

Conceptually:

```ts
stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret
);
```

Invalid webhook signatures are rejected.

---

## Webhook Idempotency

Stripe may deliver the same event more than once.

The application stores processed Stripe event IDs.

```text
Stripe Event
     │
     ▼
Check Event ID
     │
     ├── Already processed
     │       │
     │       ▼
     │     Ignore
     │
     └── New event
             │
             ▼
       Process event
             │
             ▼
       Store Event ID
```

This prevents duplicate processing.

---

# Transactions and Rollback Strategy

Some workflows require multiple MongoDB documents to be created or updated together.

For example, successful onboarding may involve:

```text
Organization
User
Subscription
Payment
Transaction
PendingRegistration
```

These operations should not leave the database in a partially completed state.

## MongoDB Transaction

Where MongoDB transaction support is available, the application uses a Mongoose session.

Conceptually:

```ts
const session = await mongoose.startSession();

try {
  session.startTransaction();

  await createOrganization(session);
  await createUser(session);
  await createSubscription(session);
  await createPayment(session);
  await createTransaction(session);

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

If an operation fails, the transaction can be aborted so the database does not retain a partially completed workflow.

---

## External Service Failures

Stripe and MongoDB are separate systems and cannot participate in the same distributed transaction.

Therefore:

```text
MongoDB Transaction
        │
        ├── Success → Commit
        │
        └── Failure → Abort
```

For failures involving external services, compensating actions and failure-state handling are used where appropriate.

This separates:

* **Database atomicity**
* **External service consistency**

---

# Security

Security is implemented at multiple layers.

## Authentication

* JWT signature verification
* JWT expiration
* bcrypt password hashing
* Protected routes
* Password reset flow

## Authorization

* Role-based authorization
* Organization membership checks
* Tenant-scoped database queries
* Cross-tenant access prevention

## Input Validation

* Zod validation
* Server-side validation
* Controlled API payloads

## HTTP Security

* Helmet
* CORS
* Rate limiting
* Secure response headers

## Payment Security

* Stripe Checkout
* Stripe webhook signature verification
* Webhook idempotency
* No raw card information stored by the application

## Secret Management

Sensitive credentials are stored in environment variables rather than committed to source control.

---

# Email Notifications

The application uses **Resend** for transactional email.

Email workflows include:

* Organization activation
* Member invitations
* Password reset
* Successful payment
* Failed payment
* Subscription cancellation
* Subscription expiration notifications

---

# Project Structure

```text
multi-tenant-saas-subscription-platform/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── tests/
│   │   └── ...
│   │
│   ├── .env.example
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   └── ...
│
├── .gitignore
└── README.md
```

---

# Environment Variables

Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

Configure the required variables.

Example:

```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/multi-tenant-saas

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@example.com

# Frontend
FRONTEND_URL=http://localhost:3000
```

> **Never commit `.env` files or secret keys to Git.**

---

# Local Development

## Prerequisites

Install:

* Node.js 20+
* npm
* MongoDB
* Git
* Stripe CLI

---

## 1. Clone Repository

```bash
git clone https://github.com/RomizKhan31/multi-tenant-saas-subscription-platform.git

cd multi-tenant-saas-subscription-platform
```

---

## 2. Backend Setup

```bash
cd backend

npm install

cp .env.example .env
```

Configure `.env`.

Seed initial data:

```bash
npm run seed
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

## 3. Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

# Stripe Local Webhook Testing

Authenticate Stripe CLI:

```bash
stripe login
```

Forward Stripe events to the local backend:

```bash
stripe listen \
  --forward-to localhost:5000/api/webhooks/stripe
```

Stripe CLI will provide a webhook signing secret.

Add it to:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

You can then trigger Stripe test events using the Stripe CLI.

---

# Testing

Run backend tests:

```bash
cd backend
npm test
```

Important test areas include:

### Authentication

* Registration validation
* Duplicate email handling
* Password validation
* Login
* JWT generation
* Expired JWT rejection
* Protected routes

### Authorization

* Platform admin permissions
* Organization admin permissions
* Organization member permissions
* Role escalation prevention

### Multi-Tenancy

* Cross-tenant read prevention
* Cross-tenant update prevention
* Cross-tenant delete prevention
* Tenant ownership verification

### Payments

* Stripe Checkout creation
* Payment success
* Payment failure
* Invoice access
* Tenant ownership verification

### Webhooks

* Stripe signature validation
* Duplicate event prevention
* Successful onboarding
* Expired checkout handling
* Database failure handling

---

# AI-Assisted Development

AI tools were used as development assistants during the project.

They were used for tasks such as:

* Exploring architecture approaches
* Generating implementation starting points
* Debugging development issues
* Reviewing code structure
* Improving validation and error handling
* Generating test-case ideas
* Reviewing security considerations
* Improving documentation
* Refactoring repetitive code

AI-generated suggestions were reviewed and adapted during development rather than being blindly accepted.

Particular attention was given to security-sensitive areas:

* Authentication
* Authorization
* Tenant isolation
* Payment processing
* Webhook verification
* Database transactions
* Environment secrets

The final implementation and engineering decisions were verified during development and testing.

---

# Known Limitations

## 1. Stripe Test Mode

The project currently uses Stripe test/sandbox credentials.

Production deployment would require:

* Production Stripe keys
* Production webhook configuration
* Production webhook secret
* Production Stripe account configuration

---

## 2. Shared Database Architecture

The current system uses:

```text
Shared MongoDB Database
        +
organizationId-based isolation
```

This provides logical tenant separation.

For highly regulated or very large enterprise deployments, alternative isolation strategies could be considered, such as:

```text
Shared Database
       ↓
Separate Database per Tenant
       ↓
Separate Infrastructure per Tenant
```

The appropriate strategy depends on scale, compliance, cost, and operational requirements.

---

## 3. External Service Dependency

Payment and email functionality depends on external services:

* Stripe
* Resend

Temporary service outages can affect related workflows.

---

## 4. Advanced Observability

The current implementation does not include a complete centralized observability stack.

Future production improvements could include:

* Structured logging
* Metrics
* Distributed tracing
* Error monitoring
* Audit logging

---

# Future Improvements

The following features are planned for future production enhancement and are **not part of the current implementation**.

## DevOps

* Docker
* Docker Compose
* Containerized development environment
* Production container deployment
* CI/CD pipelines
* GitHub Actions
* Automated deployment
* Automated security scanning

## Performance & Scalability

* Redis caching
* Distributed background jobs
* Horizontal backend scaling
* CDN integration
* Dedicated worker services

## Observability

* Structured application logging
* Centralized log management
* Application metrics
* Distributed tracing
* OpenTelemetry
* Error monitoring
* Alerting

## Infrastructure

* Automated database backups
* Disaster recovery strategy
* Advanced health checks
* Production monitoring
* Automated deployment rollback

## Multi-Tenant Enhancements

* Advanced tenant-level database policies
* Database-per-tenant architecture option
* Enterprise tenant isolation
* Tenant-specific infrastructure

## Payment Enhancements

* Production Stripe integration
* Advanced subscription lifecycle synchronization
* Automated invoice reconciliation
* Improved payment recovery workflows

## Testing

* Expanded E2E testing
* Load testing
* Security testing
* Automated regression testing

---

# API Overview

## Authentication

```text
POST /api/auth/register-onboard
GET  /api/auth/onboard-status
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/change-password
POST /api/auth/accept-invitation
```

## Organizations

```text
GET  /api/organizations
GET  /api/organizations/:id/details
GET  /api/organizations/:id/members
POST /api/organizations/:id/suspend
POST /api/organizations/:id/reactivate

GET  /api/organizations/current
PUT  /api/organizations/profile
```

## Plans

```text
GET  /api/plans/active
GET  /api/plans
POST /api/plans
PUT  /api/plans/:id
POST /api/plans/:id/disable
POST /api/plans/:id/enable
```

## Subscriptions

```text
GET  /api/subscriptions
GET  /api/subscriptions/current-plan
GET  /api/subscriptions/all
POST /api/subscriptions/cancel
POST /api/subscriptions/check-expiring
```

## Payments

```text
POST /api/payments/checkout
GET  /api/payments
GET  /api/payments/all
GET  /api/payments/:id/invoice
```

## Transactions

```text
GET /api/transactions
GET /api/transactions/all
```

## Team Management

```text
GET    /api/members
POST   /api/members/invite
PUT    /api/members/:userId/role
DELETE /api/members/:userId
```

## Stripe Webhook

```text
POST /api/webhooks/stripe
```

---

# Design Decisions Summary

| Concern             | Current Approach                           |
| ------------------- | ------------------------------------------ |
| Multi-tenancy       | Shared database + logical tenant isolation |
| Tenant identifier   | `organizationId`                           |
| Tenant source       | Authenticated server-side user context     |
| Database access     | Repository pattern                         |
| Authentication      | JWT                                        |
| Password security   | bcrypt                                     |
| Authorization       | Role + organization access middleware      |
| Validation          | Zod                                        |
| Database            | MongoDB + Mongoose                         |
| Payments            | Stripe Checkout                            |
| Webhook security    | Stripe signature verification              |
| Webhook duplication | Event ID / idempotency                     |
| Critical writes     | MongoDB transactions                       |
| External failures   | Compensating/failure handling              |
| Email               | Resend                                     |
| HTTP security       | Helmet + CORS                              |
| Abuse protection    | Rate limiting                              |
| Docker              | Future improvement                         |
| CI/CD               | Future improvement                         |
| Monitoring          | Future improvement                         |

---

# Project Purpose

This project was developed as a **Full-Stack Developer technical assessment for Octopi Digital**.

It demonstrates practical implementation of:

* Multi-tenant SaaS architecture
* REST API development
* Authentication and authorization
* Role-based access control
* MongoDB database design
* Subscription billing
* Stripe integration
* Stripe webhook security
* Transaction management
* Tenant data isolation
* Automated backend testing
* Secure software engineering practices

---

# Repository

GitHub:

https://github.com/RomizKhan31/multi-tenant-saas-subscription-platform

---

# License

This project was developed for technical assessment and demonstration purposes.
