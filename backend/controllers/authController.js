const User = require("../models/User");
const Order = require("../models/Order");
const StockTransaction = require("../models/StockTransaction");
const generateToken = require("../utils/generateToken");
const { HttpError } = require("../middleware/errorMiddleware");
const { requireFields, pick } = require("../utils/helpers");

const ROLES = ["admin", "manager", "staff"];

const normalizeEmail = (email) => String(email).toLowerCase().trim();

const assertPassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters");
  }
};

// POST /api/auth/register  (public)
// Self-registration ALWAYS creates a "staff" user. The very first user in an
// empty database becomes the admin so the system can be bootstrapped.
exports.register = async (req, res) => {
  requireFields(req.body, ["name", "email", "password"]);
  const { name, email, password } = req.body;
  assertPassword(password);

  const normalized = normalizeEmail(email);
  if (await User.exists({ email: normalized })) {
    throw new HttpError(409, "A user with this email already exists");
  }

  const isFirstUser = (await User.estimatedDocumentCount()) === 0;
  const user = await User.create({
    name,
    email: normalized,
    password,
    role: isFirstUser ? "admin" : "staff",
  });

  res.status(201).json({ success: true, token: generateToken(user), user });
};

// POST /api/auth/login  (public)
exports.login = async (req, res) => {
  requireFields(req.body, ["email", "password"]);

  const user = await User.findOne({ email: normalizeEmail(req.body.email) }).select("+password");
  const valid = user && (await user.comparePassword(String(req.body.password)));

  if (!valid) throw new HttpError(401, "Invalid email or password");
  if (!user.isActive) throw new HttpError(403, "This account has been deactivated");

  res.json({ success: true, token: generateToken(user), user });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// PUT /api/auth/me/password
exports.changePassword = async (req, res) => {
  requireFields(req.body, ["currentPassword", "newPassword"]);
  assertPassword(req.body.newPassword);

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(String(req.body.currentPassword)))) {
    throw new HttpError(401, "Current password is incorrect");
  }

  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: "Password updated" });
};

// ---------------------------------------------------------------- admin only

// GET /api/auth/users
exports.listUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, data: users });
};

// POST /api/auth/users
exports.createUser = async (req, res) => {
  requireFields(req.body, ["name", "email", "password"]);
  const { name, email, password, role = "staff" } = req.body;

  assertPassword(password);
  if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}`);

  const normalized = normalizeEmail(email);
  if (await User.exists({ email: normalized })) {
    throw new HttpError(409, "A user with this email already exists");
  }

  const user = await User.create({ name, email: normalized, password, role });
  res.status(201).json({ success: true, data: user });
};

// PUT /api/auth/users/:id   (name, role, isActive)
exports.updateUser = async (req, res) => {
  const updates = pick(req.body, ["name", "role", "isActive"]);

  if (updates.role !== undefined && !ROLES.includes(updates.role)) {
    throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}`);
  }
  if (updates.isActive !== undefined && typeof updates.isActive !== "boolean") {
    throw new HttpError(400, "isActive must be true or false");
  }
  // Prevents the last admin from locking themselves out.
  if (
    String(req.user._id) === req.params.id &&
    (updates.role !== undefined || updates.isActive !== undefined)
  ) {
    throw new HttpError(400, "You cannot change your own role or status");
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new HttpError(404, "User not found");

  res.json({ success: true, data: user });
};

// DELETE /api/auth/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (String(req.user._id) === id) throw new HttpError(400, "You cannot delete your own account");

  const [hasOrders, hasMovements] = await Promise.all([
    Order.exists({ createdBy: id }),
    StockTransaction.exists({ performedBy: id }),
  ]);
  if (hasOrders || hasMovements) {
    throw new HttpError(409, "This user has activity history. Deactivate the account instead (isActive: false).");
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) throw new HttpError(404, "User not found");

  res.json({ success: true, message: "User deleted" });
};
