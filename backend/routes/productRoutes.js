const express = require("express");
const c = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(protect);

// Categories (declared before "/:id" so "categories" isn't treated as an id)
router.get("/categories", c.getCategories);
router.post("/categories", authorize("admin", "manager"), c.createCategory);
router.put("/categories/:id", authorize("admin", "manager"), c.updateCategory);
router.delete("/categories/:id", authorize("admin"), c.deleteCategory);

// Products
router.get("/", c.getProducts);
router.get("/barcode/:code", c.getProductByBarcode);
router.post("/", authorize("admin", "manager"), c.createProduct);
router.get("/:id", c.getProductById);
router.put("/:id", authorize("admin", "manager"), c.updateProduct);
router.delete("/:id", authorize("admin"), c.deleteProduct);

module.exports = router;
