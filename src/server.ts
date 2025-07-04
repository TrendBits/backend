import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import type { Request, Response } from "express";

import { connectToDatabase } from "./configs/database";
import routes from "./routes";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Database connection
connectToDatabase();

// routes
app.use("/api", routes);
app.get("/", (req: Request, res: Response) => {
  res.send("Kelvin is an aspiring senior engineer!");
});

// port connection
app.listen(port, () =>
  console.log(`TrendBit's server is running on port ${port}`)
);
