import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, inr } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

const statusOf = (p) =>
  p.quantity === 0 ? ["Out of Stock", "red"] : p.quantity <= p.minStock ? ["Low Stock", "amber"] : ["In Stock", "green"];

function ProductForm({ product, onClose, onSaved }) {
  const isNew = !product._id;
  const [f, setF] = useState({
    name: product.name || "", sku: product.sku || "", barcode: product.barcode || "",
    category: product.category?._id || "", warehouse: product.warehouse?._id || "", supplier: product.supplier?._id || "",
    location: product.location || "", price: product.price ?? "", costPrice: product.costPrice ?? "",
    quantity: 0, minStock: product.minStock ?? 0, unit: product.unit || "pcs",
  });
  const [opts, setOpts] = useState({ cats: [], whs: [], sups: [] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/products/categories"), api.get("/warehouses"), api.get("/suppliers").catch(() => ({ data: [] }))])
      .then(([c, w, s]) => setOpts({ cats: c.data, whs: w.data, sups: s.data }))
      .catch((e) => setErr(e.message));
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body = { ...f, price: Number(f.price), costPrice: Number(f.costPrice || 0), minStock: Number(f.minStock || 0) };
    if (isNew) body.quantity = Number(f.quantity || 0);
    else delete body.quantity; // stock changes go through the Adjust dialog
    if (!body.sku) delete body.sku; // the server generates one
    try {
      if (isNew) await api.post("/products", body);
      else await api.put("/products/" + product._id, body);
      onSaved();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  const select = (k, label, items) => (
    <label>{label}
      <select value={f[k]} onChange={set(k)}>
        <option value="">None</option>
        {items.map((i) => <option key={i._id} value={i._id}>{i.name}{i.code ? ` (${i.code})` : ""}</option>)}
      </select>
    </label>
  );

  return (
    <Modal title={isNew ? "Add product" : "Edit product"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="full">Name<input value={f.name} onChange={set("name")} required /></label>
        <label>SKU<input value={f.sku} onChange={set("sku")} placeholder="Auto-generated if empty" /></label>
        <label>Barcode<input value={f.barcode} onChange={set("barcode")} /></label>
        {select("category", "Category", opts.cats)}
        {select("supplier", "Supplier", opts.sups)}
        {select("warehouse", "Warehouse", opts.whs)}
        <label>Location<input value={f.location} onChange={set("location")} placeholder="Aisle 2 · Shelf B-01" /></label>
        <label>Price (₹)<input type="number" min="0" step="0.01" value={f.price} onChange={set("price")} required /></label>
        <label>Cost price (₹)<input type="number" min="0" step="0.01" value={f.costPrice} onChange={set("costPrice")} /></label>
        {isNew && <label>Opening quantity<input type="number" min="0" step="1" value={f.quantity} onChange={set("quantity")} /></label>}
        <label>Minimum stock<input type="number" min="0" step="1" value={f.minStock} onChange={set("minStock")} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </Modal>
  );
}

function Adjust({ product, onClose, onSaved }) {
  const { can } = useAuth();
  const modes = can("admin", "manager") ? ["in", "out", "adjust"] : ["in"];
  const [mode, setMode] = useState("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const labels = { in: "Stock in", out: "Stock out", adjust: "Set exact count" };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const body = { productId: product._id, reason };
    if (mode === "adjust") body.newQuantity = Number(qty);
    else body.quantity = Number(qty);
    try {
      await api.post("/inventory/" + mode, body);
      onSaved();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <Modal title={`Adjust stock: ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="muted full">Current stock: <b>{product.quantity}</b> {product.unit}</p>
        <div className="full tabs">
          {modes.map((m) => <button type="button" key={m} className={"tab" + (m === mode ? " on" : "")} onClick={() => setMode(m)}>{labels[m]}</button>)}
        </div>
        <label>{mode === "adjust" ? "New quantity" : "Quantity"}<input type="number" min={mode === "adjust" ? 0 : 1} step="1" value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus /></label>
        <label>Reason{mode === "adjust" ? " (required)" : ""}<input value={reason} onChange={(e) => setReason(e.target.value)} required={mode === "adjust"} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Confirm</button></div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const { can } = useAuth();
  const manage = can("admin", "manager");
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get("search") || "");
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], pagination: { total: 0, pages: 1 } });
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);
  const [adj, setAdj] = useState(null);

  useEffect(() => { setQ(sp.get("search") || ""); setPage(1); }, [sp]);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page, limit: 8 });
    if (q) qs.set("search", q);
    if (low) qs.set("lowStock", "true");
    api.get("/products?" + qs).then((r) => { setRes(r); setErr(""); }).catch((e) => setErr(e.message));
  }, [q, low, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const saved = () => { setEdit(null); setAdj(null); load(); };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? It is hidden from the list; order history is kept.`)) return;
    try { await api.del("/products/" + p._id); load(); } catch (e) { setErr(e.message); }
  };
  const { total, pages } = res.pagination;

  return (
    <>
      <div className="between wrap">
        <div><h1>Products &amp; Stock</h1><p className="muted sm">SKU quantities, locations and pricing in Indian Rupees (₹)</p></div>
        {manage && <button className="btn primary" onClick={() => setEdit({})}>+ Add Product</button>}
      </div>

      <div className="card flush">
        <div className="toolbar">
          <button className={"tab" + (!low ? " on" : "")} onClick={() => { setLow(false); setPage(1); }}>All items</button>
          <button className={"tab" + (low ? " on" : "")} onClick={() => { setLow(true); setPage(1); }}>Low / out of stock</button>
          <input className="grow" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, SKU, barcode or location" aria-label="Search products" />
        </div>
        {err && <p className="err pad">{err}</p>}
        <div className="scroll"><div className="tbl">
          <div className="row head"><span>PRODUCT</span><span>SKU &amp; BARCODE</span><span>CATEGORY</span><span>LOCATION</span><span className="right">STOCK</span><span>STATUS</span><span>PRICE</span><span className="right">ACTIONS</span></div>
          {res.data.map((p) => {
            const [label, tone] = statusOf(p);
            return (
              <div className="row" key={p._id}>
                <div><b>{p.name}</b><div className="muted sm">Min threshold: {p.minStock} {p.unit}</div></div>
                <div><b className="sm">{p.sku}</b><div className="muted sm">{p.barcode || "No barcode"}</div></div>
                <span className="muted">{p.category?.name || "—"}</span>
                <span>{p.warehouse ? <span className="loc">{p.warehouse.code}{p.location ? ` · ${p.location}` : ""}</span> : <span className="muted">—</span>}</span>
                <div className="right"><b className={"qty " + tone}>{p.quantity}</b><div className="muted sm">{p.unit}</div></div>
                <span><span className={"chip " + tone}>{label}</span></span>
                <b>{inr(p.price)}</b>
                <div className="right"><button className="btn sm blue" onClick={() => setAdj(p)}>Adjust</button>{manage && <button className="btn sm" onClick={() => setEdit(p)}>Edit</button>}{can("admin") && <button className="btn sm" onClick={() => remove(p)}>Delete</button>}</div>
              </div>
            );
          })}
          {res.data.length === 0 && !err && <p className="muted pad">No products found.</p>}
        </div></div>
        <div className="between pad foot"><span className="muted sm">{total} product{total === 1 ? "" : "s"}</span>
          <span className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="sm">Page {page} of {pages || 1}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span>
        </div>
      </div>

      {edit && <ProductForm product={edit} onClose={() => setEdit(null)} onSaved={saved} />}
      {adj && <Adjust product={adj} onClose={() => setAdj(null)} onSaved={saved} />}
    </>
  );
}
