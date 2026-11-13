import { useCallback, useEffect, useState } from "react";
import { api, num } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

const tone = { online: "green", degraded: "amber", offline: "red" };

function AddWarehouse({ onClose, onSaved }) {
  const [f, setF] = useState({ name: "", code: "", city: "", state: "", capacity: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/warehouses", { ...f, capacity: Number(f.capacity || 0) });
      onSaved();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <Modal title="Add warehouse" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="full">Name<input value={f.name} onChange={set("name")} required autoFocus /></label>
        <label>Code<input value={f.code} onChange={set("code")} placeholder="BHW-01" required /></label>
        <label>Capacity (units)<input type="number" min="0" step="1" value={f.capacity} onChange={set("capacity")} /></label>
        <label>City<input value={f.city} onChange={set("city")} /></label>
        <label>State<input value={f.state} onChange={set("state")} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Warehouses() {
  const { can } = useAuth();
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get("/warehouses").then((r) => setList(r.data)).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <div className="between wrap">
        <div><h1>Warehouses &amp; Distribution Centers</h1><p className="muted sm">Network capacity and stock held at each site</p></div>
        {can("admin", "manager") && <button className="btn primary" onClick={() => setAdding(true)}>+ Add Warehouse</button>}
      </div>
      {err && <p className="err">{err}</p>}
      {list && list.length === 0 && <div className="card empty"><p>No warehouses yet. Add your first one.</p></div>}
      <div className="grid2">
        {(list || []).map((w) => {
          const u = w.stats.utilization;
          return (
            <div className="card" key={w._id}>
              <div className="between">
                <div><b>{w.name}</b> <span className="code">{w.code}</span><div className="muted sm">{[w.city, w.state].filter(Boolean).join(", ") || "No address"}</div></div>
                <span className={"chip " + (tone[w.status] || "blue")}>{w.status}</span>
              </div>
              <div className="between sm wmt"><span className="muted">Capacity utilization</span><b>{u === null ? "No capacity set" : `${u}% (${num(w.stats.units)} / ${num(w.capacity)} units)`}</b></div>
              <div className="meter"><i style={{ width: `${Math.min(100, u ?? 0)}%` }} /></div>
              <div className="between sm foot2"><span className="muted">Active SKUs: <b>{num(w.stats.activeSkus)}</b></span><span className="muted">Low stock: <b>{w.stats.lowStockItems}</b></span></div>
            </div>
          );
        })}
      </div>
      {adding && <AddWarehouse onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </>
  );
}
