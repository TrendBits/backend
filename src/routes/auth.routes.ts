import { Router } from "express";
import {
  login,
  register,
  requestResetPassword,
  resetPassword,
  verifyRequestResetToken,
  getUserProfile,
  updateUsername,
} from "../controllers/auth.controller";
import { validateJwtToken, authenticateToken } from "../middlewares/jwt.middleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/validate", validateJwtToken);

// Request password reset
authRouter.post("/request-reset-password", requestResetPassword);
authRouter.get("/verify-reset-token", verifyRequestResetToken);
authRouter.post("/reset-password", resetPassword);

// User profile endpoints protected by JWT
authRouter.get("/profile", authenticateToken, getUserProfile);
authRouter.put("/profile/username", authenticateToken, updateUsername);

export default authRouter;
