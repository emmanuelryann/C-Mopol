# C-Mopol E-Commerce Backend: Testing & Review Guide

This guide is a comprehensive, step-by-step testing manual and architectural review for all backend logic implemented in the **C-Mopol** REST API. Use this document with Postman, Insomnia, Thunder Client, or cURL to systematically verify every module, edge case, and security safeguard before integrating the frontend.

---

## Table of Contents
1. [Environment Setup & Prerequisites](#1-environment-setup--prerequisites)
2. [Quick Reference: Base URL & Auth Tokens](#2-quick-reference-base-url--auth-tokens)
3. [Phase 1: Authentication & User Profile](#phase-1-authentication--user-profile)
4. [Phase 2: Categories Management](#phase-2-categories-management)
5. [Phase 3: Products Catalog & Inventory](#phase-3-products-catalog--inventory)
6. [Phase 4: Customer Address Book](#phase-4-customer-address-book)
7. [Phase 5: Shopping Cart Engine](#phase-5-shopping-cart-engine)
8. [Phase 6: Checkout & Order Lifecycle](#phase-6-checkout--order-lifecycle)
9. [Phase 7: Administration & Back-Office](#phase-7-administration--back-office)
10. [Phase 8: Payment Gateway & Webhook Engine](#phase-8-payment-gateway--webhook-engine)
11. [Webhook Signature Generator Helper](#11-webhook-signature-generator-helper)
12. [Pre-Frontend Launch Checklist](#12-pre-frontend-launch-checklist)

---

## 1. Environment Setup & Prerequisites

### 1.1 Configuration (`.env`)
Ensure your `.env` file in the root folder contains the following keys:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/c-mopol
CORS_ORIGIN=http://localhost:3000
ACCESS_TOKEN_SECRET=your_super_secret_access_jwt_key_here
REFRESH_TOKEN_SECRET=your_super_secret_refresh_jwt_key_here

# Payment Gateway (Mock Mode Active)
PAYSTACK_SECRET_KEY=dummy_paystack_secret_key
PAYSTACK_PUBLIC_KEY=dummy_paystack_public_key
PAYSTACK_BASE_URL=https://api.paystack.co
PAYMENT_CURRENCY=GHS
MOCK_PAYMENT=true
FRONTEND_URL=http://localhost:3000
```

> [!IMPORTANT]
> **MongoDB Replica Set Requirement for Checkout Transactions**:
> The checkout endpoint ([`POST /api/v1/orders/checkout`](file:///Users/mac/Desktop/Projects/C-Mopol/src/routes/order.js#L210)) uses multi-document transactions to guarantee atomic stock decrements.
> - **MongoDB Atlas**: Transactions work out of the box.
> - **Local MongoDB (`mongod`)**: If you see *"Transaction numbers are only allowed on a replica set member"*, run local Mongo as a single-node replica set:
>   ```bash
>   mongod --replSet rs0 --dbpath /path/to/data
>   # In mongosh:
>   rs.initiate()
>   ```

### 1.2 Start the Server
```bash
npm run dev
# Expected console output:
# ⚠️  Payment service running in MOCK mode.
# ✅ MongoDB connected: 127.0.0.1
# 🚀 Server running in development mode on port 5000
```

---

## 2. Quick Reference: Base URL & Auth Tokens

- **Base URL:** `http://localhost:5000/api/v1`
- **Customer Auth Header:** `Authorization: Bearer <CUSTOMER_ACCESS_TOKEN>`
- **Admin Auth Header:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
- **Refresh Token:** Automatically managed via HTTP-Only cookie `refreshToken`.

---

## Phase 1: Authentication & User Profile

### 1. Register Customer✅
- **Endpoint:** `POST /api/v1/auth/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "customer@example.com",
    "password": "Password123!",
    "phone": "+233201234567"
  }
  ```
- **Expected Status:** `201 Created`
- **Response Verification:**
  - Returns user object without `password` or `refreshToken`.
  - Sets HTTP-Only cookie `refreshToken`.
  - `role` must be `'customer'` (customers cannot self-assign `'admin'`).
- **Edge Cases:**
  - Send existing email -> `409 Conflict` (*"User already exists with this email"*).✅
  - Send invalid email format (e.g. `"not-an-email"`) -> `400 Bad Request` (*"\"email\" must be a valid email"*).✅
  - Send weak password (< 8 chars) -> `400 Bad Request` (*"\"password\" length must be at least 8 characters long"*).✅
  - Missing required fields (e.g. omit `firstName`, `lastName`, `email`, or `password`) -> `400 Bad Request`.✅
  - First name or last name under 2 chars -> `400 Bad Request`.✅

### 2. Register Admin User
- *Note:* Register a second user (e.g. `admin@example.com`) and manually update their `role: "admin"` in MongoDB (`db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })`), or use an existing admin.

### 3. Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "Password123!"
  }
  ```
- **Expected Status:** `200 OK`
- **Response:** `{ success: true, data: { user, accessToken } }`
- **Edge Cases:**
  - Invalid password -> `401 Unauthorized` ("Invalid email or password.").✅
  - Invalid email format -> `400 Bad Request` (*"\"email\" must be a valid email"*).✅
  - Missing email or password -> `400 Bad Request`.✅
  - Non-existent user email -> `401 Unauthorized` ("Invalid email or password.).✅
  - Suspended/deleted account -> `403 Forbidden`.

### 4. Refresh Access Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Auth:** None (Cookie based)
- **Expected Status:** `200 OK`
- **Verification:** Returns a brand-new `accessToken`.✅
- **Edge Cases:**
  - Missing `refreshToken` cookie -> `401 Unauthorized`.✅
  - Invalid or expired `refreshToken` cookie -> `401 Unauthorized`.✅

### 5. Profile & Password Changes
- `GET /api/v1/auth/me` (Auth required) -> `200 OK` with user details.
- `POST /api/v1/auth/logout` -> Clears HTTP-Only cookies and deletes active session from DB.✅
- `POST /api/v1/auth/change-password` -> Change password for logged-in user.
- **Edge Cases:**
  - `POST /change-password`: Missing `currentPassword` or `newPassword` -> `400 Bad Request`.
  - `POST /change-password`: `newPassword` under 8 chars -> `400 Bad Request`.
  - `POST /change-password`: Incorrect `currentPassword` -> `400 Bad Request` (*"Current password is incorrect."*).
  - `POST /change-password`: `newPassword` same as `currentPassword` -> `400 Bad Request` (*"New password cannot be the same as current password."*).
  - **Password Change Session Revocation:** Changing password clears **all** active sessions across all devices and clears cookies. The user must log in again with the new password.

### 6. Session Management & Multi-Device Control
- **Database Model:** `Session` collection (`user`, `refreshTokenHash`, `deviceId`, `userAgent`, `ipAddress`, `lastActiveAt`, `expiresAt`).
- **Endpoint:** `GET /api/v1/auth/sessions`
  - **Auth:** Customer or Admin
  - **Expected Status:** `200 OK`
  - **Response:** Returns list of active sessions with `userAgent`, `ipAddress`, `lastActiveAt`, and `isCurrent: true/false`.
- **Endpoint:** `DELETE /api/v1/auth/sessions/:sessionId`
  - **Auth:** Customer or Admin (session owner)
  - **Expected Status:** `200 OK`
  - **Verification:** Deletes the specified remote session from DB. The revoked device immediately receives `401 Unauthorized` (*"Session has been revoked. Please log in again."*) on its next request.
- **Session Rules & Multi-Device Enforcement Tests:**
  1. **Same-Device Single Session Rule:**
     - Log in on Browser 1 (e.g. Chrome on Mac).
     - Log in on Browser 2 or new tab on the same device (e.g. Firefox on Mac or passing same `x-device-id`).
     - **Verification:** Only **one** session exists for that device in the DB. The old Browser 1 session is superseded and immediately revoked (`401 Unauthorized`).
  2. **Two Devices Allowed (Max 2 Total Sessions):**
     - Log in on Device 1 (e.g. Laptop).
     - Log in on Device 2 (e.g. Mobile phone with mobile User-Agent or `x-device-id: phone-1`).
     - **Verification:** Both devices are active simultaneously (`Session.countDocuments` = 2). Both can access authenticated routes.
  3. **Third Device Blocked (Session Cap Enforced):**
     - Try logging in on Device 3 (e.g. Work PC with `x-device-id: pc-3`).
     - **Expected Status:** `403 Forbidden` (*"Maximum active sessions reached (2). Please log out from another device first."*).
  4. **Revocation & Re-Login Slot Recovery:**
     - From Device 1, call `DELETE /api/v1/auth/sessions/:phoneSessionId` to revoke Device 2 (or log out from Device 2).
     - Try logging in on Device 3 again.
     - **Expected Status:** `200 OK` — Device 3 logs in successfully!
  5. **Admin Suspension / Deletion Cascade:**
     - When admin suspends or deletes a user via `PATCH /api/v1/admin/users/:id`, all active sessions for that user are immediately deleted from the database.
- **Edge Cases:**
  - `DELETE /sessions/:sessionId`: Invalid session ID format -> `400 Bad Request` (*"Invalid session ID."*).
  - `DELETE /sessions/:sessionId`: Attempting to revoke own current session -> `400 Bad Request` (*"Cannot revoke your current session. Use the logout endpoint instead."*).
  - `DELETE /sessions/:sessionId`: Non-existent session ID -> `404 Not Found` (*"Session not found."*).
  - Accessing with a revoked session token -> `401 Unauthorized` (*"Session has been revoked. Please log in again."*).

---

## Phase 2: Categories Management

### 1. Admin Create Category
- **Endpoint:** `POST /api/v1/categories`
- **Auth:** Admin
- **Request Body:**
  ```json
  {
    "name": "Electronics",
    "slug": "electronics",
    "description": "Gadgets, devices, and accessories"
  }
  ```
- **Expected Status:** `201 Created`
- **Edge Cases:**
  - Missing `name` or `slug` -> `400 Bad Request`.
  - Invalid parent ObjectId format (e.g. `"123-bad"`) -> `400 Bad Request` (*"\"parent\" fails to match the ObjectId pattern"*).
  - Duplicate slug -> `409 Conflict`.
  - Non-admin authorization token -> `403 Forbidden`.

### 2. Category Hierarchy & Parent Cycle Prevention
- Create child category:
  ```json
  {
    "name": "Laptops",
    "slug": "laptops",
    "parent": "<ELECTRONICS_ID>"
  }
  ```
- **Edge Cases:**
  - Try updating `Electronics` to have `parent: "<LAPTOPS_ID>"` -> `400 Bad Request` (*"A category cannot be its own descendant."*).
  - `PATCH /categories/:id`: Empty payload `{}` -> `400 Bad Request` (*"\"value\" must have at least 1 key"*).
  - Invalid category ID in URL param -> `400 Bad Request` (*"Invalid category ID"*).

### 3. Public Category Listing & Tree
- **Endpoint:** `GET /api/v1/categories` (Public)
  - Returns active categories with populated parent.
- **Endpoint:** `GET /api/v1/categories/:id` or `/api/v1/categories/electronics` -> `200 OK`.

### 4. Archive, Restore & Safe Deletion
- `PATCH /api/v1/categories/:id/archive` -> Sets `isActive: false`.
- `PATCH /api/v1/categories/:id/restore` -> Restores `isActive: true`.
- `DELETE /api/v1/categories/:id`:
- **Edge Cases:**
  - Try deleting a category that has products -> `400 Bad Request` (*"Cannot delete category that contains products"*).
  - Deleting, archiving, or restoring with invalid ID param -> `400 Bad Request`.

---

## Phase 3: Products Catalog & Inventory

### 1. Admin Create Product
- **Endpoint:** `POST /api/v1/products`
- **Auth:** Admin
- **Request Body:**
  ```json
  {
    "name": "Pro Gaming Laptop 15",
    "slug": "pro-gaming-laptop-15",
    "description": "High performance gaming laptop",
    "price": 1499.99,
    "compareAtPrice": 1699.99,
    "category": "<LAPTOPS_CATEGORY_ID>",
    "stock": 25,
    "sku": "LAP-PG15-001",
    "images": ["https://images.unsplash.com/photo-1593642632823-8f785ba67e45"]
  }
  ```
- **Expected Status:** `201 Created`
- **Edge Cases:**
  - Missing required fields (e.g. omit `name`, `price`, or `category`) -> `400 Bad Request`.
  - Negative price (`price: -10`) -> `400 Bad Request` (*"\"price\" must be greater than or equal to 0"*).
  - Negative or non-integer stock (`stock: -5` or `stock: 2.5`) -> `400 Bad Request`.
  - Invalid category ObjectId format -> `400 Bad Request` (*"\"category\" fails to match the ObjectId pattern"*).
  - Non-existent category ID -> `404 Not Found` (*"Category not found"*).

### 2. Public Catalog Filtering & Active Category Protection
- **Endpoint:** `GET /api/v1/products`
  - Supports query params: `?category=<ID>&minPrice=100&maxPrice=2000&inStock=true&sort=-price&page=1&limit=10`.
- **Critical Invariant Verification:**
  - Archive the parent category: `PATCH /api/v1/categories/:id/archive`.
  - Query public products: `GET /api/v1/products`.
  - **Result:** The laptop product must **NOT** appear in public catalog results while its category is inactive.

### 3. Archive & Restore Validation
- `PATCH /api/v1/products/:id/archive` -> Product archived.
- `PATCH /api/v1/products/:id/restore` -> Product restored.
- **Edge Cases:**
  - Try restoring product whose category is archived -> `400 Bad Request` (*"Cannot restore a product in an inactive category."*).
  - `PATCH /api/v1/products/:id` (General update): Cannot send `{ "isActive": true }` to bypass category check (enforces dedicated `/restore` route).
  - `PATCH /api/v1/products/:id`: Empty update payload `{}` -> `400 Bad Request` (*"\"value\" must have at least 1 key"*).
  - `PATCH /api/v1/products/:id`: Update with negative price or negative stock -> `400 Bad Request`.

### 4. Public Product Search
- `GET /api/v1/products/search?q=gaming` -> Case-insensitive search on name/description.

---

## Phase 4: Customer Address Book

### 1. Create Addresses
- **Endpoint:** `POST /api/v1/addresses`
- **Auth:** Customer
- **Request Body:**
  ```json
  {
    "label": "home",
    "fullName": "John Doe",
    "phone": "+233201234567",
    "addressLine1": "123 Independence Ave",
    "addressLine2": "Apartment 4B",
    "city": "Accra",
    "state": "Greater Accra",
    "postalCode": "GA-123-4567",
    "country": "Ghana",
    "isDefault": true
  }
  ```
- **Expected Status:** `201 Created`
- **Edge Cases:**
  - Missing required fields (e.g. omit `fullName`, `phone`, `addressLine1`, `city`, `country`) -> `400 Bad Request`.
  - Invalid label value (e.g. `"label": "office"`) -> `400 Bad Request` (*"\"label\" must be one of [home, work, other]"*).

### 2. Default Address Auto-Switching
- Create a second address with `"isDefault": true`.
- **Verification:** The first address automatically has `isDefault` switched to `false`.
- `PATCH /api/v1/addresses/:id/default` -> Makes specific address default.
- **Edge Cases:**
  - `PATCH /api/v1/addresses/:id`: Empty payload `{}` -> `400 Bad Request` (*"\"value\" must have at least 1 key"*).
  - Accessing or modifying address belonging to another user -> `404 Not Found`.
  - Invalid address ObjectId format in URL param -> `400 Bad Request`.

---

## Phase 5: Shopping Cart Engine

### 1. Add Product to Cart
- **Endpoint:** `POST /api/v1/cart/items`
- **Auth:** Customer
- **Request Body:**
  ```json
  {
    "product": "<PRODUCT_ID>",
    "quantity": 2
  }
  ```
- **Expected Status:** `200 OK`
- **Verification:**
  - Server calculates `subtotal` and `total` based strictly on DB product price.
  - Adding same item again increments quantity without creating duplicate lines.
- **Edge Cases:**
  - Missing `product` or `quantity` -> `400 Bad Request`.
  - Quantity zero or negative (`quantity: 0` or `-2`) -> `400 Bad Request` (*"\"quantity\" must be greater than or equal to 1"*).
  - Decimal quantity (`quantity: 1.5`) -> `400 Bad Request` (*"\"quantity\" must be an integer"*).
  - Invalid product ObjectId format -> `400 Bad Request`.
  - Send uppercase hex Product ID (`/^[0-9a-fA-F]{24}$/`) -> Correctly normalized and avoids duplicate items.
  - Add quantity exceeding current stock -> `400 Bad Request`.
  - Add product from an inactive category -> `400 Bad Request`.

### 2. Get Cart & Availability Status
- **Endpoint:** `GET /api/v1/cart`
- **Verification:**
  - If admin reduces product stock below cart quantity, `GET /cart` flags it in `unavailableItems`.
  - Displays accurate `subtotal`, `itemsCount`.

### 3. Update & Remove Items
- `PATCH /api/v1/cart/items/:productId` -> `{ "quantity": 3 }`.
- `DELETE /api/v1/cart/items/:productId` -> Removes single item.
- `DELETE /api/v1/cart` -> Clears entire cart.
- **Edge Cases:**
  - `PATCH /items/:productId`: Update quantity to zero or negative -> `400 Bad Request`.
  - `PATCH /items/:productId` or `DELETE /items/:productId`: Invalid `productId` in URL -> `400 Bad Request`.

---

## Phase 6: Checkout & Order Lifecycle

### 1. Checkout (Cart to Purchase)
- **Endpoint:** `POST /api/v1/orders/checkout`
- **Auth:** Customer
- **Request Body (Saved Address):**
  ```json
  {
    "addressId": "<SAVED_ADDRESS_ID>",
    "paymentMethod": "card",
    "notes": "Please deliver after 2pm"
  }
  ```
- **Or Request Body (Inline Address):**
  ```json
  {
    "shippingAddress": {
      "fullName": "Jane Doe",
      "phone": "+233241112233",
      "addressLine1": "45 Ring Road Central",
      "city": "Accra",
      "state": "Greater Accra",
      "postalCode": "GA-456-7890",
      "country": "Ghana"
    },
    "paymentMethod": "card"
  }
  ```
- **Expected Status:** `201 Created`
- **Verification Invariants:**
  - Database transaction executes atomically.
  - Product stock in DB decreases by the purchased quantity: `$inc: { stock: -quantity }`.
  - Items, prices, and address are frozen as snapshots on the `Order` record.
  - Customer's cart is automatically emptied.
  - Order has `orderNumber` format: `CMPL-YYYYMMDD-XXXXXX`.
  - `status: "pending"`, `paymentStatus: "pending"`.
- **Edge Cases:**
  - Checkout with empty cart -> `400 Bad Request`.
  - Supply both `addressId` and `shippingAddress` -> `400 Bad Request` (*"Provide either a saved address ID or a shipping address, not both."*).
  - Supply neither `addressId` nor `shippingAddress` -> `400 Bad Request` (*"Provide either a saved address ID or a shipping address, not both."*).
  - Missing or invalid `paymentMethod` (e.g. `"crypto"`) -> `400 Bad Request` (*"\"paymentMethod\" must be one of [card, mobile_money, bank_transfer, cash_on_delivery]"*).
  - Inline `shippingAddress` missing required subfields (e.g. missing `fullName` or `city`) -> `400 Bad Request`.
  - `notes` exceeding 500 characters -> `400 Bad Request`.
  - Out of stock / inactive product in cart -> `400 Bad Request` with structured item errors.

### 2. Customer Order Queries
- `GET /api/v1/orders` -> List logged-in customer's orders with pagination.
- `GET /api/v1/orders/:id` -> View single order. Non-admin users cannot view other customers' orders (`404`/`403`).

### 3. Customer Order Cancellation & Double-Cancel Prevention
- **Endpoint:** `PATCH /api/v1/orders/:id/cancel`
- **Request Body:** `{ "reason": "Changed my mind." }`
- **Expected Status:** `200 OK`
- **Verification:**
  - `status` updates to `"cancelled"`.
  - `cancelledAt` timestamp is set.
  - Product stock is atomically restored: `$inc: { stock: quantity }`.
- **Edge Cases:**
  - Cancellation `reason` exceeding 500 characters -> `400 Bad Request`.
  - Cancel non-pending order (e.g. status is `"shipped"`) -> `400 Bad Request` (*"Only pending orders can be cancelled."*).
- **Double-Click Race Test:**
  - Fire two rapid requests to `PATCH /orders/:id/cancel`.
  - **Result:** First request succeeds; second request returns `400 Bad Request` (*"Only pending orders can be cancelled."*). Stock is restored **only once**.

### 4. Admin Order Status Updates
- **Endpoint:** `PATCH /api/v1/orders/admin/:id/status`
- **Auth:** Admin
- **Request Body:** `{ "status": "processing" }`
- **State Machine Transitions:**
  - `pending` -> `processing`, `cancelled`, `failed`
  - `processing` -> `shipped`, `cancelled`
  - `shipped` -> `delivered`
- **Edge Cases:**
  - Missing `status` or invalid status enum (e.g. `"dispatched"`) -> `400 Bad Request`.
  - `cancellationReason` exceeding 500 characters -> `400 Bad Request`.
  - Illegal status transition (e.g. try moving `delivered` -> `pending`) -> `400 Bad Request` (*"Cannot transition from delivered to pending"*).
  - Transitioning to `cancelled` or `failed` restores inventory stock automatically.

---

## Phase 7: Administration & Back-Office

### 1. Dashboard Statistics
- **Endpoint:** `GET /api/v1/admin/dashboard`
- **Auth:** Admin
- **Expected Status:** `200 OK`
- **Verification:**
  - `revenue.total`: Adds up **only** orders with `paymentStatus: 'completed'`. Unpaid pending orders are not counted as revenue.
  - Returns counts for users, products (active vs archived), low-stock alert count (`stock <= 10`), out-of-stock count, and recent 5 orders.
- **Edge Cases:**
  - Non-admin authorization token -> `403 Forbidden`.

### 2. User Management & Self-Lockout Protection
- **Endpoint:** `GET /api/v1/admin/users?search=John&role=customer&status=active`
  - **Special Character Search Test:** Search for `(` or `+` or `[` -> Escapes regex characters safely without 500 crashes.
- **Endpoint:** `GET /api/v1/admin/users/:id`
  - Returns customer profile and lifetime order stats. `totalSpent` excludes cancelled/failed orders.
- **Endpoint:** `PATCH /api/v1/admin/users/:id`
  - Update `role` or `status` (`active`, `suspended`, `deleted`).
  - **Self-Edit Protection Test:** Log in as admin and try modifying your own role/status -> `400 Bad Request` (*"Admins cannot modify their own status or role."*). Handles uppercase/lowercase ID matching.
  - Suspending or deleting a user automatically clears their refresh token, invalidating active sessions.
- **Edge Cases:**
  - Empty update payload `{}` -> `400 Bad Request` (*"\"value\" must have at least 1 key"*).
  - Invalid `role` enum (e.g. `"superuser"`) -> `400 Bad Request` (*"\"role\" must be one of [customer, admin]"*).
  - Invalid `status` enum (e.g. `"banned"`) -> `400 Bad Request` (*"\"status\" must be one of [active, suspended, deleted]"*).
  - Invalid user ObjectId format in URL param -> `400 Bad Request` (*"Invalid user ID."*).
  - Non-existent user ID -> `404 Not Found` (*"User not found."*).

### 3. Inventory Monitoring
- **Endpoint:** `GET /api/v1/admin/inventory?status=low_stock`
  - Returns items with populated category, SKU, stock count, and total inventory valuation.
- **Edge Cases:**
  - Non-admin authorization token -> `403 Forbidden`.

### 4. Manual Payment Status Update
- **Endpoint:** `PATCH /api/v1/admin/orders/:id/payment`
- **Auth:** Admin
- **Request Body:** `{ "paymentStatus": "completed" }`
- **Verification:**
  - Allowed transitions: `pending` -> `completed`/`failed`; `failed` -> `pending`/`completed`; `completed` -> `refunded`.
  - **Gateway Rule:** Cannot mark an online order as completed manually; only orders with `paymentMethod === 'cash_on_delivery'` or `'bank_transfer'` can be manually completed.
  - Cannot mark a cancelled or failed order as paid -> `400 Bad Request`.
- **Edge Cases:**
  - Missing `paymentStatus` in request body -> `400 Bad Request` (*"\"paymentStatus\" is required"*).
  - Invalid `paymentStatus` enum (e.g. `"reversed"`) -> `400 Bad Request` (*"\"paymentStatus\" must be one of [pending, completed, failed, refunded]"*).
  - Invalid order ObjectId format in URL param -> `400 Bad Request` (*"Invalid order ID."*).
  - Non-existent order ID -> `404 Not Found` (*"Order not found."*).

---

## Phase 8: Payment Gateway & Webhook Engine

The payment module runs with mock provider simulation in development, complete with cryptographic HMAC-SHA512 webhook verification, duplicate protection, and reconciliation.

### 1. Initialize Payment
- **Endpoint:** `POST /api/v1/payments/initialize`
- **Auth:** Customer (or Admin)
- **Request Body:**
  ```json
  {
    "orderId": "<PENDING_ORDER_ID>",
    "callbackUrl": "http://localhost:3000/checkout/payment/callback"
  }
  ```
- **Expected Status:** `201 Created`
- **Response Verification:**
  - Returns `{ reference, authorizationUrl, accessCode, amount, currency }`.
  - Payment amount is strictly derived from `order.totalAmount` on the server.
- **Edge Cases:**
  - Missing `orderId` -> `400 Bad Request` (*"\"orderId\" is required"*).
  - Invalid `orderId` ObjectId format -> `400 Bad Request` (*"\"orderId\" fails to match the ObjectId pattern"*).
  - Invalid `callbackUrl` URI format (e.g. `"not-a-url"`) -> `400 Bad Request` (*"\"callbackUrl\" must be a valid uri"*).
  - Initializing payment for already paid order (`paymentStatus: 'completed'`) -> `400 Bad Request` (*"This order has already been paid for."*).
  - Initializing payment for cancelled/failed order -> `400 Bad Request` (*"Cannot pay for a cancelled order."*).
  - Initializing payment for another customer's order -> `403 Forbidden` (*"Not authorized to access this order."*).
- **Security & Concurrency Tests:**
  1. **COD Check:** Try initializing payment for an order with `paymentMethod: "cash_on_delivery"` -> `400 Bad Request` (*"Cash on delivery orders cannot be paid online."*).
  2. **Callback URL Origin Check:** Try sending `"callbackUrl": "https://localhost:3000.evil.com"` -> `400 Bad Request` (*"Invalid callback URL."*).
  3. **Duplicate Prevention (Double-Click):**
     - Fire two simultaneous initialize requests.
     - The second request is blocked by MongoDB partial unique index `order_pending_unique` -> Returns `409 Conflict`.
  4. **Active Session Reuse:** Send another initialize request within 30 minutes without `forceNew` -> Returns existing active reference rather than charging twice.

### 2. Verify Payment (Server-to-Server Gateway Check)
- **Endpoint:** `GET /api/v1/payments/verify/:reference`
- **Auth:** Customer (owns the payment) or Admin
- **Rate Limit:** 30 requests/minute per IP (`429 Too Many Requests` if exceeded).
- **Test Scenarios:**
  - **Standard Reference (Success):**
    - Call `GET /api/v1/payments/verify/CMPL_PAY_...`
    - Gateway confirms approval -> `Payment.status` transitions to `completed`, `Order.paymentStatus` transitions to `completed`, and pending order advances to `processing`.
  - **Simulated Decline:**
    - Initialize with a reference containing `FAIL` (or mock decline) -> `Payment.status` transitions to `failed`, `Order.paymentStatus` transitions to `failed`.
  - **Simulated Abandonment:**
    - Reference containing `ABANDON` -> `Payment.status` transitions to `abandoned`.
  - **Late Payment / Retry Recovery:**
    - If a payment is initially marked `abandoned` or `failed` and then customer succeeds on retry, `/verify` transitions `status: { $in: ['pending', 'abandoned', 'failed'] }` to `completed` and marks the order paid!
- **Edge Cases:**
  - Missing or whitespace-only reference in URL param -> `400 Bad Request` (*"Payment reference is required."*).
  - Non-existent payment reference -> `404 Not Found` (*"Payment reference not found."*).
  - Customer attempts to verify another customer's payment -> `403 Forbidden` (*"Not authorized to access this payment."*).
  - Amount or currency mismatch between gateway response and stored payment -> `400 Bad Request` (*"Payment amount or currency mismatch detected. Please contact support."*).

### 3. Webhook Simulation (`POST /api/v1/payments/webhook`)
- **Endpoint:** `POST /api/v1/payments/webhook`
- **Auth:** Public (Signature Verified via `x-paystack-signature` header)
- **Raw Body Preserved:** Uses `req.rawBody` for cryptographic signature validation.

#### A. Webhook Signature Validation Test
- Send request with header `x-paystack-signature: invalid_signature` -> `401 Unauthorized` (*"Invalid webhook signature."*).
- Send request without `x-paystack-signature` header -> `401 Unauthorized` (*"Invalid webhook signature."*).
- In development mode, header `x-paystack-signature: mock_valid_signature` is accepted.

#### B. Handle `charge.success` Event
- **Header:** `x-paystack-signature: mock_valid_signature`
- **Request Body:**
  ```json
  {
    "event": "charge.success",
    "data": {
      "id": 998877,
      "reference": "<PAYMENT_REFERENCE>",
      "amount": 299998,
      "currency": "GHS",
      "channel": "card",
      "paid_at": "2026-10-27T12:00:00.000Z"
    }
  }
  ```
- **Expected Status:** `200 OK`
- **Verification:**
  - `Payment.status` becomes `"completed"`.
  - `Order.paymentStatus` becomes `"completed"`, order status advances to `"processing"`.
  - Event `998877` is recorded in `Payment.processedWebhooks`.
  - **Idempotency Replay Test:** Send the exact same webhook payload again. Returns `200 OK` (*"Event already processed (idempotent)."*) without repeating database updates.

#### C. Strict Amount Mismatch Guard
- Send `charge.success` where `data.amount` does not match `payment.amount * 100`.
- **Result:** Payment is transitioned to `failed` (`failureReason: "Amount or currency mismatch"`). Order is **NOT** marked paid!
- **Edge Cases:**
  - Webhook payload missing `event`, `data`, or `reference` -> Ignored safely with `200 OK` (*"Ignored: Missing event or reference data."*).
  - Webhook reference does not exist in DB -> `200 OK` (*"Ignored: Payment with reference \"...\" not found."*).
  - Amount or currency mismatch in webhook payload -> Payment marked `failed`, order remains unpaid, returns `200 OK` (*"Mismatch recorded."*).

### 4. Admin Reconciliation Queue
- **Endpoint:** `GET /api/v1/payments/admin/reconciliation`
- **Auth:** Admin
- **Expected Status:** `200 OK`
- **What It Catches:**
  1. **Cancelled / Failed Orders with Paid Money:** If customer completed payment on the gateway after their order was cancelled, payment is completed but order remains cancelled. This route surfaces the payment with `reconciliationReason: "order_cancelled_or_failed"` so admin can issue a refund.
  2. **Duplicate Session Charges:** If customer paid both old and new payment sessions for the same order, flags payment with `reconciliationReason: "duplicate_completed_payment"`.
- **Edge Cases:**
  - Non-admin authorization token -> `403 Forbidden`.

---

## 11. Webhook Signature Generator Helper

When testing real HMAC-SHA512 webhook signatures locally against your development secret, run this one-line Node script to generate the exact signature:

```bash
node -e "
const crypto = require('crypto');
const secret = 'dummy_paystack_secret_key'; // from your .env
const payload = JSON.stringify({
  event: 'charge.success',
  data: {
    id: 123456,
    reference: 'CMPL_PAY_YOUR_REFERENCE_HERE',
    amount: 149999,
    currency: 'GHS',
    channel: 'card'
  }
});
const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
console.log('\nPayload:\n', payload);
console.log('\nHeader [x-paystack-signature]:\n', hash, '\n');
"
```

---

## 12. Pre-Frontend Launch Checklist

| Category | Item | Status | Verified |
| :--- | :--- | :---: | :---: |
| **Auth** | Refresh token stored in HTTP-Only Cookie | ✅ | [ ] |
| **Auth** | Password salted with bcrypt (`>= 10 rounds`) | ✅ | [ ] |
| **Auth** | Admins cannot self-edit status or self-delete | ✅ | [ ] |
| **Auth** | Same-device logins deduplicated into 1 active session | ✅ | [ ] |
| **Auth** | Multi-device logins capped at 2 sessions per user | ✅ | [ ] |
| **Auth** | Password change/reset immediately revokes all sessions | ✅ | [ ] |
| **Catalog** | Inactive category products hidden from public | ✅ | [ ] |
| **Catalog** | Category deletion blocked if products exist | ✅ | [ ] |
| **Cart** | Server recalculates subtotals; client prices ignored | ✅ | [ ] |
| **Cart** | Case-insensitive product IDs prevent duplicates | ✅ | [ ] |
| **Checkout** | Atomic stock decrement inside MongoDB transaction | ✅ | [ ] |
| **Orders** | Fast double-cancellation restores stock only once | ✅ | [ ] |
| **Orders** | Order status state machine blocks invalid moves | ✅ | [ ] |
| **Admin** | Dashboard revenue only sums `paymentStatus: 'completed'` | ✅ | [ ] |
| **Admin** | User search regex special characters safely escaped | ✅ | [ ] |
| **Payments** | Amount computed server-side from Order total | ✅ | [ ] |
| **Payments** | Duplicate payment session race returns `409 Conflict` | ✅ | [ ] |
| **Payments** | Server verification required; client success unaccepted | ✅ | [ ] |
| **Payments** | Late / retried payment recovery supported | ✅ | [ ] |
| **Payments** | Webhook HMAC-SHA512 verified on `req.rawBody` | ✅ | [ ] |
| **Payments** | Duplicate webhook deliveries handled idempotently | ✅ | [ ] |
| **Payments** | Reverse proxy headers enabled (`app.set('trust proxy', 1)`) | ✅ | [ ] |
| **Payments** | Admin reconciliation queue flags overpayments / refunds | ✅ | [ ] |
