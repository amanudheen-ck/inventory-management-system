const express = require("express");
const c = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

// Public
router.post("/register", c.register);
router.post("/login", c.login);

// Authenticated
router.use(protect);
router.get("/me", c.getMe);
router.put("/me/password", c.changePassword);

// Admin only: user management
router.route("/users").get(authorize("admin"), c.listUsers).post(authorize("admin"), c.createUser);
router.route("/users/:id").put(authorize("admin"), c.updateUser).delete(authorize("admin"), c.deleteUser);

module.exports = router;
