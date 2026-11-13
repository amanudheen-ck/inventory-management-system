const jwt = require("jsonwebtoken");

// The role is only a hint inside the token; authMiddleware re-loads the user
// from the database on every request, so role changes apply immediately.
const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

module.exports = generateToken;
