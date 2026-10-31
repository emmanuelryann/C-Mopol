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
- **Status:** Basic CRUD, search, active filtering & admin routes implemented; Image uploads deferred
- **Tasks:**
  - Media upload integration (Cloudinary or AWS S3) for product galleries.
  - Low-stock alerts and threshold notifications.
  - **Monetary Precision / Integer Currency:** Store product prices as integers in the smallest currency unit (e.g., pesewas/cents/kobo) instead of floating-point numbers to prevent binary float rounding errors (`0.1 + 0.2 !== 0.3`).
  - **Category-Product Cascading State:** Currently, public product queries dynamically exclude products assigned to inactive categories. As a future enhancement, consider optional automatic cascading: deactivating a category could prompt whether to deactivate all its associated products in the database.

### 2.2 Category Hierarchy
- **Status:** Basic CRUD, parent hierarchy, cycle prevention & admin routes implemented
- **Tasks:**
  - Category tree endpoints (`/api/v1/categories/tree`) returning fully assembled nested JSON trees for frontend navigation menus.
  - **Product Reassignment Helper:** Since category deletion is strictly blocked when referenced by active OR archived products, provide a bulk reassignment endpoint (`PATCH /api/v1/categories/:id/reassign-products`) to move all products to a new category before deleting.

### 2.3 Cart & Guest Cart Synchronization
- **Status:** Authenticated cart CRUD, stock validation, stale item detection & case-insensitive ID handling implemented; Guest cart merge pending
- **Tasks:**
  - Authenticated cart CRUD (`/api/v1/cart`) with server-side pricing and inventory checks.
  - Case-insensitive ObjectId normalization in Joi validation and route parameters to prevent duplicate items.
  - Support for guest cart merging: when a guest user logs in, merge their local cart items into their database cart.
  - Cart abandonment tracking / reminders for marketing automations.

### 2.4 Checkout, Orders & Pricing Snapshots
- **Status:** Implemented — transactional checkout, atomic `$inc` stock, order status state machine, admin order management, atomic customer cancellation with stock restoration
- **Tasks:**
  - **Auto-Cancel Unpaid Orders & Stock Release:** Orders paid by card, mobile money, or bank transfer remain `pending` with stock held until payment confirmation. Implement a scheduled cron job or TTL worker to automatically cancel orders and restore stock if payment is not completed within a time window (e.g., 30–60 minutes).
  - **Shipping Fee Calculator:** Currently hardcoded to 0. Integrate a shipping cost calculator based on address, weight, or flat rates.
  - **Tax Engine:** Currently hardcoded to 0. Integrate tax calculation based on jurisdiction/product type.
  - **Discount / Coupon System:** Apply promo codes or cart-level discounts at checkout, validated and computed server-side.
  - **Order Confirmation Emails:** Send order receipt to customer after successful checkout (depends on email service integration).
  - **Shipping Tracking:** Add `trackingNumber` and `carrier` fields; allow admin to attach tracking info when marking as shipped.
  - **Returns & Refunds:** Customer-initiated return requests with approval workflow and stock restoration.

### 2.5 Payment Gateway Integration & Live Transition Guide
- **Status:** **Architecture & Mock Phase Implemented** — Pluggable provider service layer (`src/services/paymentService.js`), hardened `Payment` model (`src/models/payment.js`), server-side payment initialization (`POST /initialize`), server-to-server verification (`GET /verify/:reference`), HMAC-SHA512 webhook signature verification with raw request body capture (`POST /webhook`), idempotency protections, and customer/admin payment query endpoints.
- **Current Mode:** Runs in mock mode out of the box when `PAYSTACK_SECRET_KEY` is dummy or missing, allowing full local end-to-end development without live credentials.

#### Transition Checklist: Activating Live Paystack

When ready to switch from dummy/mock mode to live Paystack processing:

1. **Environment Variables Configuration:**
   Add live (or test) credentials to your production `.env` file:
   ```env
   PAYSTACK_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PAYSTACK_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PAYSTACK_BASE_URL=https://api.paystack.co
   PAYMENT_CURRENCY=GHS
   MOCK_PAYMENT=false
   FRONTEND_URL=https://yourstore.com
   ```
   *(For development/staging testing before launch, use test keys `sk_test_...` and `pk_test_...`)*

2. **Paystack Dashboard Webhook & Callback Setup:**
   - Log in to your [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks**.
   - Set **Live Webhook URL** to: `https://api.yourstore.com/api/v1/payments/webhook`.
   - Set **Live Callback URL** to: `https://yourstore.com/checkout/payment/callback`.
   - Ensure the secret key in the dashboard matches `PAYSTACK_SECRET_KEY` in `.env` so HMAC-SHA512 validation succeeds.

3. **Frontend Integration Flow:**
   - **Step 1:** Customer clicks "Pay Now" on the checkout page. The frontend sends `POST /api/v1/payments/initialize` with `{ orderId }`.
   - **Step 2:** The backend returns `{ reference, authorizationUrl, accessCode }`.
   - **Step 3:** The frontend redirects the customer to `authorizationUrl` (or opens the Paystack Popup Modal using the `accessCode` and `PAYSTACK_PUBLIC_KEY` with Paystack Inline JS).
   - **Step 4:** Once payment is made, Paystack redirects back to `callback_url?reference=...`.
   - **Step 5:** The frontend landing page extracts `reference` from the URL and calls `GET /api/v1/payments/verify/:reference` to confirm payment with the server.
   - **Step 6:** The backend verifies with Paystack's server API, updates `Payment` and `Order` atomically, and returns the confirmed order.
   - **Step 7:** Paystack's asynchronous webhook (`POST /api/v1/payments/webhook`) also delivers `charge.success` as a redundant fallback in case the customer closes their browser before returning.

4. **Security & Production Hardening:**
   - **Never trust client-submitted amounts:** Payment amount is computed strictly on the backend from `order.totalAmount` and converted to the smallest currency unit (pesewas/kobo: amount * 100).
   - **IP Whitelisting:** Paystack delivers webhooks from the following IP addresses. If behind a firewall or Cloudflare, whitelist:
     - `52.31.139.75`
     - `52.214.14.220`
     - `52.49.173.169`
   - **Idempotency Guarantee:** Duplicate webhook deliveries are guarded by atomic conditional queries (`Payment.findOneAndUpdate({ _id, status: { $in: ['pending', 'abandoned', 'failed'] } })`) and the `processedWebhooks` event log.
   - **Reconciliation for Cancelled Orders & Delayed Payments:** If a customer pays late for an order that was already cancelled, or pays an older session after generating a new one, the atomic handler records the payment as completed but purposefully does NOT mark the cancelled order as paid or processing. These transactions are surfaced in the admin reconciliation endpoint (`GET /api/v1/payments/admin/reconciliation`) for manual or automated refunding via the payment gateway.

5. **Future Payment Enhancements:**
   - **Multi-Gateway Support:** Implement Stripe and Flutterwave adapters conforming to the `PaymentService` interface.
   - **Saved Cards / Tokenized Subscriptions:** Support Paystack customer authorization codes for one-click re-orders.

### 2.6 Automated Refund Engine & Lifecycle Logic
- **Status:** Architecture Planned & Documented; Reconciliation Queue Implemented (`GET /api/v1/payments/admin/reconciliation`)
- **Description:** A robust, end-to-end refund workflow supporting administrative refunds for cancelled orders, duplicate payments, and returned goods via payment gateway APIs (e.g. Paystack, Stripe).

#### 1. Trigger Scenarios
1. **Reconciliation Refunds (Unfulfillable Payments):**
   - Customer paid for an order that was cancelled prior to payment completion (e.g., checkout session timed out or admin cancelled).
   - Customer paid multiple sessions for the same order (e.g., after `forceNew: true`), creating duplicate completed payments.
   - *These transactions appear automatically in `GET /api/v1/payments/admin/reconciliation`.*
2. **Order Return / Damaged Goods:**
   - Customer requests a return or refund for an active/delivered order approved by store administrators.
3. **Partial Order Refunds:**
   - Refunding specific out-of-stock items while fulfilling the remainder of the order.

#### 2. Data Model Schema Updates
Update `Payment` and `Order` schemas to record granular refund history:

```javascript
// src/models/payment.js enhancement
const refundEntrySchema = new mongoose.Schema(
  {
    refundId: { type: String, trim: true },          // Gateway refund ID (e.g. Paystack 'rf_...')
    amount: { type: Number, required: true, min: 0 }, // In standard currency unit
    currency: { type: String, default: 'GHS' },
    reason: { type: String, required: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
    },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, select: false },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

// Add to paymentSchema:
amountRefunded: { type: Number, default: 0, min: 0 },
refundStatus: {
  type: String,
  enum: ['none', 'partial', 'full'],
  default: 'none',
},
refunds: [refundEntrySchema],
```

#### 3. Administrative Refund Endpoint Specification
- **Route:** `POST /api/v1/payments/:id/refund`
- **Access:** Authenticated + Authorized Admin (`authenticate`, `authorize('admin')`)
- **Validation Schema (Joi):**
  ```javascript
  const processRefundSchema = Joi.object({
    amount: Joi.number().min(0.01).required(),
    reason: Joi.string().trim().min(3).max(500).required(),
    merchantNote: Joi.string().trim().max(250).allow(''),
  });
  ```
- **Execution & Invariant Rules:**
  1. Payment must be in `completed` status.
  2. Prevent over-refunding: Ensure `amount <= (payment.amount - payment.amountRefunded)`.
  3. Prevent duplicate concurrent requests using atomic operations or distributed locks.
  4. Call provider service: `paymentService.createRefund({ reference, amount, currency, reason, merchantNote })`.

#### 4. Payment Provider (Paystack) Integration
When calling Paystack's Refund API:
```javascript
// POST https://api.paystack.co/refund
// Headers: Authorization: Bearer {PAYSTACK_SECRET_KEY}
const payload = {
  transaction: payment.transactionId || payment.reference,
  amount: Math.round(refundAmount * 100), // convert to pesewas/kobo
  currency: payment.currency,
  merchant_note: merchantNote || reason,
  customer_note: `Refund for order ${order.orderNumber}: ${reason}`,
};
```
*Note: Paystack refunds are processed asynchronously by issuing banks (typically taking 1–5 business days).*

#### 5. Webhook Events Handling
Add handlers in `POST /api/v1/payments/webhook`:
- **`refund.processed`:**
  - Locate `Payment` by `data.transaction_reference` or `data.refund_reference`.
  - Atomically update subdocument in `refunds` array to `status: 'processed'`.
  - Increment `amountRefunded` by `data.amount / 100`.
  - If `amountRefunded >= payment.amount`:
    - Set `Payment.status = 'refunded'` and `Payment.refundStatus = 'full'`.
    - Set `Order.paymentStatus = 'refunded'`.
  - Else:
    - Set `Payment.refundStatus = 'partial'`.
- **`refund.failed`:**
  - Mark subdocument status to `'failed'`, log provider error note, and alert administration.

#### 6. Inventory & Stock Policies for Refunds
- **Rule for Cancelled / Failed Orders:** Stock was **already restored** at the moment the order was marked `cancelled` or `failed`. Therefore, issuing a refund for an order in `cancelled` status must **NEVER** increment inventory stock again.
- **Rule for Active / Delivered Orders (Returns):** If refunding an active or delivered order, stock restoration should be an explicit opt-in boolean (`restoreStock: true/false`) depending on whether items were verified as returned in resalable condition.

---

### 2.7 Address Book
- **Status:** Implemented — full CRUD with default address management
- **Tasks:**
  - Separate default shipping and default billing addresses.
  - Address validation via third-party geocoding API.

---

## 3. Administration & Back-Office

### 3.1 Admin Dashboard & Inventory
- **Status:** Implemented — dashboard statistics, inventory monitoring with stock level filtering and valuation
- **Tasks:**
  - Dashboard widgets for revenue by time period (daily/weekly/monthly charts).
  - Configurable low-stock threshold (currently hardcoded to 10 units).
  - Low-stock email/webhook alerts.
  - Bulk product status updates and bulk price/inventory adjustments.

### 3.2 Admin User Management
- **Status:** Implemented — list, view (with order stats), update role/status, session invalidation on suspend/delete
- **Tasks:**
  - Admin audit log (who changed what and when).
  - Bulk user status updates.

### 3.3 Order & Payment Management
- **Status:** Implemented — admin order listing/detail/status updates (in order routes), payment status updates (in admin routes)
- **Tasks:**
  - Bulk order status updates and tracking number assignment.
  - Issue refunds via payment gateway API.
  - Order export (CSV/PDF).

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

### 4.3 Database Optimization & Environment Requirements
- **Status:** Basic indexes configured
- **Tasks:**
  - **Replica Set for Multi-Document Transactions:** MongoDB transactions (used in checkout) require a replica set member. MongoDB Atlas supports this by default. For local development with a standalone `mongod`, initialize a single-node replica set (`mongod --replSet rs0` followed by `rs.initiate()`) or connect to Atlas.
  - Compound indexes for frequent queries (e.g., `category + price`, `user + status`).
  - Text search index on product titles and descriptions.
  - Scheduled backups and automated health ping for MongoDB connection.

### 4.4 Automated Testing & CI/CD
- **Status:** Pending
- **Tasks:**
  - Unit tests with Jest / Vitest for middleware, token generation, and validation.
  - Integration tests with Supertest against test MongoDB database.
  - GitHub Actions CI workflow to run linter, typecheck/syntax check, and tests on push.
