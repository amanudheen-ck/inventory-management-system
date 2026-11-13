const express = require("express");
const c = require("../controllers/inventoryController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

router.get("/history", c.getHistory);
router.get("/low-stock", c.getLowStock);

router.post("/in", authorize("admin", "manager", "staff"), c.stockIn);
router.post("/out", authorize("admin", "manager"), c.stockOut);
router.post("/adjust", authorize("admin", "manager"), c.adjustStock);

module.exports = router;
