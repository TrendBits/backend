import { Request, Response, NextFunction } from "express";
import { error } from "../utils/api_response.util";
import { getDatabase } from "../configs/database";
import { users, guestRequests } from "../db/schema";
import { eq } from "drizzle-orm";
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
        
        // Verify user still exists in database using Drizzle ORM
        const db = await getDatabase();
        const user = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, decoded.user_id))
          .limit(1);
        
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
    const db = await getDatabase();

    // Check existing guest requests for this IP address (which stores hashed IP)
    const existingGuest = await db
      .select()
      .from(guestRequests)
      .where(eq(guestRequests.ipAddress, ipHash))
      .limit(1);

    if (existingGuest.length > 0) {
      const guest = existingGuest[0];
      
      if (guest.requestCount >= MAX_GUEST_REQUESTS) {
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
      await db
        .update(guestRequests)
        .set({ 
          requestCount: guest.requestCount + 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(guestRequests.ipAddress, ipHash));

      req.guest = {
        ip_address: clientIP,
        request_count: guest.requestCount + 1,
        is_guest: true,
        ip_hash: ipHash
      };
    } else {
      // First request from this IP
      const guestId = uuidv7();
      const now = new Date().toISOString();
      
      await db
        .insert(guestRequests)
        .values({
          id: guestId,
          ipAddress: ipHash,
          requestCount: 1,
          createdAt: now,
          updatedAt: now
        });

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