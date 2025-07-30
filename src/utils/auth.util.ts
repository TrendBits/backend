import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12");

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.trim().length === 0) {
    throw new Error("Password cannot be empty");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || password.trim().length === 0) {
    throw new Error("Password cannot be empty");
  }

  if (!hashedPassword || hashedPassword.trim().length === 0) {
    throw new Error("Hashed password cannot be empty");
  }

  try {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    throw new Error(`Password verification failed: ${error.message}`);
  }
}

// Generates a secure reset token and its expiration timestamp.
export function generateResetToken() {
  const resetToken = uuidv4();
  const expiryMinutes = parseInt(
    process.env.RESET_TOKEN_EXPIRY_MINUTES || "60",
    10
  );
  const expiresAt = new Date(
    Date.now() + expiryMinutes * 60 * 1000
  ).toISOString();
  return { resetToken, expiresAt };
}
