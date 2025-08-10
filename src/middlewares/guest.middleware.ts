import { Request, Response, NextFunction } from "express";
import { error } from "../utils/api_response.util";
import { getDatabase, queryWithRetry } from "../configs/database";
import type { Database } from "@sqlitecloud/drivers";
import { v7 as uuidv7 } from "uuid";
import crypto from "crypto";

// Extend Request interface to include guest data
declare global {
  namespace Express {
    interface Request {
      guest?: {
        ip_address: string;
        request_count: number;
        is_guest: boolean;
        ip_hash: string;
      };
    }
  }
}

const MAX_GUEST_REQUESTS = 2;

// Hash IP address for privacy
const hashIP = (ip: string): string => {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'default-salt').digest('hex');
};

// Get real client IP with proxy support
const getRealClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const cfConnectingIP = req.headers['cf-connecting-ip'] as string;
  
  return cfConnectingIP || realIP || (forwarded ? forwarded.split(',')[0].trim() : null) || 
         req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
};

export const guestOrAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated first
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    
    if (token) {
      // User has token, try to authenticate normally
      const jwt = require("jsonwebtoken");
      try {
        const decoded: any = jwt.verify(
          token,
          process.env.JWT_SECRET || "your-secret-key"
        );
        
        // Verify user still exists in database
        const db: Database = await getDatabase();
        const user = await queryWithRetry(
          () => db.sql`SELECT id FROM users WHERE id = ${decoded.user_id}`
        );
        
        if (user.length === 0) {
          throw new Error('User not found');
        }
        
        req.user = {
          user_id: decoded.user_id,
          email: decoded.email,
        };
        return next();
      } catch (err) {
        // Token invalid, treat as guest
      }
    }

    // Handle as guest user
    const clientIP = getRealClientIP(req);
    const ipHash = hashIP(clientIP);
    const db: Database = await getDatabase();

    // Check existing guest requests for this IP address (which stores hashed IP)
    const existingGuest = await queryWithRetry(
      () => db.sql`SELECT * FROM guest_requests WHERE ip_address = ${ipHash}`
    );

    if (existingGuest.length > 0) {
      const guest = existingGuest[0];
      
      if (guest.request_count >= MAX_GUEST_REQUESTS) {
        res.status(429).json(
          error({
            title: "Request Limit Reached",
            message: `You've reached the limit of ${MAX_GUEST_REQUESTS} free prompts. Please sign up to continue using TrendBits.`,
            data: { requires_signup: true, max_requests: MAX_GUEST_REQUESTS }
          })
        );
        return;
      }

      // Increment request count
      await queryWithRetry(
        () => db.sql`
          UPDATE guest_requests 
          SET request_count = request_count + 1, updated_at = datetime('now')
          WHERE ip_address = ${ipHash}`
      );

      req.guest = {
        ip_address: clientIP,
        request_count: guest.request_count + 1,
        is_guest: true,
        ip_hash: ipHash
      };
    } else {
      // First request from this IP
      const guestId = uuidv7();
      await queryWithRetry(
        () => db.sql`
          INSERT INTO guest_requests (id, ip_address, request_count, created_at, updated_at)
          VALUES (${guestId}, ${ipHash}, 1, datetime('now'), datetime('now'))`
      );

      req.guest = {
        ip_address: clientIP,
        request_count: 1,
        is_guest: true,
        ip_hash: ipHash
      };
    }

    next();
  } catch (err) {
    console.error("Guest middleware error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to process request"
      })
    );
  }
};