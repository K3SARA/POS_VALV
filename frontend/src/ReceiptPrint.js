import React from "react";
import { formatMoney, formatNumber } from "./utils/format";

export default function ReceiptPrint(props) {
  const publicBase = process.env.PUBLIC_URL || "";
  const asset = (file) => {
    const cleanFile = String(file || "").replace(/^\//, "");
    const cleanBase = String(publicBase || "").replace(/\/$/, "");
    if (cleanBase) return `${cleanBase}/${cleanFile}`;
    try {
      if (typeof document !== "undefined" && document.baseURI) {
        return new URL(cleanFile, document.baseURI).toString();
      }
    } catch {
      // fallback below
    }
    return `/${cleanFile}`;
  };
  const {
    layout = {},
    companyName = layout.companyName || "Apex Logistics",
    layoutMode = "3inch", // "3inch" | "a4"
    headerLines = Array.isArray(layout.headerLines) ? layout.headerLines : [],
    footerLines = Array.isArray(layout.footerLines) ? layout.footerLines : [],
    showItemsHeading = layout.showItemsHeading ?? true,
    showCustomer = layout.showCustomer ?? true,
    showTotals = layout.showTotals ?? true,
    showPayment = layout.showPayment ?? true,
    saleId = "",
    dateText = "",
    items = [],
    subtotal = 0,
    discount = 0,
    grandTotal = 0,
    customerName = "",
    customerPhone = "",
    customerAddress = "",
    paymentMethod = "cash",
    cashReceived = "",
    balance = 0,
  } = props;

  const freeItems = (items || [])
    .map((i) => ({
      name: i.name,
      qty: Number(i.freeIssue ? i.qty : i.freeQty || 0) || 0,
    }))
    .filter((i) => i.qty > 0);
  const freeItemsText = freeItems.map((i) => `${i.name} x ${Number(i.qty || 0).toLocaleString()}`).join(", ");
  const money = (v) => formatMoney(v);
  const count = (v) => formatNumber(v);
  const invoiceDate = dateText || new Date().toLocaleString();
  const safeRoute = props.route || props.dayRoute || "-";
  const safeUser = props.staffName || props.username || "-";
  const rows = items.map((i, idx) => {
    const price = Number(i.price) || 0;
    const qty = Number(i.qty) || 0;
    const freeQty = Number(i.freeIssue ? i.qty : i.freeQty || 0) || 0;
    const base = price * qty;
    const t = i.itemDiscountType || "none";
    const v = Number(i.itemDiscountValue || 0);
    let itemDiscount = 0;
    if (t === "amount") {
      itemDiscount = Math.max(0, Math.min(v, base));
    } else if (t === "percent") {
      const pct = Math.max(0, Math.min(v, 100));
      itemDiscount = Math.round((base * pct) / 100);
    }
    return {
      key: `${i.barcode}-${i.name}-${idx}`,
      code: i.barcode || "-",
      name: i.name || "-",
      qty,
      freeQty,
      unitPrice: price,
      total: base,
      discount: itemDiscount,
      lineTotal: Math.max(0, base - itemDiscount),
    };
  });
  const totalItemDiscount = rows.reduce((sum, row) => sum + Number(row.discount || 0), 0);

  if (layoutMode === "a4") {
    return (
      <div className="receipt receipt-template-a4">
        <div className="inv-header">
          <div className="inv-brand-left">
            <img
              src={asset("bill-unitedmotors.png")}
              alt="United Motors"
              className="inv-logo-left"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = asset("logo.png");
              }}
            />
            <div>
              <div className="inv-title-sub">UNITED MOTORS<br />LANKA PLC</div>
              <div className="inv-sub">VALVOLINE DEPARTMENT</div>
              <div className="inv-sub-small">Company Reg No : P.Q 74</div>
              <div className="inv-sub-small">Vat Reg No : 294 000038 7000</div>
            </div>
            
          </div>
          <div className="inv-brand-right">
            <img
              src={asset("bill-valvoline.png")}
              alt="Valvoline"
              className="inv-logo-valvoline"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = asset("valvoline.png");
              }}
            />
            <div className="inv-title-main-role">AUTHORIZED VALVOLINE DISTRIBUTOR</div>
            <div className="inv-brand-right-row">
              <img
                src={asset("apex_logo.png")}
                alt="Apex Logistics"
                className="inv-logo-apex"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = asset("logo512.png");
                }}
              />
              <div className="apex-address">
                <div className="inv-title-sub">APEX LOGISTICS (PVT) LTD</div>
                <div className="inv-sub">NO.854,ALUVIHARAYA, MATALE</div>
                <div className="inv-sub">066 2222371 / 0774320769</div>
              </div>
            </div>
          </div>
        </div>

        <div className="inv-divider" />

        <div className="inv-panels">
          <div className="inv-panel">
            <div className="inv-panel-title">Customer Details</div>
            
            <div>ID : {props.customerId || "-"}</div>
            <div>Name : {customerName || "-"}</div>
            <div>Address : {customerAddress || "-"}</div>
            <div>Contact No : {customerPhone || "-"}</div>
            <div>Root : {safeRoute}</div>
            <div>Vat Reg : -</div>
          </div>
          <div className="inv-panel">
            <div className="inv-panel-title">Invoice</div>
            <div>Invoice Date : {invoiceDate}</div>
            <div>System Invoice Number : {saleId || "-"}</div>
            <div>Sales Invoice Staff : {safeUser}</div>
            <div>SalePoint : KANDY</div>
          </div>
        </div>

        <table className="inv-table">
          <thead>
            <tr>
              <th>ITEM CODE</th>
              <th>DESCRIPTION</th>
              <th>QTY</th>
              <th>FREE QTY</th>
              <th>UNIT PRICE</th>
              <th>TOTAL</th>
              <th>DISCOUNT</th>
              <th>TOTAL VALUE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td>{count(r.qty)}</td>
                <td>{r.freeQty ? count(r.freeQty) : "-"}</td>
                <td>{money(r.unitPrice)}</td>
                <td>{money(r.total)}</td>
                <td>{money(r.discount)}</td>
                <td>{money(r.lineTotal)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>No items</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="inv-bottom-grid">
          <div className="inv-bank-box">
            <div className="inv-bank-headline">Cheques should be drawn in favor of <b>APEX LOGISTICS</b> &amp; Crossed <b>A/C Payee Only</b></div>
            <div className="inv-bank-title">Bank Details:</div>
            <div className="inv-bank-box_sub">
              <div className="inv-bank-line">Account Name - APEX LOGISTICS (PVT) LIMITED</div>
              <div className="inv-bank-line">Bank Name - PAN ASIA BANK</div>
              <div className="inv-bank-line">Acc No - 103911100125</div>
            </div>
          </div>
          <div className="inv-total-box">
            <div className="inv-total-row inv-total-row-main">
              <span>TOTAL :</span><span>{money(subtotal)}</span>
            </div>
            <div className="inv-total-row inv-total-row-main">
              <span>ITEM DISCOUNT :</span><span>{money(totalItemDiscount)}</span>
            </div>
            {freeItems.length > 0 && (<div className="inv-total-row inv-total-row-main inv-free-items-row"><span>FREE ITEMS :</span><span>{freeItemsText}</span></div>)}
            <div className="inv-total-row inv-total-row-main">
              <span>(VAT % 0.000) :</span><span>-</span>
            </div>
            <div className="inv-grand-row">
              <span>GRAND TOTAL :</span><span className="inv-grand-value">{money(grandTotal)}</span>
            </div>
            <div className="inv-total-row">
              <span>PAYMENT :</span><span>{paymentMethod}</span>
            </div>
            {paymentMethod === "cash" && (
              <>
                <div className="inv-total-row">
                  <span>CASH :</span><span>{money(cashReceived || 0)}</span>
                </div>
                <div className="inv-total-row">
                  <span>BALANCE :</span><span>{money(balance || 0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="inv-credit-note">MAXIMUM CREDIT PERIOD 55 DAYS. [ NO EXCEPTION ]</div>
        <div className="inv-thanks">Thank you for business with us!</div>

        <div className="inv-signatures">
          <div><div className="inv-sign-line" />Checked by</div>
          <div><div className="inv-sign-line" />Recieved by</div>
          <div><div className="inv-sign-line" />Delivered by</div>
        </div>

        <div className="inv-powered" >Powered by J&co.</div>
      </div>
    );
  }

  return (
    <div className="receipt">
      <div className="center bold title">{companyName}</div>
      {headerLines.map((line, idx) => (
        <div key={`hdr-${idx}`} className="center small">
          {line}
        </div>
      ))}

      <div className="hr" />

      <div className="row">
        <span>Sale:</span><span>#{saleId || "-"}</span>
      </div>
      <div className="row">
        <span>Date:</span><span>{dateText || new Date().toLocaleString()}</span>
      </div>
      {showCustomer && (customerName || customerPhone || customerAddress) && (
        <>
          <div className="row">
            <span>Customer:</span><span>{customerName || "-"}</span>
          </div>
          <div className="row">
            <span>Phone:</span><span>{customerPhone || "-"}</span>
          </div>
          <div className="row">
            <span>Address:</span><span>{customerAddress || "-"}</span>
          </div>
        </>
      )}

      <div className="hr" />

      {showItemsHeading && <div className="bold">Items</div>}
      {items.map((i) => {
        const price = Number(i.price) || 0;
        const qty = Number(i.qty) || 0;
        const base = price * qty;
        const t = i.itemDiscountType || "none";
        const v = Number(i.itemDiscountValue || 0);
        let itemDiscount = 0;
        if (t === "amount") {
          itemDiscount = Math.max(0, Math.min(v, base));
        } else if (t === "percent") {
          const pct = Math.max(0, Math.min(v, 100));
          itemDiscount = Math.round((base * pct) / 100);
        }
        const lineTotal = Math.max(0, base - itemDiscount);

        return (
          <div key={`${i.barcode}-${i.name}`} className="item">
            <div className="itemName">{i.name}</div>
            <div className="row">
              <span>{count(qty)} x {money(price)}</span>
              <span>{money(lineTotal)}</span>
            </div>
            {itemDiscount > 0 && (
              <div className="row small">
                <span>Item Discount</span>
                <span>-{money(itemDiscount)}</span>
              </div>
            )}
          </div>
        );
      })}

      {freeItems.length > 0 && (
        <div className="row small" style={{ marginTop: 4 }}>
          <span>Free Items</span>
          <span>{freeItemsText}</span>
        </div>
      )}

      <div className="hr" />

      {showTotals && (
        <>
          <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="row"><span>Discount</span><span>{money(discount)}</span></div>
          <div className="row bold"><span>Total</span><span>{money(grandTotal)}</span></div>
        </>
      )}

      <div className="hr" />

      {showPayment && (
        <>
          <div className="row"><span>Payment</span><span>{paymentMethod}</span></div>
          {paymentMethod === "cash" && (
            <>
              <div className="row"><span>Cash</span><span>{money(cashReceived || 0)}</span></div>
              <div className="row"><span>Change</span><span>{money(balance || 0)}</span></div>
            </>
          )}
        </>
      )}

      <div className="hr" />
      {footerLines.map((line, idx) => (
        <div key={`ftr-${idx}`} className="center small">
          {line}
        </div>
      ))}
    </div>
  );
}






