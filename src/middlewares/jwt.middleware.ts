import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { error, success } from "../utils/api_response.util";

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        email: string;
      };
    }
  }
}

// Generates JWT access token
export const generateAccessToken = (user_id: string, email: string): string => {
  return jwt.sign(
    { user_id, email },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// Middleware to authenticate token and proceed to next route
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json(
      error({
        title: "Authentication Required",
        message: "Please sign in to access this feature",
      })
    );
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key",
    (err, decoded: any) => {
      if (err) {
        let title = "Authentication Failed";
        let message = "Please sign in again";

        if (err.name === "TokenExpiredError") {
          title = "Session Expired";
          message = "Your session has expired. Please sign in again";
        } else if (err.name === "JsonWebTokenError") {
          title = "Invalid Session";
          message = "Please sign in again to continue";
        }

        res.status(401).json(
          error({
            title,
            message,
          })
        );
        return;
      }

      req.user = {
        user_id: decoded.user_id,
        email: decoded.email,
      };

      next();
    }
  );
};

// Just validates token without proceeding
export const validateJwtToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json(
      error({
        title: "Authentication Required",
        message: "Please sign in to access this feature",
      })
    );
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key",
    (err, decoded) => {
      if (err) {
        let title = "Authentication Failed";
        let message = "Please sign in again";

        if (err.name === "TokenExpiredError") {
          title = "Session Expired";
          message = "Your session has expired. Please sign in again";
        } else if (err.name === "JsonWebTokenError") {
          title = "Invalid Session";
          message = "Please sign in again to continue";
        }

        res.status(401).json(
          error({
            title,
            message,
          })
        );
        return;
      }

      // Return token validation
      res.json(
        success({
          title: "Token Valid",
          message: "Token is valid",
          data: decoded,
        })
      );
    }
  );
};
