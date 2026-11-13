const express = require("express");
const c = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

router.route("/").get(c.getOrders).post(c.createOrder);
router.get("/:id", c.getOrderById);
router.get("/:id/invoice", c.getInvoice);
router.patch("/:id/cancel", authorize("admin", "manager"), c.cancelOrder);
router.patch("/:id/payment", authorize("admin", "manager"), c.updatePayment);

module.exports = router;
