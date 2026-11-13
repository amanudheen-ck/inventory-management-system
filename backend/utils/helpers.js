const { HttpError } = require("../middleware/errorMiddleware");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query, defaultLimit = 10, maxLimit = 100) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const buildPagination = (total, { page, limit }) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
});

const parsePositiveInt = (value, field = "value") => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `${field} must be a positive whole number`);
  }
  return n;
};

const parseNonNegativeInt = (value, field = "value") => {
  const n = Number(value);
  if (value === "" || value === null || !Number.isInteger(n) || n < 0) {
    throw new HttpError(400, `${field} must be a whole number >= 0`);
  }
  return n;
};

const requireFields = (body, fields) => {
  const missing = fields.filter(
    (f) => body?.[f] === undefined || body[f] === null || String(body[f]).trim() === ""
  );
  if (missing.length) {
    throw new HttpError(400, `Missing required field(s): ${missing.join(", ")}`);
  }
};

const pick = (obj, keys) =>
  keys.reduce((acc, key) => {
    if (obj?.[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (n) => {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
};

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to the last `defaultDays` days.
const parseDateRange = (query, defaultDays = 30) => {
  const from = query.from ? new Date(query.from) : daysAgo(defaultDays);
  const to = query.to ? new Date(query.to) : new Date();

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new HttpError(400, "Invalid date. Use the format YYYY-MM-DD");
  }
  if (query.to) to.setHours(23, 59, 59, 999);
  if (from > to) throw new HttpError(400, "'from' must be before 'to'");

  return { from, to };
};

module.exports = {
  escapeRegex,
  getPagination,
  buildPagination,
  parsePositiveInt,
  parseNonNegativeInt,
  requireFields,
  pick,
  round2,
  startOfDay,
  daysAgo,
  parseDateRange,
};
