import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TopNav({ onLogout }) {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const isAdmin = role === "admin";
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const reportsMenuRef = useRef(null);
  const stockMenuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (event) => {
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(event.target)) {
        setShowReportsMenu(false);
      }
      if (stockMenuRef.current && !stockMenuRef.current.contains(event.target)) {
        setShowStockMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleLogout = () => {
    if (onLogout) return onLogout();
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div className="top-nav">
      <button className="btn ghost" onClick={() => navigate("/admin")}>
        {"\uD83C\uDFE0"} Home
      </button>

      <div className="menu-wrap" ref={reportsMenuRef}>
        <button className="btn ghost" onClick={() => setShowReportsMenu((v) => !v)}>
          Reports
        </button>
        {showReportsMenu && (
          <div className="menu-panel">
            <button className="btn secondary" onClick={() => { setShowReportsMenu(false); navigate("/reports"); }}>
              Sales Reports
            </button>
            <button className="btn secondary" onClick={() => { setShowReportsMenu(false); navigate("/reports/items"); }}>
              Item-wise Report
            </button>
            <button className="btn secondary" onClick={() => { setShowReportsMenu(false); navigate("/reports/customers"); }}>
              Customer-wise Report
            </button>
          </div>
        )}
      </div>

      <button className="btn ghost" onClick={() => navigate("/returns")}>Returns</button>

      <div className="menu-wrap" ref={stockMenuRef}>
        <button className="btn ghost" onClick={() => setShowStockMenu((v) => !v)}>
          Stock
        </button>
        {showStockMenu && (
          <div className="menu-panel">
            <button className="btn secondary" onClick={() => { setShowStockMenu(false); navigate("/stock"); }}>
              Current Stock
            </button>
            <button className="btn secondary" onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }}>
              Returned Stock
            </button>
          </div>
        )}
      </div>

      <button className="btn ghost" onClick={() => navigate("/customers")}>Customers</button>
      {!isAdmin && <button className="btn secondary" onClick={() => navigate("/end-day")}>End Day</button>}
      <button className="btn ghost" onClick={() => navigate("/billing")}>Billing</button>
      <button className="btn danger" onClick={handleLogout}>Logout</button>
    </div>
  );
}

