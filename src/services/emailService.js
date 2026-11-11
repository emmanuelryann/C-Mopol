import { Resend } from 'resend';

// Default sender address (Resend provides onboarding@resend.dev for testing before domain verification)
const DEFAULT_FROM = process.env.EMAIL_FROM || 'C-Mopol <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.client = null;

    if (this.isConfigured()) {
      this.client = new Resend(this.apiKey);
    }
  }

  /**
   * Check whether a valid Resend API key is configured.
   */
  isConfigured() {
    const key = process.env.RESEND_API_KEY || this.apiKey;
    return Boolean(key && key.trim() && key.startsWith('re_') && !key.includes('your_resend_api_key'));
  }

  /**
   * Core send method that invokes Resend or logs in mock mode if API key is pending.
   */
  async send({ to, subject, html, text, from = DEFAULT_FROM }) {
    // Re-check in case API key was added or updated in environment
    if (!this.client && this.isConfigured()) {
      this.client = new Resend(process.env.RESEND_API_KEY);
    }

    if (!this.isConfigured() || !this.client) {
      console.log(`\n📨 [EMAIL DEV/MOCK] Resend API key not yet set or in mock mode.`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      if (text) {
        console.log(`   Text Content:\n   ${text.replace(/\n/g, '\n   ')}`);
      }
      console.log(`   (Set RESEND_API_KEY in .env to deliver real emails via Resend)\n`);

      return {
        success: true,
        id: `mock_${Date.now()}`,
        mock: true,
      };
    }

    try {
      const response = await this.client.emails.send({
        from: process.env.EMAIL_FROM || from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });

      if (response.error) {
        console.error('❌ Resend API Error:', response.error);
        return { success: false, error: response.error };
      }

      console.log(`✅ [RESEND] Email sent successfully to ${to} (ID: ${response.data?.id})`);
      return { success: true, id: response.data?.id };
    } catch (err) {
      console.error('❌ Failed to send email via Resend:', err.message);
      // In development, do not crash the request flow if email delivery fails
      if (process.env.NODE_ENV === 'development') {
        return { success: false, error: err.message, devFallback: true };
      }
      throw err;
    }
  }

  // ── Email Templates ─────────────────────────────────────────────

  /**
   * Base HTML email wrapper with C-Mopol aesthetic branding
   */
  _wrapTemplate({ title, preheader, content }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F4F5F7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F4F5F7;
      padding: 40px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      border: 1px solid #E5E7EB;
    }
    .header {
      padding: 36px 36px 20px 36px;
      text-align: center;
      background: #FFFFFF;
    }
    .logo-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .body-content {
      padding: 10px 36px 36px 36px;
      line-height: 1.6;
    }
    .h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
      text-align: center;
    }
    .subtitle {
      font-size: 15px;
      color: #6B7280;
      margin: 0 0 24px 0;
      text-align: center;
      line-height: 1.5;
    }
    .code-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .code-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #111827;
      margin: 0;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background-color: #12151B;
      color: #FFFFFF !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      letter-spacing: -0.2px;
    }
    .footer {
      padding: 24px 36px;
      background-color: #FAFAFA;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 12px;
      color: #9CA3AF;
      line-height: 1.5;
    }
    .footer a {
      color: #6B7280;
      text-decoration: underline;
    }
    .notice-box {
      background: #FFFBEB;
      border-left: 4px solid #F59E0B;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #92400E;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <svg class="logo-badge" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 32C17 28.134 20.134 25 24 25C27.866 25 31 28.134 31 32" stroke="#E26D24" stroke-width="3" stroke-linecap="round"/>
          <path d="M24 6V13M32.5 8.5L28.8 14.5M39.5 15.5L33.5 19.2M42 24H35M39.5 32.5L33.5 28.8M33.5 39.5L29 34M15.5 8.5L19.2 14.5M8.5 15.5L14.5 19.2M6 24H13M8.5 32.5L14.5 28.8M14.5 39.5L19 34" stroke="#E26D24" stroke-width="2.75" stroke-linecap="round"/>
        </svg>
        <h2 class="brand-title">C-Mopol</h2>
      </div>
      <div class="body-content">
        ${content}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} C-Mopol. All rights reserved.</p>
        <p>This is an automated security transmission. If you did not make this request, please protect your account.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 1. Send Email Verification Code & Link
   */
  async sendVerificationEmail({ to, firstName = 'there', code, token }) {
    const verificationUrl = `${FRONTEND_URL}/verify-email?code=${encodeURIComponent(code)}&email=${encodeURIComponent(to)}`;

    const content = `
      <h1 class="h1">Verify your email</h1>
      <p class="subtitle">Hello ${firstName}, enter the 6-character code below to verify your account and get started.</p>
      
      <div class="code-box">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin: 0 0 8px 0; font-weight: 600;">Verification Code</p>
        <div class="code-text">${code}</div>
      </div>

      <div class="btn-container">
        <a href="${verificationUrl}" class="btn">Verify Email Address</a>
      </div>

      <p style="font-size: 13px; color: #6B7280; text-align: center; margin-top: 20px;">
        This code expires in <strong>15 minutes</strong>. If you did not create an account with C-Mopol, you can safely ignore this email.
      </p>
    `;

    return this.send({
      to,
      subject: `Your C-Mopol verification code: ${code}`,
      html: this._wrapTemplate({
        title: 'Verify Your Email Address',
        preheader: `Your C-Mopol email verification code is ${code}`,
        content,
      }),
      text: `Hello ${firstName},\n\nYour C-Mopol email verification code is: ${code}\n\nOr click here to verify:\n${verificationUrl}\n\nThis code expires in 15 minutes.`,
    });
  }

  /**
   * 2. Send Password Reset Link & Token
   */
  async sendPasswordResetEmail({ to, firstName = 'there', resetToken }) {
    const resetUrl = `${FRONTEND_URL}/reset-password/${encodeURIComponent(resetToken)}`;

    const content = `
      <h1 class="h1">Reset your password</h1>
      <p class="subtitle">Hello ${firstName}, we received a request to reset the password for your C-Mopol account.</p>

      <div class="btn-container">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>

      <div class="notice-box">
        <strong>Security Notice:</strong> This password reset link expires in <strong>10 minutes</strong>. For your security, all active sessions on other devices will be revoked once your password is changed.
      </div>

      <p style="font-size: 13px; color: #6B7280; line-height: 1.5;">
        If button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #E26D24; word-break: break-all;">${resetUrl}</a>
      </p>

      <p style="font-size: 13px; color: #9CA3AF; margin-top: 24px;">
        If you didn't request a password reset, please ignore this email or review your account security if you suspect unauthorized access.
      </p>
    `;

    return this.send({
      to,
      subject: 'Reset your C-Mopol password',
      html: this._wrapTemplate({
        title: 'Reset Your Password',
        preheader: 'Instructions to reset your C-Mopol password',
        content,
      }),
      text: `Hello ${firstName},\n\nWe received a request to reset your C-Mopol password.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
    });
  }

  /**
   * 3. Send Password Changed Security Notification
   */
  async sendPasswordChangedEmail({ to, firstName = 'there' }) {
    const content = `
      <h1 class="h1">Password changed successfully</h1>
      <p class="subtitle">Hello ${firstName}, your C-Mopol account password was successfully updated.</p>

      <div class="notice-box" style="background: #ECFDF5; border-color: #10B981; color: #065F46;">
        All active sessions on other devices have been terminated. You can now log in securely with your new password.
      </div>

      <div class="btn-container">
        <a href="${FRONTEND_URL}/login" class="btn">Sign In to Your Account</a>
      </div>

      <p style="font-size: 13px; color: #EF4444; margin-top: 24px; font-weight: 500;">
        ⚠️ If you did NOT initiate this password change, your account may have been compromised. Please contact support immediately.
      </p>
    `;

    return this.send({
      to,
      subject: 'Security Alert: Your C-Mopol password was changed',
      html: this._wrapTemplate({
        title: 'Password Changed',
        preheader: 'Your C-Mopol password was recently changed',
        content,
      }),
      text: `Hello ${firstName},\n\nYour C-Mopol password has been changed successfully. All active sessions have been revoked.\n\nIf you did not make this change, please contact support immediately.`,
    });
  }

  /**
   * 4. Send Welcome Email upon Registration
   */
  async sendWelcomeEmail({ to, firstName = 'there' }) {
    const content = `
      <h1 class="h1">Welcome to C-Mopol!</h1>
      <p class="subtitle">Hello ${firstName}, we're thrilled to have you join our platform.</p>

      <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
        Explore carefully curated collections, streamlined shopping, and hardened account security built for the modern lifestyle.
      </p>

      <div class="btn-container">
        <a href="${FRONTEND_URL}/dashboard" class="btn">Explore Your Dashboard</a>
      </div>

      <p style="font-size: 13px; color: #6B7280; text-align: center;">
        Need help? Reply directly to this email or visit our help center anytime.
      </p>
    `;

    return this.send({
      to,
      subject: 'Welcome to C-Mopol!',
      html: this._wrapTemplate({
        title: 'Welcome to C-Mopol',
        preheader: 'Welcome to your new C-Mopol account',
        content,
      }),
      text: `Hello ${firstName},\n\nWelcome to C-Mopol! We are thrilled to have you with us.\n\nVisit your account: ${FRONTEND_URL}/dashboard`,
    });
  }

  /**
   * 5. Send Order Confirmation & Receipt Email
   */
  async sendOrderConfirmationEmail({ to, firstName = 'there', order, payment }) {
    const itemsHtml = (order.items || [])
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px 0; font-size: 14px; color: #111827;">${item.name || 'Product'} (x${item.quantity})</td>
          <td style="padding: 12px 0; font-size: 14px; text-align: right; font-weight: 600; color: #111827;">${order.currency || 'GHS'} ${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const content = `
      <h1 class="h1">Order Confirmed!</h1>
      <p class="subtitle">Thank you for your order, ${firstName}. We've received your payment and are preparing your package.</p>

      <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; color: #6B7280;">Order Number:</span>
          <span style="font-size: 14px; font-weight: 700; color: #111827;">#${order.orderNumber || order._id}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 13px; color: #6B7280;">Payment Status:</span>
          <span style="font-size: 13px; font-weight: 600; color: #10B981;">PAID</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #E5E7EB;">
            <th style="padding: 8px 0; text-align: left; font-size: 12px; text-transform: uppercase; color: #6B7280;">Item</th>
            <th style="padding: 8px 0; text-align: right; font-size: 12px; text-transform: uppercase; color: #6B7280;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0; font-size: 16px; font-weight: 700; color: #111827;">Total Paid:</td>
            <td style="padding: 16px 0; font-size: 18px; font-weight: 800; text-align: right; color: #E26D24;">${order.currency || 'GHS'} ${Number(order.totalAmount || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="btn-container">
        <a href="${FRONTEND_URL}/dashboard" class="btn">View Order Details</a>
      </div>
    `;

    return this.send({
      to,
      subject: `Order Confirmation #${order.orderNumber || order._id}`,
      html: this._wrapTemplate({
        title: `Order Confirmation #${order.orderNumber}`,
        preheader: `Thank you for your order of ${order.currency || 'GHS'} ${order.totalAmount}`,
        content,
      }),
      text: `Hello ${firstName},\n\nThank you for your order #${order.orderNumber || order._id}!\nTotal Amount: ${order.currency || 'GHS'} ${order.totalAmount}\n\nWe will notify you when your order ships.`,
    });
  }

  /**
   * 6. Send Order Status / Shipping Update Email
   */
  async sendOrderStatusEmail({ to, firstName = 'there', order, newStatus }) {
    const statusLabels = {
      processing: 'is being processed',
      shipped: 'has been shipped 🚚',
      delivered: 'has been delivered 🎉',
      cancelled: 'has been cancelled',
    };

    const statusText = statusLabels[newStatus] || `status changed to ${newStatus}`;

    const content = `
      <h1 class="h1">Order Update</h1>
      <p class="subtitle">Hello ${firstName}, your order <strong>#${order.orderNumber || order._id}</strong> ${statusText}.</p>

      <div class="code-box" style="padding: 16px;">
        <span style="font-size: 16px; font-weight: 700; text-transform: uppercase; color: #111827;">Status: ${newStatus.toUpperCase()}</span>
      </div>

      <div class="btn-container">
        <a href="${FRONTEND_URL}/dashboard" class="btn">Track Order</a>
      </div>
    `;

    return this.send({
      to,
      subject: `Update on Order #${order.orderNumber || order._id}: ${newStatus.toUpperCase()}`,
      html: this._wrapTemplate({
        title: `Order Update #${order.orderNumber}`,
        preheader: `Your order #${order.orderNumber} ${statusText}`,
        content,
      }),
      text: `Hello ${firstName},\n\nYour order #${order.orderNumber || order._id} ${statusText}.\n\nView details: ${FRONTEND_URL}/dashboard`,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
