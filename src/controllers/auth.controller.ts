import { safeQuery, sanitizeInput } from "../middlewares/database.middleware";

const register = async (req, res) => {
  try {
    const email = sanitizeInput(req.body.email);
    const password = sanitizeInput(req.body.password);
    const username = sanitizeInput(req.body.username);

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Email and password are required",
      });
    }

    const result = await safeQuery(async (db) => {
      const existingUser = await db.sql`
        SELECT id FROM User WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        throw new Error("User already exists");
      }

      const newUser = await db.sql`
        INSERT INTO User (email, password, username, createdAt, updatedAt) 
        VALUES (${email}, ${password}, ${username}, datetime('now'), datetime('now'))
        RETURNING id, email, username, createdAt
      `;

      return newUser[0];
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: result,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const email = sanitizeInput(req.body.email);
    const password = sanitizeInput(req.body.password);

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required",
      });
    }

    const user = await safeQuery(async (db) => {
      const result = await db.sql`
        SELECT id, email, username, password FROM User 
        WHERE email = ${email}
      `;

      if (result.length === 0) {
        throw new Error("Invalid credentials");
      }

      if (result[0].password !== password) {
        throw new Error("Invalid credentials");
      }

      const { password: _, ...userWithoutPassword } = result[0];
      return userWithoutPassword;
    });

    res.json({
      success: true,
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({
      error: "Authentication failed",
      message: "Invalid credentials",
    });
  }
};

export { register, login };
