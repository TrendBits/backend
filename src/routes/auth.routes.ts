import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { validateJwtToken } from "../middlewares/jwt.middleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/validate", validateJwtToken);

export default authRouter;
