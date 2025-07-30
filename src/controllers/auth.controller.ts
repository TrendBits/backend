import { v7 as uuidv7 } from "uuid";
import { Request, Response, RequestHandler } from "express";
import { sanitizeInput } from "../middlewares/database.middleware";
import { error, success } from "../utils/api_response.util";
import type {
  LoginRequest,
  RegisterRequest,
  RequestResetPassword,
} from "../types/user.types";
import {
  generateResetToken,
  hashPassword,
  verifyPassword,
} from "../utils/auth.util";
import { generateAccessToken } from "../middlewares/jwt.middleware";
import { getDatabase, queryWithRetry } from "../configs/database";
import type { Database } from "@sqlitecloud/drivers";

export const register: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = req.body as RegisterRequest;
    const { email: rawEmail, password: rawPassword } = body;

    // Validate input
    if (!rawEmail.trim() || !rawPassword.trim()) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Email and password are required",
        })
      );
      return;
    }

    // Sanitize email input
    const email = sanitizeInput(rawEmail.trim().toLowerCase());
    if (!email)
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Invalid email address format",
        })
      );

    const db: Database = await getDatabase();

    // Check if user already exists
    const existingUser = await queryWithRetry(
      () => db.sql`SELECT id FROM users WHERE email = ${email}`
    );

    if (existingUser.length > 0) {
      res.status(400).json(
        error({
          title: "Registration Failed",
          message: "User already exists",
        })
      );
      return;
    }

    // Create new user
    const userId = uuidv7();
    const hashedPassword = await hashPassword(rawPassword);

    const newUser = await queryWithRetry(
      () => db.sql`
      INSERT INTO users (id, email, password, created_at, updated_at)
      VALUES (${userId}, ${email}, ${hashedPassword}, datetime('now'), datetime('now'))
      RETURNING id, email, created_at`
    );

    res.status(201).json(
      success({
        title: "Registration Successful",
        message: "User registered successfully",
        data: newUser[0],
      })
    );
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Registration failed due to an internal error",
      })
    );
  }
};

export const login: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body as LoginRequest;

    // Validate input
    if (!rawEmail.trim() || !rawPassword.trim()) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Email and password are required",
        })
      );
      return;
    }

    // Sanitize email input
    const email = sanitizeInput(rawEmail.trim().toLowerCase());
    if (!email) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Invalid email address format",
        })
      );
      return;
    }

    // Get database instance
    const db: Database = await getDatabase();

    // Find user by email
    const result = await queryWithRetry(
      () =>
        db.sql`SELECT id, email, username, password FROM users WHERE email = ${email}`
    );

    if (result.length === 0) {
      res.status(401).json(
        error({
          title: "Authentication Failed",
          message: "Invalid credentials",
        })
      );
      return;
    }

    // Verify password
    const isPasswordValid = await verifyPassword(
      rawPassword,
      result[0].password
    );

    if (!isPasswordValid) {
      res.status(401).json(
        error({
          title: "Authentication Failed",
          message: "Invalid credentials",
        })
      );
      return;
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = result[0];

    // Generate JWT tokens using middleware functions
    const access_token = generateAccessToken(
      userWithoutPassword.id,
      userWithoutPassword.email
    );

    console.log("Access Token:", access_token);

    res.json(
      success({
        title: "Login Successful",
        message: "User authenticated successfully",
        data: { user: userWithoutPassword, access_token },
      })
    );
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Login failed due to an internal error",
      })
    );
  }
};

export const requestResetPassword: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body as RequestResetPassword;
    const { email } = body;
    const formattedEmail = email.trim().toLowerCase();

    // Validate input
    if (!formattedEmail) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Email is required",
        })
      );
      return;
    }

    // Sanitize email input
    const sanitizedEmail = sanitizeInput(email.trim().toLowerCase());
    if (!sanitizedEmail) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Invalid email address format",
        })
      );
      return;
    }

    // Get database instance
    const db: Database = await getDatabase();

    // Find user by email
    const result = await queryWithRetry(
      () => db.sql`SELECT id, email FROM users WHERE email = ${formattedEmail}`
    );

    if (result.length === 0) {
      res.status(404).json(
        error({
          title: "Reset Password Failed",
          message: "Email address not found. Please register for an account.",
        })
      );
      return;
    }

    // Generate reset token and expiry
    const { resetToken, expiresAt } = generateResetToken();

    // Save reset token and expiry to user in DB
    await queryWithRetry(
      () =>
        db.sql`
        UPDATE users
        SET reset_token = ${resetToken}, reset_token_expires = ${expiresAt}, updated_at = datetime('now')
        WHERE id = ${result[0].id}
      `
    );

    // Send reset email (implement sendResetEmail elsewhere)
    // await sendResetEmail(result[0].email, resetToken);

    res.status(200).json(
      success({
        title: "Reset Password Request Successful",
        message: "Reset password email sent successfully",
      })
    );
  } catch (err) {
    console.error("Reset password request error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Reset password request failed due to an internal error",
      })
    );
  }
};
