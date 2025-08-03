import { Router } from "express";
import {
  login,
  register,
  requestResetPassword,
  resetPassword,
  verifyRequestResetToken,
} from "../controllers/auth.controller";
import { validateJwtToken } from "../middlewares/jwt.middleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/validate", validateJwtToken);

// Request password reset
authRouter.post("/request-reset-password", requestResetPassword);
authRouter.get("/verify-reset-token", verifyRequestResetToken);
authRouter.post("/reset-password", resetPassword);

export default authRouter;
