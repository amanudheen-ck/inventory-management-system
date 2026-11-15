import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../Modal.jsx";

const ROLES = {
  admin: "Admin: full access, manages users",
  manager: "Manager: stock out, edits, suppliers, reports",
  staff: "Staff: view products, stock in, make sales",
};
const tone = { admin: "blue", manager: "amber", staff: "green" };
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function UserForm({ u, self, onClose, onSaved }) {
  const isNew = !u._id;
  const [f, setF] = useState({ name: u.name || "", email: u.email || "", password: "", role: u.role || "staff", isActive: u.isActive ?? true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (isNew) await api.post("/auth/users", { name: f.name, email: f.email, password: f.password, role: f.role });
      else await api.put("/auth/users/" + u._id, self ? { name: f.name } : { name: f.name, role: f.role, isActive: f.isActive });
      onSaved();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? "Add user" : "Edit user"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="full">Name<input value={f.name} onChange={set("name")} required autoFocus /></label>
        <label className="full">Email (used to sign in)<input type="email" value={f.email} onChange={set("email")} required disabled={!isNew} /></label>
        {isNew && <label className="full">Password<input type="password" value={f.password} onChange={set("password")} minLength={8} required placeholder="At least 8 characters" autoComplete="new-password" /></label>}
        <label className="full">Role
          <select value={f.role} onChange={set("role")} disabled={self}>{Object.keys(ROLES).map((r) => <option key={r} value={r}>{r}</option>)}</select>
        </label>
        <p className="muted sm full">{ROLES[f.role]}</p>
        {!isNew && !self && <label className="full check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active (untick to block this user from signing in)</label>}
        {self && <p className="muted sm full">You cannot change your own role or status.</p>}
        {isNew && <p className="muted sm full">Share the email and password with the user yourself. They can change the password after signing in.</p>}
        {err && <p className="err full" role="alert">{err}</p>}
        <div className="full actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me, can } = useAuth();
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    api.get("/auth/users").then((r) => { setList(r.data); setErr(""); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { if (can("admin")) load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can("admin")) return <p className="err">Only admins can manage users.</p>;

  return (
    <>
      <div className="between wrap"><div><h1>Users</h1><p className="muted sm">People who can sign in to the web and mobile apps</p></div><button className="btn primary" onClick={() => setEdit({})}>+ Add User</button></div>
      <div className="card flush">
        {err && <p className="err pad">{err}</p>}
        <div className="scroll"><div className="tbl">
          <div className="row u head"><span>USER</span><span>ROLE</span><span>STATUS</span><span>ADDED</span><span className="right">ACTIONS</span></div>
          {(list || []).map((u) => (
            <div className="row u" key={u._id}>
              <div><b>{u.name}{u._id === me._id ? " (you)" : ""}</b><div className="muted sm">{u.email}</div></div>
              <span><span className={"chip " + tone[u.role]}>{u.role}</span></span>
              <span><span className={"chip " + (u.isActive ? "green" : "red")}>{u.isActive ? "Active" : "Blocked"}</span></span>
              <span className="muted">{day(u.createdAt)}</span>
              <div className="right"><button className="btn sm" onClick={() => setEdit(u)}>Edit</button></div>
            </div>
          ))}
          {list && list.length === 0 && <p className="muted pad">No users.</p>}
        </div></div>
      </div>
      {edit && <UserForm u={edit} self={edit._id === me._id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}
