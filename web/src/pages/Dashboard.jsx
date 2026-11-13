import { useEffect, useState } from "react";
import { api, inr, num } from "../api.js";

const Kpi = ({ label, value, sub, tone }) => (
  <div className="card kpi">
    <div className="muted">{label}</div>
    <div className={"big " + (tone || "")}>{value}</div>
    <div className="muted sm">{sub}</div>
  </div>
);

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;

  const t = d.totals;
  const max = Math.max(1, ...d.salesLast7Days.map((x) => x.revenue));

  return (
    <>
      <h1>Dashboard</h1>
      <div className="kpis">
        <Kpi label="Total Products" value={num(t.products)} sub={`${num(t.units)} units in stock`} />
        <Kpi label="Low Stock Items" value={num(t.lowStock + t.outOfStock)} sub={`${t.outOfStock} out of stock`} tone="amber" />
        <Kpi label="Today's Sales" value={inr(d.sales.today.revenue)} sub={`${d.sales.today.orders} orders`} />
        {t.inventoryCostValue !== undefined
          ? <Kpi label="Inventory Value" value={inr(t.inventoryCostValue)} sub="at cost price" />
          : <Kpi label="Customers" value={num(t.customers)} sub="registered" />}
      </div>

      <div className="grid21">
        <div className="card">
          <h3>Sales, last 7 days</h3>
          <div className="bars">
            {d.salesLast7Days.map((x, i) => (
              <div key={x.date} className="col" title={`${x.date}: ${inr(x.revenue)}`}>
                <div className={"bar" + (i === 6 ? " today" : "")} style={{ height: `${Math.max(3, (x.revenue / max) * 100)}%` }} />
                <span className="muted sm">{x.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Stock by Warehouse</h3>
          {d.stockByWarehouse.length === 0 && <p className="muted sm">Assign products to a warehouse to see this.</p>}
          {d.stockByWarehouse.map((w) => (
            <div key={w.warehouseId} className="wrow">
              <div className="between sm"><b>{w.name} ({w.code})</b><span className="muted">{num(w.units)}{w.capacity ? ` / ${num(w.capacity)}` : ""}</span></div>
              <div className="meter"><i style={{ width: `${Math.min(100, w.utilization ?? 0)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Low stock</h3>
          {d.lowStockItems.length === 0 && <p className="muted sm">Nothing is running low.</p>}
          {d.lowStockItems.map((p) => (
            <div key={p._id} className="between line">
              <div><b>{p.name}</b><div className="muted sm">{p.sku}</div></div>
              <span className={"chip " + (p.quantity === 0 ? "red" : "amber")}>{p.quantity === 0 ? "Out of stock" : `${p.quantity} left`}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Recent orders</h3>
          {d.recentOrders.length === 0 && <p className="muted sm">No orders yet.</p>}
          {d.recentOrders.map((o) => (
            <div key={o._id} className="between line">
              <div><b>{o.orderNumber}</b><div className="muted sm">{o.customer?.name || "Walk-in customer"}</div></div>
              <div className="right"><b>{inr(o.total)}</b><div><span className={"chip " + (o.status === "completed" ? "green" : "red")}>{o.status}</span></div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
