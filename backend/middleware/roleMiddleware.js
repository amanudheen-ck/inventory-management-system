const { HttpError } = require("./errorMiddleware");

// Usage: router.post("/", protect, authorize("admin", "manager"), handler)
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, `Access denied. Requires role: ${roles.join(" or ")}`);
    }
    next();
  };

module.exports = { authorize };
