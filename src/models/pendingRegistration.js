import mongoose from 'mongoose';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
  const secret = process.env.ACCESS_TOKEN_SECRET || 'c-mopol-default-fallback-encryption-key-32b';
  return crypto.createHash('sha256').update(secret).digest(); // Exactly 32 bytes
};

export const encryptPassword = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptPassword = (ciphertext) => {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted password payload format.');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const pendingRegistrationSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    encryptedPassword: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    verificationCodeHash: {
      type: String,
      required: true,
    },
    verificationTokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB automatically removes expired pending registrations
    },
  },
  { timestamps: true },
);

const PendingRegistration = mongoose.model(
  'PendingRegistration',
  pendingRegistrationSchema,
);

export default PendingRegistration;
