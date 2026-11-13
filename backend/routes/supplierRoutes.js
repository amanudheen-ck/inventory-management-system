const express = require("express");
const c = require("../controllers/supplierController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect, authorize("admin", "manager"));

router.route("/").get(c.getSuppliers).post(c.createSupplier);
router.route("/:id").get(c.getSupplierById).put(c.updateSupplier).delete(authorize("admin"), c.deleteSupplier);

module.exports = router;
