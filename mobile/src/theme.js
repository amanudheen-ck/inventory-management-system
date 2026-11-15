export const C = {
  bg: "#F8FAFC", card: "#FFFFFF", line: "#E2E8F0", ink: "#0F172A", mute: "#475569", blue: "#2563EB", tint: "#DBEAFE",
  green: "#15803D", greenBg: "#DCFCE7", amber: "#B45309", amberBg: "#FEF3C7", red: "#B91C1C", redBg: "#FEE2E2",
};
export const inr = (n) => "₹" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const stockTone = (p) =>
  p.quantity === 0 ? ["Out of stock", C.red, C.redBg] : p.quantity <= p.minStock ? ["Low stock", C.amber, C.amberBg] : ["In stock", C.green, C.greenBg];
