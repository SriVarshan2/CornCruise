import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}

const JWT_SECRET_BYTES = new TextEncoder().encode(process.env.JWT_SECRET);

export interface JWTPayload {
  userId: number;
  email: string;
}

/**
 * Hashes a plaintext password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compares a password to a hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Signs a payload as a JWT with 24 hours expiry.
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET_BYTES);
}

/**
 * Verifies a JWT and returns the parsed payload.
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES);
    if (payload && typeof payload.userId === 'number' && typeof payload.email === 'string') {
      return {
        userId: payload.userId,
        email: payload.email
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}
