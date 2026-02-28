import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TopNav({
  onLogout,
  title,
  subtitle = "Minimal control center for your POS",
  showPartnerLogo = true,
}) {
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
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <div className={`top-nav-shell${title ? " top-nav-shell--with-title" : ""}`}>
      <div className="top-nav">
      <div className="top-nav-track">
        <div className="top-nav-group">
          <button
            className="btn ghost icon-only home-btn"
            onClick={() => navigate("/admin")}
            aria-label="Home"
            title="Home"
          >
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
  <path
    d="M4 10.8L12 4l8 6.8v8.2a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.2z"
    fill="currentColor"
  />
</svg>
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
          {isAdmin && <button className="btn success" onClick={() => navigate("/pending-sales")}>Pending Sales</button>}
          {!isAdmin && <button className="btn secondary" onClick={() => navigate("/end-day")}>End Day</button>}
          <button className="btn ghost" onClick={() => navigate("/billing")}>Billing</button>
        </div>

        <div className="top-nav-actions">
          <button className="btn danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      </div>
      {title ? (
        <div className="top-nav-pagehead">
          <div className="top-nav-pagehead-title">{title}</div>
          <div className="top-nav-pagehead-sub">
            <span>{subtitle}</span>
            {showPartnerLogo ? (
              <span className="top-nav-partner-logo">
                <img src="/valvoline.png" alt="Valvoline" />
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
