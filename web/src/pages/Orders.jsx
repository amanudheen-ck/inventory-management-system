import { useCallback, useEffect, useState } from "react";
import { api, inr } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

const tone = { completed: "green", cancelled: "red", paid: "green", unpaid: "amber", partial: "blue" };
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function NewOrder({ onClose, onSaved }) {
  const [cart, setCart] = useState([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [code, setCode] = useState("");
  const [customers, setCustomers] = useState([]);
  const [f, setF] = useState({ customer: "", discount: 0, taxRate: 0, paymentMethod: "cash", paymentStatus: "paid" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/customers?limit=100").then((r) => setCustomers(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(() => api.get("/products?limit=6&search=" + encodeURIComponent(q)).then((r) => setHits(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = (p) => {
    if (p.quantity <= 0) return setErr(`${p.name} is out of stock`);
    setErr("");
    setCart((c) => c.some((i) => i.id === p._id)
      ? c.map((i) => (i.id === p._id ? { ...i, qty: Math.min(i.qty + 1, i.stock) } : i))
      : [...c, { id: p._id, name: p.name, price: p.price, stock: p.quantity, qty: 1 }]);
    setQ("");
    setHits([]);
  };
  const scan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try { add((await api.get("/products/barcode/" + encodeURIComponent(code.trim()))).data); setCode(""); }
    catch (ex) { setErr(ex.message); }
  };
  const setQty = (id, v) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(Number(v) || 1, i.stock)) } : i)));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const disc = Number(f.discount) || 0;
  const tax = ((subtotal - disc) * (Number(f.taxRate) || 0)) / 100;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!cart.length) return setErr("Add at least one product");
    setBusy(true);
    setErr("");
    try {
      await api.post("/orders", {
        customer: f.customer || undefined,
        items: cart.map((i) => ({ productId: i.id, quantity: i.qty })),
        discount: disc, taxRate: Number(f.taxRate) || 0, paymentMethod: f.paymentMethod, paymentStatus: f.paymentStatus,
      });
      onSaved();
    } catch (ex) { setErr(ex.message); setBusy(false); }
  };

  return (
    <Modal title="New sale" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form">
          <label>Scan barcode / SKU<input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan(e)} placeholder="Scan, then press Enter" autoFocus /></label>
          <label>Search product<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or barcode" /></label>
        </div>
        {hits.length > 0 && <div className="hits">{hits.map((p) => (
          <button type="button" className="hit" key={p._id} onClick={() => add(p)}><span>{p.name} <span className="muted sm">{p.sku}</span></span><b>{inr(p.price)} · {p.quantity} in stock</b></button>
        ))}</div>}
        <div className="cart">
          {cart.length === 0 && <p className="muted sm">No items yet.</p>}
          {cart.map((i) => (
            <div className="crow" key={i.id}>
              <div><b>{i.name}</b><div className="muted sm">{inr(i.price)} each · {i.stock} in stock</div></div>
              <input type="number" min="1" max={i.stock} aria-label={`Quantity of ${i.name}`} value={i.qty} onChange={(e) => setQty(i.id, e.target.value)} />
              <div className="right"><b>{inr(i.price * i.qty)}</b> <button type="button" className="x" aria-label={`Remove ${i.name}`} onClick={() => setCart(cart.filter((c) => c.id !== i.id))}>×</button></div>
            </div>
          ))}
        </div>
        <div className="form">
          <label>Customer<select value={f.customer} onChange={set("customer")}><option value="">Walk-in customer</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
          <label>Payment method<select value={f.paymentMethod} onChange={set("paymentMethod")}>{["cash", "card", "upi", "bank_transfer", "other"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select></label>
          <label>Discount (₹)<input type="number" min="0" value={f.discount} onChange={set("discount")} /></label>
          <label>Tax (%)<input type="number" min="0" max="100" value={f.taxRate} onChange={set("taxRate")} /></label>
          <label>Payment status<select value={f.paymentStatus} onChange={set("paymentStatus")}><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option></select></label>
        </div>
        <div className="totals"><div><span>Subtotal</span><span>{inr(subtotal)}</span></div><div><span>Discount</span><span>-{inr(disc)}</span></div><div><span>Tax</span><span>{inr(tax)}</span></div><div className="grand"><span>Total (estimate)</span><span>{inr(subtotal - disc + tax)}</span></div></div>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="actions pad"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Complete sale"}</button></div>
      </form>
    </Modal>
  );
}

function Invoice({ id, onClose, onChanged }) {
  const { can } = useAuth();
  const manage = can("admin", "manager");
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get(`/orders/${id}/invoice`).then((r) => setInv(r.data)).catch((e) => setErr(e.message)); }, [id]);

  const act = async (path, body) => {
    if (path === "cancel" && !window.confirm("Cancel this order and return the items to stock?")) return;
    try { await api.patch(`/orders/${id}/${path}`, body); onChanged(); } catch (ex) { setErr(ex.message); }
  };

  return (
    <Modal title="Invoice" onClose={onClose}>
      {err && <p className="err" role="alert">{err}</p>}
      {!inv ? <p className="muted">Loading…</p> : (
        <>
          <div className="invoice">
            <div className="between"><div><h2>{inv.seller.name}</h2><div className="muted sm">Invoice {inv.invoiceNumber}</div></div><div className="right"><b>{day(inv.date)}</b><div><span className={"chip " + tone[inv.status]}>{inv.status}</span></div></div></div>
            <p className="sm"><span className="muted">Bill to:</span> <b>{inv.customer.name}</b>{inv.customer.phone ? ` · ${inv.customer.phone}` : ""}</p>
            <table className="itable"><thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Price</th><th className="right">Total</th></tr></thead>
              <tbody>{inv.items.map((i, n) => <tr key={n}><td>{i.name}<div className="muted sm">{i.sku}</div></td><td className="right">{i.quantity}</td><td className="right">{inr(i.unitPrice)}</td><td className="right">{inr(i.lineTotal)}</td></tr>)}</tbody></table>
            <div className="totals"><div><span>Subtotal</span><span>{inr(inv.subtotal)}</span></div><div><span>Discount</span><span>-{inr(inv.discount)}</span></div><div><span>Tax ({inv.taxRate}%)</span><span>{inr(inv.tax)}</span></div><div className="grand"><span>Total</span><span>{inr(inv.total)}</span></div></div>
            <p className="muted sm">Payment: {inv.paymentStatus} · {inv.paymentMethod.replace("_", " ")}</p>
          </div>
          <div className="actions pad">
            <button className="btn" onClick={() => window.print()}>Print</button>
            {manage && inv.status === "completed" && <button className="btn" onClick={() => act("cancel")}>Cancel order</button>}
            {manage && inv.status === "completed" && inv.paymentStatus !== "paid" && <button className="btn primary" onClick={() => act("payment", { paymentStatus: "paid" })}>Mark as paid</button>}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [res, setRes] = useState({ data: [], pagination: { total: 0, pages: 1 } });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page, limit: 10 });
    if (status) qs.set("status", status);
    if (search) qs.set("search", search);
    api.get("/orders?" + qs).then((r) => { setRes(r); setErr(""); }).catch((e) => setErr(e.message));
  }, [page, status, search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const done = () => { setCreating(false); setView(null); load(); };
  const { total, pages } = res.pagination;

  return (
    <>
      <div className="between wrap"><div><h1>Orders &amp; Invoicing</h1><p className="muted sm">Sales, invoices and payments</p></div><button className="btn primary" onClick={() => setCreating(true)}>+ New sale</button></div>
      <div className="card flush">
        <div className="toolbar">
          {[["", "All"], ["completed", "Completed"], ["cancelled", "Cancelled"]].map(([v, l]) => <button key={v} className={"tab" + (status === v ? " on" : "")} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}
          <input className="grow" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search order number" aria-label="Search orders" />
        </div>
        {err && <p className="err pad">{err}</p>}
        <div className="scroll"><div className="tbl">
          <div className="row o head"><span>ORDER</span><span>CUSTOMER</span><span>DATE</span><span className="right">TOTAL</span><span>PAYMENT</span><span>STATUS</span></div>
          {res.data.map((o) => (
            <div className="row o" key={o._id}>
              <button className="link" onClick={() => setView(o._id)}>{o.orderNumber}</button>
              <span>{o.customer?.name || <span className="muted">Walk-in</span>}</span>
              <span className="muted">{day(o.createdAt)}</span>
              <b className="right">{inr(o.total)}</b>
              <span><span className={"chip " + tone[o.paymentStatus]}>{o.paymentStatus}</span></span>
              <span><span className={"chip " + tone[o.status]}>{o.status}</span></span>
            </div>
          ))}
          {res.data.length === 0 && !err && <p className="muted pad">No orders found.</p>}
        </div></div>
        <div className="between pad foot"><span className="muted sm">{total} order{total === 1 ? "" : "s"}</span>
          <span className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="sm">Page {page} of {pages || 1}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span></div>
      </div>
      {creating && <NewOrder onClose={() => setCreating(false)} onSaved={done} />}
      {view && <Invoice id={view} onClose={() => setView(null)} onChanged={done} />}
    </>
  );
}
