import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

function CustomerForm({ c, onClose, onSaved }) {
  const isNew = !c._id;
  const [f, setF] = useState({ name: c.name || "", phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/customers", f);
      else await api.put("/customers/" + c._id, f);
      onSaved();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <Modal title={isNew ? "Add customer" : "Edit customer"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="full">Name<input value={f.name} onChange={set("name")} required autoFocus /></label>
        <label>Phone<input value={f.phone} onChange={set("phone")} /></label>
        <label>Email<input type="email" value={f.email} onChange={set("email")} /></label>
        <label className="full">Address<input value={f.address} onChange={set("address")} /></label>
        <label className="full">Notes<input value={f.notes} onChange={set("notes")} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Customers() {
  const { can } = useAuth();
  const [res, setRes] = useState({ data: [], pagination: { total: 0, pages: 1 } });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page, limit: 10 });
    if (search) qs.set("search", search);
    api.get("/customers?" + qs).then((r) => { setRes(r); setErr(""); }).catch((e) => setErr(e.message));
  }, [page, search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const remove = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"?`)) return;
    try { await api.del("/customers/" + c._id); load(); } catch (e) { setErr(e.message); }
  };
  const { total, pages } = res.pagination;

  return (
    <>
      <div className="between wrap"><div><h1>Customers</h1><p className="muted sm">People and shops you sell to</p></div><button className="btn primary" onClick={() => setEdit({})}>+ Add Customer</button></div>
      <div className="card flush">
        <div className="toolbar"><input className="grow" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone or email" aria-label="Search customers" /></div>
        {err && <p className="err pad">{err}</p>}
        <div className="scroll"><div className="tbl">
          <div className="row c head"><span>CUSTOMER</span><span>PHONE</span><span>ADDRESS</span><span className="right">ACTIONS</span></div>
          {res.data.map((c) => (
            <div className="row c" key={c._id}>
              <div><b>{c.name}</b><div className="muted sm">{c.email || ""}</div></div>
              <span>{c.phone || "—"}</span><span className="muted">{c.address || "—"}</span>
              <div className="right"><button className="btn sm" onClick={() => setEdit(c)}>Edit</button>{can("admin", "manager") && <button className="btn sm" onClick={() => remove(c)}>Delete</button>}</div>
            </div>
          ))}
          {res.data.length === 0 && !err && <p className="muted pad">No customers found.</p>}
        </div></div>
        <div className="between pad foot"><span className="muted sm">{total} customer{total === 1 ? "" : "s"}</span>
          <span className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="sm">Page {page} of {pages || 1}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span></div>
      </div>
      {edit && <CustomerForm c={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}
