import React, { useCallback, useEffect, useMemo, useState } from "react";
import TopNav from "./TopNav";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";
import { useNavigate } from "react-router-dom";
import ReceiptPrint from "./ReceiptPrint";
import { applyReceiptPrint, cleanupReceiptPrint } from "./printUtils";

export default function PendingSales() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewRow, setViewRow] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);
  const [printLayoutMode, setPrintLayoutMode] = useState("a4");

  const getBillLayoutFromStorage = () => {
    const DEFAULT_BILL_LAYOUT = {
      companyName: "Apex Logistics",
      headerText: "Aluviharaya, Matale\nMobile: +94770654279\nThank you! Visit again",
      footerText: "Powered by J&co.",
      creditPeriodDays: 55,
      showItemsHeading: true,
      showCustomer: true,
      showTotals: true,
      showPayment: true,
    };

    try {
      const raw = localStorage.getItem("billLayout");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_BILL_LAYOUT, ...parsed };
      }
    } catch {
      // ignore bad layout
    }
    return DEFAULT_BILL_LAYOUT;
  };

  const openPrintPreview = useCallback((payload) => {
    setPrintPayload(payload);
    setPrintLayoutMode("a4");
    setShowPrint(true);
  }, []);

  const confirmPrint = useCallback((mode = "a4") => {
    setPrintLayoutMode(mode);
    applyReceiptPrint(mode);
    const cleanup = () => {
      cleanupReceiptPrint();
      window.onafterprint = null;
      window.removeEventListener("focus", cleanup);
    };
    window.onafterprint = cleanup;
    window.addEventListener("focus", cleanup, { once: true });
    setTimeout(() => window.print(), 100);
  }, []);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      setMsg("");
      const data = await apiFetch("/pending-sales");
      const list = Array.isArray(data) ? data : [];
      setRows(list.filter((r) => String(r?.pending?.status || "pending") === "pending"));
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const payload = r?.pending?.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const itemCount = items.reduce(
          (sum, it) => sum + Number(it?.qty || 0) + Number(it?.freeQty || 0),
          0
        );
        return {
          ...r,
          _payload: payload,
          _itemCount: itemCount,
          _customerName: payload?.customer?.name || "-",
        };
      }),
    [rows]
  );

  const approveRow = async (row) => {
    try {
      setLoading(true);
      setMsg("");
      const payload = row?._payload || row?.pending?.payload;
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error("Pending sale payload is invalid");
      }
      const saleRes = await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const saleId = saleRes?.sale?.id || saleRes?.id || null;
      await apiFetch(`/pending-sales/${row.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ saleId }),
      });
      if (saleId) {
        try {
          const fullSale = await apiFetch(`/sales/${saleId}`);
          const saleItems = Array.isArray(fullSale?.saleItems) ? fullSale.saleItems : [];
          const items = saleItems.map((si) => ({
            barcode: si?.barcode || si?.product?.barcode || "",
            name: si?.product?.name || si?.barcode || "Item",
            qty: Number(si?.qty || 0),
            freeQty: Number(si?.freeQty || 0),
            price: Number(si?.price || 0),
          }));
          const subtotal = items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0);
          const discount = Number(fullSale?.discountValue || 0);
          const grandTotal = Number(fullSale?.total || 0);
          const paymentMethod = String(fullSale?.paymentMethod || payload?.paymentMethod || "cash");
          const cashReceived = Number(fullSale?.cashReceived || 0);
          const balance = paymentMethod === "cash" ? Math.max(0, cashReceived - grandTotal) : 0;
          openPrintPreview({
            saleId,
            dateText: fullSale?.createdAt ? new Date(fullSale.createdAt).toLocaleString() : new Date().toLocaleString(),
            staffName: fullSale?.createdBy?.username || row?.pending?.requestedBy?.username || "",
            customerId: fullSale?.customerId || fullSale?.customer?.id || payload?.customer?.id || "",
            customerName: fullSale?.customer?.name || fullSale?.customerName || payload?.customer?.name || "",
            customerPhone: fullSale?.customer?.phone || payload?.customer?.phone || "",
            customerAddress: fullSale?.customer?.address || payload?.customer?.address || "",
            items,
            subtotal,
            discount,
            grandTotal,
            paymentMethod,
            cashReceived,
            balance,
          });
        } catch {
          // approval should remain successful even if preview payload fetch fails
        }
      }
      setMsg(`Approved pending sale #${row.id}${saleId ? ` -> Sale #${saleId}` : ""}`);
      setViewRow(null);
      await loadRows();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete pending sale request #${row.id}?`)) return;
    try {
      setLoading(true);
      setMsg("");
      await apiFetch(`/pending-sales/${row.id}`, { method: "DELETE" });
      setMsg(`Deleted pending sale #${row.id}`);
      if (viewRow?.id === row.id) setViewRow(null);
      await loadRows();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <TopNav
        title="Pending Sales | Apex Logistics"
        subtitle="Minimal control center for your POS"
      />

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        <button className="btn ghost" onClick={loadRows} disabled={loading}>
          Refresh
        </button>
      </div>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}

      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <table border="0" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ color: "#000" }}>
            <tr>
              <th style={{ textAlign: "left" }}>Request ID</th>
              <th style={{ textAlign: "left" }}>Customer</th>
              <th style={{ textAlign: "left" }}>Items</th>
              <th style={{ textAlign: "left" }}>Payment</th>
              <th style={{ textAlign: "left" }}>Requested By</th>
              <th style={{ textAlign: "left" }}>Updated</th>
              <th style={{ textAlign: "left" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                <td>#{r.id}</td>
                <td>{r._customerName}</td>
                <td>{formatNumber(r._itemCount)}</td>
                <td>{String(r._payload?.paymentMethod || "cash")}</td>
                <td>{r?.pending?.requestedBy?.username || "-"}</td>
                <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-"}</td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setViewRow(r)}>View</button>
                  <button onClick={() => navigate(`/billing?pendingId=${r.id}`)}>Edit</button>
                  <button onClick={() => approveRow(r)} disabled={loading}>Approve</button>
                  <button onClick={() => deleteRow(r)} disabled={loading}>Delete</button>
                </td>
              </tr>
            ))}
            {!loading && enriched.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: 20 }}>
                  No pending sales
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {viewRow && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 99999,
          }}
          onClick={() => setViewRow(null)}
        >
          <div
            style={{ background: "#fff", color: "#000", width: "min(900px, 95vw)", maxHeight: "90vh", overflow: "auto", borderRadius: 10, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Pending Sale #{viewRow.id}</h3>
              <button onClick={() => setViewRow(null)}>X</button>
            </div>
            <div style={{ marginTop: 10, lineHeight: 1.8 }}>
              <div><b>Customer:</b> {viewRow._payload?.customer?.name || "-"}</div>
              <div><b>Phone:</b> {viewRow._payload?.customer?.phone || "-"}</div>
              <div><b>Address:</b> {viewRow._payload?.customer?.address || "-"}</div>
              <div><b>Payment:</b> {String(viewRow._payload?.paymentMethod || "cash")}</div>
              <div><b>Discount:</b> {String(viewRow._payload?.discountType || "none")} / {formatNumber(viewRow._payload?.discountValue || 0)}</div>
              {viewRow._payload?.chequeDate ? <div><b>Cheque Date:</b> {viewRow._payload.chequeDate}</div> : null}
              <div><b>Requested By:</b> {viewRow?.pending?.requestedBy?.username || "-"}</div>
            </div>
            <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead style={{ color: "#000" }}>
                <tr>
                  <th>Barcode</th>
                  <th>Qty</th>
                  <th>Free Qty</th>
                  <th>Item Discount Type</th>
                  <th>Item Discount Value</th>
                </tr>
              </thead>
              <tbody>
                {(viewRow._payload?.items || []).map((it, idx) => (
                  <tr key={`${it.barcode || "item"}-${idx}`}>
                    <td>{it.barcode || "-"}</td>
                    <td>{formatNumber(it.qty || 0)}</td>
                    <td>{formatNumber(it.freeQty || 0)}</td>
                    <td>{String(it.itemDiscountType || "none")}</td>
                    <td>{formatNumber(it.itemDiscountValue || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => navigate(`/billing?pendingId=${viewRow.id}`)}>Edit in Billing</button>
              <button onClick={() => approveRow(viewRow)} disabled={loading}>Approve</button>
              <button onClick={() => deleteRow(viewRow)} disabled={loading}>Delete</button>
              <button onClick={() => setViewRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showPrint && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 15,
              borderRadius: 10,
              width: "min(980px, 96vw)",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Print Preview</h3>
              <button onClick={() => setShowPrint(false)}>X</button>
            </div>
            <div id="print-area" style={{ marginTop: 10, overflowX: "hidden" }}>
              <ReceiptPrint
                layout={(() => {
                  const layout = getBillLayoutFromStorage();
                  return {
                    ...layout,
                    headerLines: String(layout.headerText || "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                    footerLines: String(layout.footerText || "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  };
                })()}
                layoutMode={printLayoutMode}
                saleId={printPayload?.saleId || ""}
                dateText={printPayload?.dateText || ""}
                customerId={printPayload?.customerId || ""}
                customerName={printPayload?.customerName || ""}
                customerPhone={printPayload?.customerPhone || ""}
                customerAddress={printPayload?.customerAddress || ""}
                staffName={printPayload?.staffName || ""}
                items={printPayload?.items || []}
                subtotal={printPayload?.subtotal || 0}
                discount={printPayload?.discount || 0}
                grandTotal={printPayload?.grandTotal || 0}
                paymentMethod={printPayload?.paymentMethod || "cash"}
                cashReceived={printPayload?.cashReceived || 0}
                balance={printPayload?.balance || 0}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => confirmPrint("a4")}>Print Now</button>
              <button onClick={() => setShowPrint(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
