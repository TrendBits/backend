const { getDatabase: getDbInstance } = require("../configs/database");

// database input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input
    .replace(/['";\\]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/;/g, "")
    .trim();
};

// database query wrapper
const safeQuery = async (queryFunction) => {
  try {
    const db = getDbInstance();
    return await queryFunction(db);
  } catch (error) {
    console.error("Database query error:", error);
    throw new Error("Database operation failed");
  }
};

export { sanitizeInput, safeQuery };
