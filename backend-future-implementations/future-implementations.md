# Backend Future Implementations & Roadmap

This document outlines backend features, security enhancements, integrations, and architectural tasks planned for future implementation in the **C-Mopol** e-commerce platform.

---

## 1. Authentication & Security Enhancements

### 1.1 Email Service Integration
- **Status:** Pending
- **Description:** Connect a transactional email provider (e.g., Nodemailer with AWS SES, SendGrid, or Resend) to send system emails.
- **Tasks:**
  - Create an email transport service (`src/services/email.js`).
  - Implement HTML email templates for:
    - Password reset links (replaces the dev console log in `POST /forgot-password`).
    - Welcome email upon registration.
    - Email verification links.
    - Order receipts and shipping notifications.

### 1.2 Account Email Verification
- **Status:** Schema field ready (`isEmailVerified: Boolean` in `User` model)
- **Description:** Require users to verify their email address before accessing certain customer features.
- **Tasks:**
  - Add `emailVerificationToken` and `emailVerificationExpires` to `User` schema (with `select: false`).
  - Endpoint `POST /api/v1/auth/verify-email/:token` to confirm verification.
  - Endpoint `POST /api/v1/auth/resend-verification` with rate limiting.

### 1.3 Multi-Device & Session Management
- **Status:** Pending
- **Description:** Allow users to view all currently active logged-in sessions/devices and revoke individual sessions or log out of all devices at once.
- **Tasks:**
  - Update `User.refreshToken` from a single string to an array of session objects:
    ```javascript
    sessions: [
      {
        tokenId: String,
        tokenHash: String,
        userAgent: String,
        ipAddress: String,
        lastActive: Date,
        createdAt: Date,
      }
    ]
    ```
  - Endpoint `GET /api/v1/auth/sessions` (list active devices).
  - Endpoint `DELETE /api/v1/auth/sessions/:sessionId` (revoke specific session).
  - Endpoint `POST /api/v1/auth/logout-all` (clear all refresh tokens).

### 1.4 Two-Factor Authentication (2FA / MFA)
- **Status:** Pending
- **Description:** Provide TOTP-based 2FA (Google Authenticator, Authy) for admin accounts and security-conscious customers.
- **Tasks:**
  - Install `otplib` and `qrcode`.
  - Endpoint `POST /api/v1/auth/2fa/setup` to generate secret and QR code data URL.
  - Endpoint `POST /api/v1/auth/2fa/verify` to enable 2FA after confirming code.
  - Update `POST /login` flow to challenge for 2FA token if user has `is2FAEnabled: true`.

### 1.5 Social OAuth Logins
- **Status:** Pending
- **Description:** Google and Apple Single Sign-On (SSO).
- **Tasks:**
  - Support Google OAuth2 token verification or Passport strategy.
  - Route `/api/v1/auth/oauth/google`.
  - Handle user creation/linkage without requiring passwords.

### 1.6 Rate Limiting & Brute-Force Protection
- **Status:** Pending / Deferred
- **Description:** Implement layered rate limiting to protect the API from denial-of-service (DoS) attacks and brute-force credential stuffing.
- **Tasks:**
  - **Global API Rate Limiting:** Apply an `express-rate-limit` middleware across all `/api` routes (e.g. 100 requests per 15-minute window per IP) to prevent server resource exhaustion.
  - **Auth Route Limiting:** Configure aggressive rate limiters on sensitive endpoints:
    - `POST /api/v1/auth/login` (e.g., 5-10 attempts per 15 minutes to block password guessing).
    - `POST /api/v1/auth/forgot-password` (e.g., 3-5 requests per hour to prevent email spamming).
    - `POST /api/v1/auth/reset-password/:token` (e.g., 5 attempts per 15 minutes).
  - **Redis Store for Distributed Rate Limiting:** Use `rate-limit-redis` to share rate-limit counters across multi-instance or clustered server deployments rather than keeping counts in single-process memory.

---

## 2. Core E-Commerce Modules (Phase 2 & 3)

### 2.1 Products & Catalog Management
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Product CRUD endpoints (`/api/v1/products`).
  - Advanced search and filtering (query by category, price range, brand, availability, text search).
  - Pagination, sorting (price asc/desc, newest, rating).
  - Media upload integration (Cloudinary or AWS S3) for product galleries.
  - Inventory management (stock decrement on purchase, low-stock alerts).

### 2.2 Category Hierarchy
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Category tree endpoints (`/api/v1/categories`).
  - Support nested parent-child categories.
  - Auto-generated slugs.

### 2.3 Cart & Guest Cart Synchronization
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Authenticated cart CRUD (`/api/v1/cart`).
  - Support for guest cart merging: when a guest user logs in, merge their local cart items into their database cart.
  - Server-side inventory checks before adding items or updating quantities.

### 2.4 Checkout, Orders & Pricing Snapshots
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Order creation with transactional integrity (`mongoose` session / transaction).
  - Validate and lock in snapshot prices, discounts, taxes, and shipping rates at checkout.
  - Reduce inventory counts atomically using MongoDB `$inc` operators with checks (`$gte: quantity`).
  - Order status state-machine (`pending` -> `confirmed` -> `processing` -> `shipped` -> `delivered` / `cancelled`).

### 2.5 Payment Gateway Integration
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Stripe / Paystack / Flutterwave integration.
  - Secure webhook endpoint (`/api/v1/payments/webhook`) with signature verification to handle asynchronous payment confirmations, refunds, and failures.
  - Idempotency handling on payment charges.

### 2.6 Address Book
- **Status:** Models and Joi validation schemas ready
- **Tasks:**
  - Customer address management (`/api/v1/addresses`).
  - Set default shipping and billing addresses.

---

## 3. Administration & Back-Office

### 3.1 Admin User Management
- **Status:** Pending
- **Tasks:**
  - Endpoints to list users with filtering by status and role (`GET /api/v1/admin/users`).
  - Suspend / activate / soft-delete user accounts (`PATCH /api/v1/admin/users/:id/status`).
  - Role management (promoting staff to admin).

### 3.2 Order Management for Staff
- **Status:** Pending
- **Tasks:**
  - Admin view of all platform orders.
  - Bulk order status updates and tracking number assignment.
  - Issue refunds via payment gateway API.

---

## 4. Performance, Observability & Infrastructure

### 4.1 Production Logging & Error Tracking
- **Status:** Development `morgan` logger currently active
- **Tasks:**
  - Integrate a structured JSON logger like `pino` or `winston` for production logs.
  - Set up Sentry or Datadog for exception tracking and error alerts.

### 4.2 Redis Caching
- **Status:** Pending
- **Tasks:**
  - Cache high-traffic read-heavy endpoints (e.g. Category tree, Featured Products, Home page banners).
  - Cache invalidation hooks on product/category creation or modification.

### 4.3 Database Optimization
- **Status:** Basic indexes configured
- **Tasks:**
  - Compound indexes for frequent queries (e.g., `category + price`, `user + status`).
  - Text search index on product titles and descriptions.
  - Scheduled backups and automated health ping for MongoDB connection.

### 4.4 Automated Testing & CI/CD
- **Status:** Pending
- **Tasks:**
  - Unit tests with Jest / Vitest for middleware, token generation, and validation.
  - Integration tests with Supertest against test MongoDB database.
  - GitHub Actions CI workflow to run linter, typecheck/syntax check, and tests on push.
