import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { error, success } from "../utils/api_response.util";

// Generates JWT access token
export const generateAccessToken = (user_id: string, email: string): string => {
  return jwt.sign(
    { user_id, email },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
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
        title: "Access Denied",
        message: "No token provided",
      })
    );
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key",
    (err, decoded) => {
      if (err) {
        let message = "Token is invalid or expired";

        if (err.name === "TokenExpiredError") {
          message = "Token has expired";
        } else if (err.name === "JsonWebTokenError") {
          message = "Invalid token format";
        }

        res.status(403).json(
          error({
            title: "Invalid Token",
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
