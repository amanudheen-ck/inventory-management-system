const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { HttpError } = require("./errorMiddleware");

// Verifies the Bearer token and loads the *current* user from the database,
// so deactivated/deleted users and role changes take effect immediately.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw new HttpError(401, "Authorization token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new HttpError(401, "User no longer exists or is deactivated");
  }

  req.user = user;
  next();
};

module.exports = { protect };
