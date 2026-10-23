import crypto from 'crypto';

/**
 * Payment Service (Paystack Integration & Provider Abstraction)
 *
 * Designed to seamlessly switch between mock/development mode and live
 * Paystack (or other gateway) provider API calls.
 */
class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'dummy_paystack_secret_key';
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || 'dummy_paystack_public_key';
    this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
    this.defaultCurrency = process.env.PAYMENT_CURRENCY || 'GHS';
  }

  /**
   * Determine whether live API calls should be made or mock responses returned.
   * If PAYSTACK_SECRET_KEY is empty, starts with 'dummy_', or MOCK_PAYMENT is 'true',
   * the service runs in mock mode.
   */
  isMockMode() {
    if (process.env.MOCK_PAYMENT === 'true') return true;
    if (!process.env.PAYSTACK_SECRET_KEY) return true;
    if (process.env.PAYSTACK_SECRET_KEY.startsWith('dummy_')) return true;
    return false;
  }

  /**
   * Generate a unique, cryptographically random payment reference.
   * Format: CMPL_PAY_<OrderNumberSafe>_<Timestamp>_<HexSuffix>
   *
   * @param {string} orderNumber
   * @returns {string}
   */
  generateReference(orderNumber = 'ORD') {
    const cleanOrderNumber = String(orderNumber).replace(/[^A-Za-z0-9]/g, '');
    const timestamp = Date.now();
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CMPL_PAY_${cleanOrderNumber}_${timestamp}_${suffix}`;
  }

  /**
   * Initialize a payment session.
   *
   * @param {Object} options
   * @param {string} options.orderId
   * @param {string} options.orderNumber
   * @param {string} options.email
   * @param {number} options.amount - In standard currency unit (e.g. 150.00 GHS)
   * @param {string} [options.currency]
   * @param {string} [options.callbackUrl]
   * @param {Object} [options.metadata]
   * @returns {Promise<{ reference: string, authorizationUrl: string, accessCode: string, isMock: boolean }>}
   */
  async initializePayment({
    orderId,
    orderNumber,
    email,
    amount,
    currency,
    callbackUrl,
    metadata = {},
  }) {
    const ref = this.generateReference(orderNumber);
    const curr = (currency || this.defaultCurrency).toUpperCase();

    // ── Mock Mode ───────────────────────────────────────────────
    if (this.isMockMode()) {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.CORS_ORIGIN ||
        'http://localhost:3000';
      const resolvedCallback =
        callbackUrl || `${frontendUrl}/checkout/payment/callback`;

      const mockAuthUrl = `${resolvedCallback}?reference=${ref}&orderId=${orderId}`;
      const mockAccessCode = `mock_access_${crypto.randomBytes(6).toString('hex')}`;

      return {
        reference: ref,
        authorizationUrl: mockAuthUrl,
        accessCode: mockAccessCode,
        isMock: true,
      };
    }

    // ── Live Paystack Mode ───────────────────────────────────────
    // Paystack requires amount in the smallest currency unit (pesewas/kobo -> amount * 100)
    const amountInSmallestUnit = Math.round(amount * 100);

    const payload = {
      email,
      amount: amountInSmallestUnit,
      currency: curr,
      reference: ref,
      callback_url: callbackUrl,
      metadata: {
        orderId: String(orderId),
        orderNumber,
        ...metadata,
      },
    };

    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (!response.ok || !body.status) {
      const error = new Error(
        body.message || 'Payment gateway initialization failed.',
      );
      error.statusCode = 502;
      error.gatewayResponse = body;
      throw error;
    }

    return {
      reference: body.data.reference || ref,
      authorizationUrl: body.data.authorization_url,
      accessCode: body.data.access_code,
      isMock: false,
    };
  }

  /**
   * Verify a transaction reference with the payment gateway.
   *
   * @param {string} reference
   * @param {number} [expectedAmount] - Expected amount in standard currency
   * @returns {Promise<{
   *   success: boolean,
   *   status: 'success' | 'failed' | 'abandoned',
   *   amount?: number,
   *   currency?: string,
   *   transactionId?: string,
   *   channel?: string,
   *   paidAt?: Date,
   *   failureReason?: string,
   *   gatewayResponse: Object,
   *   isMock: boolean
   * }>}
   */
  async verifyPayment(reference, expectedAmount) {
    // ── Mock Mode ───────────────────────────────────────────────
    if (this.isMockMode()) {
      const upperRef = String(reference).toUpperCase();

      // Test scenario: Reference containing 'FAIL' simulates card decline / failed payment
      if (upperRef.includes('FAIL')) {
        return {
          success: false,
          status: 'failed',
          failureReason: 'Transaction declined (simulated failure).',
          gatewayResponse: {
            status: 'failed',
            gateway_response: 'Card declined by issuing bank',
          },
          isMock: true,
        };
      }

      // Test scenario: Reference containing 'ABANDON' simulates customer dropping out
      if (upperRef.includes('ABANDON')) {
        return {
          success: false,
          status: 'abandoned',
          failureReason: 'Transaction abandoned by customer.',
          gatewayResponse: {
            status: 'abandoned',
            gateway_response: 'Checkout closed without payment',
          },
          isMock: true,
        };
      }

      // Default Mock: Success
      return {
        success: true,
        status: 'success',
        reference,
        amount: expectedAmount,
        currency: this.defaultCurrency,
        transactionId: `MOCK_TXN_${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        channel: 'card',
        paidAt: new Date(),
        gatewayResponse: {
          status: 'success',
          gateway_response: 'Successful (Mock Provider)',
          channel: 'card',
          paid_at: new Date().toISOString(),
        },
        isMock: true,
      };
    }

    // ── Live Paystack Mode ───────────────────────────────────────
    const response = await fetch(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      },
    );

    const body = await response.json();

    if (!response.ok || !body.status) {
      const error = new Error(
        body.message || 'Payment verification failed with provider.',
      );
      error.statusCode = 502;
      error.gatewayResponse = body;
      throw error;
    }

    const { data } = body;
    const providerStatus = (data.status || '').toLowerCase();

    // Paystack returns amount in pesewas/kobo -> divide by 100 for standard unit
    const paidAmount = typeof data.amount === 'number' ? data.amount / 100 : undefined;

    if (providerStatus === 'success') {
      return {
        success: true,
        status: 'success',
        reference: data.reference,
        amount: paidAmount,
        currency: data.currency,
        transactionId: String(data.id || data.transaction_id || ''),
        channel: data.channel || 'card',
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        gatewayResponse: data,
        isMock: false,
      };
    }

    if (providerStatus === 'abandoned') {
      return {
        success: false,
        status: 'abandoned',
        failureReason: data.gateway_response || 'Payment abandoned by customer.',
        gatewayResponse: data,
        isMock: false,
      };
    }

    return {
      success: false,
      status: 'failed',
      failureReason: data.gateway_response || 'Payment failed.',
      gatewayResponse: data,
      isMock: false,
    };
  }

  /**
   * Validate incoming webhook cryptographic signature (HMAC-SHA512).
   *
   * @param {string} signature - Header 'x-paystack-signature'
   * @param {Buffer|string} rawBody - Raw unparsed HTTP request body Buffer
   * @returns {boolean}
   */
  verifyWebhookSignature(signature, rawBody) {
    if (!signature || !rawBody) {
      return false;
    }

    // Allow mock signature in non-production environments for automated testing
    if (
      process.env.NODE_ENV !== 'production' &&
      signature === 'mock_valid_signature'
    ) {
      return true;
    }

    try {
      const computedHash = crypto
        .createHmac('sha512', this.secretKey)
        .update(rawBody)
        .digest('hex');

      const computedBuffer = Buffer.from(computedHash, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (computedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}

const paymentService = new PaymentService();

export default paymentService;
