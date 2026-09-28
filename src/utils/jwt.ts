import crypto from 'crypto';

export interface TokenPayload {
  id: string;
  email: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Ensure JWT secret is set or fallback to consistent dev secret with security warning
const JWT_SECRET = process.env.JWT_SECRET || 'cyberrange-default-jwt-secret-key-replace-in-production-2026';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY WARNING]: JWT_SECRET environment variable is NOT set in production mode!');
}

/**
 * Encodes string/buffer into Base64URL string (RFC 7515).
 */
function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decodes Base64URL string into standard utf-8 string.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a payload with HMAC-SHA256 and returns a standard JWT string.
 * Default expiration: 24 hours (86400 seconds).
 */
export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresInSeconds: number = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a JWT token string.
 * Returns decoded TokenPayload or null if invalid or expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature using timing-safe comparison to prevent timing attacks
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

    let providedSignature: Buffer;
    try {
      let b64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      providedSignature = Buffer.from(b64, 'base64');
    } catch {
      return null;
    }

    if (providedSignature.length !== expectedSignature.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(providedSignature, expectedSignature)) {
      return null;
    }

    // Parse header and payload
    const headerStr = base64UrlDecode(encodedHeader);
    const header = JSON.parse(headerStr);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: TokenPayload = JSON.parse(payloadStr);

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}
