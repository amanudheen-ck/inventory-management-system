const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { HttpError } = require("../middleware/errorMiddleware");
const { escapeRegex, getPagination, buildPagination, requireFields, pick } = require("../utils/helpers");

const FIELDS = ["name", "email", "phone", "address", "notes"];

// GET /api/customers?search=&page=&limit=
exports.getCustomers = async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = {};

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit),
    Customer.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: buildPagination(total, pagination) });
};

// GET /api/customers/:id   (includes lifetime order stats)
exports.getCustomerById = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new HttpError(404, "Customer not found");

  const [stats] = await Order.aggregate([
    { $match: { customer: customer._id, status: "completed" } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$total" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      ...customer.toJSON(),
      stats: stats
        ? { totalOrders: stats.totalOrders, totalSpent: stats.totalSpent, lastOrderAt: stats.lastOrderAt }
        : { totalOrders: 0, totalSpent: 0, lastOrderAt: null },
    },
  });
};

// POST /api/customers
exports.createCustomer = async (req, res) => {
  requireFields(req.body, ["name"]);
  const data = pick(req.body, FIELDS);
  if (!data.email) delete data.email; // empty string would collide in the unique index

  const customer = await Customer.create(data);
  res.status(201).json({ success: true, data: customer });
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  const data = pick(req.body, FIELDS);
  const update = { $set: data };

  if ("email" in data && !data.email) {
    delete data.email;
    update.$unset = { email: 1 };
  }

  const customer = await Customer.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw new HttpError(404, "Customer not found");

  res.json({ success: true, data: customer });
};

// DELETE /api/customers/:id   (admin, manager)
exports.deleteCustomer = async (req, res) => {
  if (await Order.exists({ customer: req.params.id })) {
    throw new HttpError(409, "Customer has orders and cannot be deleted");
  }
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) throw new HttpError(404, "Customer not found");

  res.json({ success: true, message: "Customer deleted" });
};
