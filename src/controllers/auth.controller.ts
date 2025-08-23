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
import { getDatabase } from "../configs/database";
import { users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sendRequestResetPasswordEmail } from "../utils/send_email.util";

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

    const db = await getDatabase();

    // Check if user already exists
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

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
    const now = new Date();

    const newUser = await db.insert(users)
      .values({
        id: userId,
        email: email,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now
      })
      .returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt
      });

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
    const db = await getDatabase();

    // Find user by email
    const result = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      password: users.password
    })
    .from(users)
    .where(eq(users.email, email));

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
    const db = await getDatabase();

    // Find user by email
    const result = await db.select({
      id: users.id,
      email: users.email
    })
    .from(users)
    .where(eq(users.email, formattedEmail));

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
    await db.update(users)
      .set({
        resetToken: resetToken,
        resetTokenExpires: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(users.id, result[0].id));

    // Send reset email
    await sendRequestResetPasswordEmail(result[0].email, resetToken);

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

export const verifyRequestResetToken: RequestHandler = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      res.status(400).json(
        error({
          title: "Invalid Token",
          message: "Reset token is required.",
        })
      );
      return;
    }

    const db = await getDatabase();
    const result = await db.select({
      email: users.email,
      resetTokenExpires: users.resetTokenExpires
    })
    .from(users)
    .where(eq(users.resetToken, token));

    if (!result || result.length === 0) {
      res.status(400).json(
        error({
          title: "Invalid or Expired Token",
          message: "Reset token is invalid or has expired.",
        })
      );
      return;
    }
    
    const { email, resetTokenExpires } = result[0];
    // Only check expiry since token match is handled by the query
    if (!resetTokenExpires || new Date(resetTokenExpires) < new Date()) {
      res.status(400).json(
        error({
          title: "Invalid or Expired Token",
          message: "Reset token is invalid or has expired.",
        })
      );
      return;
    }
    
    res.status(200).json(
      success({
        title: "Token Valid",
        message: "Reset token is valid.",
        data: { email },
      })
    );
  } catch (err) {
    console.error("Verify reset token error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Could not verify reset token.",
      })
    );
  }
};

export const resetPassword: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body;

    // Validate input
    if (!rawEmail?.trim() || !rawPassword?.trim()) {
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
    const db = await getDatabase();

    // Find user by email
    const result = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (result.length === 0) {
      res.status(404).json(
        error({
          title: "Reset Password Failed",
          message: "Email address not found",
        })
      );
      return;
    }

    // Hash the new password
    const hashedPassword = await hashPassword(rawPassword);

    // Update user's password and clear reset token fields
    await db.update(users)
      .set({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, result[0].id));

    res.status(200).json(
      success({
        title: "Password Reset Successful",
        message: "Password has been reset successfully",
      })
    );
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Password reset failed due to an internal error",
      })
    );
  }
};

// Get user profile by token
export const getUserProfile: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      res.status(401).json(
        error({
          title: "Authentication Required",
          message: "Please sign in to access this feature",
        })
      );
      return;
    }

    const db = await getDatabase();

    // Get user profile information including created_at
    const result = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(eq(users.id, userId));

    if (result.length === 0) {
      res.status(404).json(
        error({
          title: "User Not Found",
          message: "User profile not found",
        })
      );
      return;
    }

    const user = result[0];
    res.status(200).json(
      success({
        title: "Profile Retrieved",
        message: "User profile retrieved successfully",
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
        },
      })
    );
  } catch (err) {
    console.error("Get user profile error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to retrieve user profile",
      })
    );
  }
};

// Update username by token
export const updateUsername: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.user_id;
    const { username: rawUsername } = req.body;

    if (!userId) {
      res.status(401).json(
        error({
          title: "Authentication Required",
          message: "Please sign in to access this feature",
        })
      );
      return;
    }

    // Validate username input
    if (!rawUsername || !rawUsername.trim()) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Username is required",
        })
      );
      return;
    }

    // Sanitize username input
    const username = sanitizeInput(rawUsername.trim());
    if (!username) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Invalid username format",
        })
      );
      return;
    }

    // Validate username length (3-30 characters)
    if (username.length < 3 || username.length > 30) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Username must be between 3 and 30 characters",
        })
      );
      return;
    }

    const db = await getDatabase();

    // Check if username already exists (excluding current user)
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.username, username),
        eq(users.id, userId)
      ));

    if (existingUser.length > 0) {
      res.status(409).json(
        error({
          title: "Username Taken",
          message: "This username is already taken",
        })
      );
      return;
    }

    // Update username
    await db.update(users)
      .set({
        username: username,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Get updated user information
    const updatedUser = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(eq(users.id, userId));

    res.status(200).json(
      success({
        title: "Username Updated",
        message: "Username updated successfully",
        data: {
          id: updatedUser[0].id,
          email: updatedUser[0].email,
          username: updatedUser[0].username,
          updated_at: updatedUser[0].updatedAt,
        },
      })
    );
  } catch (err) {
    console.error("Update username error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to update username",
      })
    );
  }
};
