import { useState } from "react";
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Warehouses from "./pages/Warehouses.jsx";
import Orders from "./pages/Orders.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import Customers from "./pages/Customers.jsx";

const NAV = [
  ["/", "Dashboard"],
  ["/products", "Products & Stock"],
  ["/warehouses", "Warehouses"],
  ["/orders", "Orders & Invoicing"],
  ["/customers", "Customers"],
  ["/suppliers", "Suppliers"],
  ["/reports", "Reports & Analytics"],
  ["/users", "Users"],
];

function Shell() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  if (!user) return <Navigate to="/login" replace />;

  const search = (e) => {
    e.preventDefault();
    navigate("/products?search=" + encodeURIComponent(q.trim()));
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="logo">S</span>
          <div><b>Smart Inventory</b><small>WAREHOUSE OS · IN</small></div>
        </div>
        <div className="label">MAIN MANAGEMENT</div>
        {NAV.filter(([to]) => (to === "/users" ? can("admin") : can("admin", "manager") || !["/suppliers", "/reports"].includes(to))).map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "nav" + (isActive ? " on" : "")}>{label}</NavLink>
        ))}
      </aside>
      <div className="main">
        <header>
          <form onSubmit={search} className="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, barcode or product name..." aria-label="Search products" />
          </form>
          <div className="who">
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <div><b>{user.name}</b><small>{user.role}</small></div>
            <button className="btn sm" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="orders" element={<Orders />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="customers" element={<Customers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
