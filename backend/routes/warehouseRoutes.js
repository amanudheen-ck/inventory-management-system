const express = require("express");
const c = require("../controllers/warehouseController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", c.getWarehouses);
router.post("/", authorize("admin", "manager"), c.createWarehouse);
router.get("/:id", c.getWarehouseById);
router.put("/:id", authorize("admin", "manager"), c.updateWarehouse);
router.delete("/:id", authorize("admin"), c.deleteWarehouse);

module.exports = router;
