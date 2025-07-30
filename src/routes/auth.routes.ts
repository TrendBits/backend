import { Router } from "express";
import {
  login,
  register,
  requestResetPassword,
} from "../controllers/auth.controller";
import { validateJwtToken } from "../middlewares/jwt.middleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/validate", validateJwtToken);
authRouter.post("/request-reset-password", requestResetPassword);

export default authRouter;
