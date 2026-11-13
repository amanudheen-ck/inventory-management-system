import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

function Form({ s, onClose, onSaved }) {
  const isNew = !s._id;
  const [f, setF] = useState({ name: s.name || "", contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", gstin: s.gstin || "", address: s.address || "", isActive: s.isActive ?? true });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...f };
    if (isNew) delete body.isActive;
    try {
      if (isNew) await api.post("/suppliers", body);
      else await api.put("/suppliers/" + s._id, body);
      onSaved();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <Modal title={isNew ? "Add supplier" : "Edit supplier"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="full">Name<input value={f.name} onChange={set("name")} required autoFocus /></label>
        <label>Contact person<input value={f.contactPerson} onChange={set("contactPerson")} /></label>
        <label>Phone<input value={f.phone} onChange={set("phone")} /></label>
        <label>Email<input type="email" value={f.email} onChange={set("email")} /></label>
        <label>GSTIN<input value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="15 characters" /></label>
        <label className="full">Address<input value={f.address} onChange={set("address")} /></label>
        {!isNew && <label className="full check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active supplier</label>}
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Suppliers() {
  const { can } = useAuth();
  const [res, setRes] = useState({ data: [], pagination: { total: 0, pages: 1 } });
  const [search, setSearch] = useState("");
  const [inactive, setInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page, limit: 10 });
    if (search) qs.set("search", search);
    if (inactive) qs.set("includeInactive", "true");
    api.get("/suppliers?" + qs).then((r) => { setRes(r); setErr(""); }).catch((e) => setErr(e.message));
  }, [page, search, inactive]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  if (!can("admin", "manager")) return <p className="err">Only admins and managers can manage suppliers.</p>;
  const { total, pages } = res.pagination;

  return (
    <>
      <div className="between wrap"><div><h1>Suppliers</h1><p className="muted sm">Vendors you buy stock from</p></div><button className="btn primary" onClick={() => setEdit({})}>+ Add Supplier</button></div>
      <div className="card flush">
        <div className="toolbar">
          <input className="grow" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, contact, phone or GSTIN" aria-label="Search suppliers" />
          <label className="check"><input type="checkbox" checked={inactive} onChange={(e) => { setInactive(e.target.checked); setPage(1); }} /> Show inactive</label>
        </div>
        {err && <p className="err pad">{err}</p>}
        <div className="scroll"><div className="tbl">
          <div className="row s head"><span>SUPPLIER</span><span>CONTACT</span><span>PHONE</span><span>GSTIN</span><span>STATUS</span><span className="right">ACTIONS</span></div>
          {res.data.map((s) => (
            <div className="row s" key={s._id}>
              <div><b>{s.name}</b><div className="muted sm">{s.email || ""}</div></div>
              <span>{s.contactPerson || "—"}</span><span>{s.phone || "—"}</span><span className="sm">{s.gstin || "—"}</span>
              <span><span className={"chip " + (s.isActive ? "green" : "red")}>{s.isActive ? "Active" : "Inactive"}</span></span>
              <div className="right"><button className="btn sm" onClick={() => setEdit(s)}>Edit</button></div>
            </div>
          ))}
          {res.data.length === 0 && !err && <p className="muted pad">No suppliers found.</p>}
        </div></div>
        <div className="between pad foot"><span className="muted sm">{total} supplier{total === 1 ? "" : "s"}</span>
          <span className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="sm">Page {page} of {pages || 1}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span></div>
      </div>
      {edit && <Form s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}
