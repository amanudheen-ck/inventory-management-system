const express = require("express");
const c = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect, authorize("admin", "manager"));

router.get("/inventory", c.getInventoryReport);
router.get("/sales", c.getSalesReport);
router.get("/top-products", c.getTopProducts);
router.get("/stock-movement", c.getStockMovementReport);
router.get("/customers", c.getCustomerReport);

module.exports = router;
