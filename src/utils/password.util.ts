import bcrypt from "bcrypt";

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
