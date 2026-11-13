import { useEffect, useState } from "react";
import { api, inr, num } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const iso = (d) => d.toISOString().slice(0, 10);

export default function Reports() {
  const { can } = useAuth();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [group, setGroup] = useState("day");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const allowed = can("admin", "manager");

  useEffect(() => {
    if (!allowed) return;
    const qs = `from=${from}&to=${to}`;
    Promise.all([api.get(`/reports/sales?${qs}&group=${group}`), api.get(`/reports/top-products?${qs}&limit=10`), api.get("/reports/inventory")])
      .then(([s, t, i]) => { setD({ sales: s.data, top: t.data, inv: i.data }); setErr(""); })
      .catch((e) => setErr(e.message));
  }, [from, to, group, allowed]);

  if (!allowed) return <p className="err">Only admins and managers can view reports.</p>;
  const t = d?.sales.totals;
  const max = d ? Math.max(1, ...d.sales.series.map((x) => x.revenue)) : 1;

  return (
    <>
      <div className="between wrap"><div><h1>Reports &amp; Analytics</h1><p className="muted sm">Sales, profit estimates and stock value</p></div>
        <div className="toolbar nopad">
          <label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          <label>Group by<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="day">Day</option><option value="month">Month</option></select></label>
        </div></div>
      {err && <p className="err">{err}</p>}
      {!d && !err && <p className="muted">Loading…</p>}
      {d && (
        <>
          <div className="kpis">
            {[["Revenue", inr(t.revenue)], ["Orders", num(t.orders)], ["Estimated profit", inr(t.estimatedProfit)], ["Tax collected", inr(t.tax)]].map(([l, v]) => (
              <div className="card kpi" key={l}><div className="muted">{l}</div><div className="big">{v}</div></div>
            ))}
          </div>
          <div className="card">
            <h3>Revenue by {group}</h3>
            {d.sales.series.length === 0 ? <p className="muted sm">No sales in this period.</p> : (
              <div className="scroll"><div className="bars wide">
                {d.sales.series.map((x) => (
                  <div key={x.period} className="col" title={`${x.period}: ${inr(x.revenue)} (${x.orders} orders)`}>
                    <div className="bar" style={{ height: `${Math.max(3, (x.revenue / max) * 100)}%` }} />
                    <span className="muted sm">{x.period.slice(group === "day" ? 5 : 2)}</span>
                  </div>
                ))}
              </div></div>
            )}
          </div>
          <div className="grid2">
            <div className="card"><h3>Top products</h3>
              <table className="itable"><thead><tr><th>Product</th><th className="right">Units</th><th className="right">Revenue</th></tr></thead>
                <tbody>{d.top.map((p) => <tr key={p.productId}><td>{p.name}</td><td className="right">{num(p.unitsSold)}</td><td className="right">{inr(p.revenue)}</td></tr>)}</tbody></table>
              {d.top.length === 0 && <p className="muted sm">No sales in this period.</p>}
            </div>
            <div className="card"><h3>Stock value by category</h3>
              <table className="itable"><thead><tr><th>Category</th><th className="right">Units</th><th className="right">At cost</th><th className="right">At price</th></tr></thead>
                <tbody>{d.inv.byCategory.map((c) => <tr key={c.category}><td>{c.category}</td><td className="right">{num(c.units)}</td><td className="right">{inr(c.costValue)}</td><td className="right">{inr(c.retailValue)}</td></tr>)}</tbody>
                <tfoot><tr><th>Total</th><th className="right">{num(d.inv.totals.units)}</th><th className="right">{inr(d.inv.totals.costValue)}</th><th className="right">{inr(d.inv.totals.retailValue)}</th></tr></tfoot></table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
