const express = require("express");
const c = require("../controllers/customerController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

router.route("/").get(c.getCustomers).post(c.createCustomer);
router
  .route("/:id")
  .get(c.getCustomerById)
  .put(c.updateCustomer)
  .delete(authorize("admin", "manager"), c.deleteCustomer);

module.exports = router;
