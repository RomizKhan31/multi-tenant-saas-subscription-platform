# Multi-Tenant SaaS Subscription Platform

A multi-tenant SaaS subscription platform built with Next.js, Express, MongoDB, and Stripe.

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB 7.0+ running locally
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Configure the environment values in `.env`, then seed and start the backend:

```bash
npm run seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
cd backend
npm test
```

## License

ISC
