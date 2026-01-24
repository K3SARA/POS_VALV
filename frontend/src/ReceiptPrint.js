import React from "react";

export default function ReceiptPrint(props) {
  const {
    companyName = "MY GROCERY",
    saleId = "",
    dateText = "",
    items = [],
    subtotal = 0,
    discount = 0,
    grandTotal = 0,
    paymentMethod = "cash",
    cashReceived = "",
    balance = 0,
  } = props;

  return (
    <div className="receipt">
      <div className="center bold title">{companyName}</div>
      <div className="center small">Thank you! Visit again</div>

      <div className="hr" />

      <div className="row">
        <span>Sale:</span><span>#{saleId || "-"}</span>
      </div>
      <div className="row">
        <span>Date:</span><span>{dateText || new Date().toLocaleString()}</span>
      </div>

      <div className="hr" />

      <div className="bold">Items</div>
      {items.map((i) => (
        <div key={i.barcode} className="item">
          <div className="itemName">{i.name}</div>
          <div className="row">
            <span>{i.qty} x {Number(i.price).toFixed(2)}</span>
            <span>{(Number(i.price) * Number(i.qty)).toFixed(2)}</span>
          </div>
        </div>
      ))}

      <div className="hr" />

      <div className="row"><span>Subtotal</span><span>{Number(subtotal).toFixed(2)}</span></div>
      <div className="row"><span>Discount</span><span>{Number(discount).toFixed(2)}</span></div>
      <div className="row bold"><span>Total</span><span>{Number(grandTotal).toFixed(2)}</span></div>

      <div className="hr" />

      <div className="row"><span>Payment</span><span>{paymentMethod}</span></div>
      {paymentMethod === "cash" && (
        <>
          <div className="row"><span>Cash</span><span>{Number(cashReceived || 0).toFixed(2)}</span></div>
          <div className="row"><span>Change</span><span>{Number(balance || 0).toFixed(2)}</span></div>
        </>
      )}

      <div className="hr" />
      <div className="center small">Powered by POS</div>
    </div>
  );
}
