import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Asterisk,
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Download,
  Printer,
  Edit3,
  Box,
  Menu,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Wallet,
  SlidersHorizontal,
  History,
  Trash2,
  Loader2,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./styles.css";

const currency = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format((Number(n) || 0) / 100);
const shortMoney = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n / 100);
const dateString = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const today = () => daysFromNow(0);
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const post = (path, data) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
const put = (path, data) =>
  api(path, { method: "PUT", body: JSON.stringify(data) });
const initials = (name) =>
  name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";
const invoiceStatus = (i) =>
  i.status === "issued" && i.due_date.slice(0, 10) < today()
    ? "overdue"
    : i.status;
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {{
        issued: "Unpaid",
        paid: "Paid",
        draft: "Draft",
        void: "Void",
        overdue: "Overdue",
        low: "Low stock",
        out: "Out of stock",
        in: "In stock",
      }[status] || status}
    </span>
  );
}
function Empty({ icon: Icon = Box, title, description, action }) {
  return (
    <div className="empty">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Button({ children, variant = "", className = "", ...props }) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Field({ label, children, wide = false }) {
  const id = React.useId();
  return (
    <div className={`field ${wide ? "wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        ["input", "textarea", "select"].includes(child.type)
          ? React.cloneElement(child, { id })
          : child,
      )}
    </div>
  );
}
function Modal({ title, description, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function FormFooter({ busy, label, onClose }) {
  return (
    <div className="modal-footer">
      <Button type="button" variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={busy} type="submit">
        {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{" "}
        {label}
      </Button>
    </div>
  );
}
function ProductForm({ product, onClose, onSave }) {
  const [values, set] = useState(
    product
      ? {
          ...product,
          price: product.price_cents / 100,
          cost: product.cost_cents / 100,
        }
      : {
          name: "",
          sku: "",
          category: "General",
          price: "",
          cost: "",
          stock: 0,
          reorder_level: 5,
        },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bind = (key, type = "text") => ({
    value: values[key],
    onChange: (e) =>
      set({
        ...values,
        [key]:
          type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value,
      }),
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        name: values.name,
        sku: values.sku,
        category: values.category,
        price_cents: Math.round(Number(values.price) * 100),
        cost_cents: Math.round(Number(values.cost) * 100),
        reorder_level: Number(values.reorder_level),
        ...(!product ? { stock: Number(values.stock) } : {}),
      };
      await (product
        ? put("/products/" + product.id, body)
        : post("/products", body));
      await onSave();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product ? "Edit product" : "Add a product"}
      description="Keep your catalog organized and your shelves accounted for."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Product name" wide>
            <input
              required
              maxLength={160}
              placeholder="e.g. Arc table lamp"
              {...bind("name")}
            />
          </Field>
          <Field label="SKU">
            <input
              required
              maxLength={60}
              placeholder="LX-009"
              {...bind("sku")}
            />
          </Field>
          <Field label="Category">
            <input
              required
              maxLength={80}
              list="categories"
              {...bind("category")}
            />
            <datalist id="categories">
              {[
                "Furniture",
                "Lighting",
                "Decor",
                "Textiles",
                "Kitchen",
                "General",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Selling price (₹)">
            <input
              type="number"
              required
              min="0"
              max="1000000"
              step="0.01"
              {...bind("price", "number")}
            />
          </Field>
          <Field label="Cost price (₹)">
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              {...bind("cost", "number")}
            />
          </Field>
          {!product && (
            <Field label="Opening stock">
              <input
                type="number"
                required
                min="0"
                max="1000000"
                {...bind("stock", "number")}
              />
            </Field>
          )}
          <Field label="Low stock threshold">
            <input
              type="number"
              required
              min="0"
              max="1000000"
              {...bind("reorder_level", "number")}
            />
          </Field>
        </div>
        {product && (
          <p className="form-hint">
            To update quantities, use Adjust stock. Every movement is recorded.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <FormFooter
          busy={busy}
          label={product ? "Save changes" : "Add product"}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}
function CustomerForm({ customer, onClose, onSave }) {
  const [v, set] = useState(
    customer || { name: "", email: "", phone: "", address: "", tax_id: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bind = (k) => ({
    value: v[k],
    onChange: (e) => set({ ...v, [k]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await (customer
        ? put("/customers/" + customer.id, v)
        : post("/customers", v));
      await onSave();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={customer ? "Edit customer" : "Add a customer"}
      description="A little detail makes every invoice more personal."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Customer / business name" wide>
            <input required maxLength={160} {...bind("name")} />
          </Field>
          <Field label="Email address">
            <input type="email" {...bind("email")} />
          </Field>
          <Field label="Phone number">
            <input maxLength={60} {...bind("phone")} />
          </Field>
          <Field label="Billing address" wide>
            <textarea rows="3" maxLength={1000} {...bind("address")} />
          </Field>
          <Field label="Tax ID / GSTIN" wide>
            <input maxLength={80} {...bind("tax_id")} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <FormFooter
          busy={busy}
          label={customer ? "Save changes" : "Add customer"}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}
function StockModal({ product, onClose, onSave }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [movements, setMovements] = useState(null);
  useEffect(() => {
    api(`/products/${product.id}/movements`)
      .then(setMovements)
      .catch((e) => setError(e.message));
  }, [product.id]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/products/${product.id}/stock`, {
        quantity: Number(quantity),
        reason,
      });
      await onSave();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Adjust stock"
      description={`${product.name} · ${product.stock} units on hand`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Quantity change (+ or −)" wide>
            <input
              autoFocus
              type="number"
              required
              min="-1000000"
              max="1000000"
              placeholder="e.g. 20 or -3"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <small>New stock: {product.stock + Number(quantity)} units</small>
          </Field>
          <Field label="Reason" wide>
            <input
              required
              maxLength={300}
              placeholder="e.g. New shipment, damaged goods…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <FormFooter busy={busy} label="Update stock" onClose={onClose} />
      </form>
      <div className="history">
        <h4>
          <History size={16} /> Recent movements
        </h4>
        {movements === null ? (
          <p>Loading history…</p>
        ) : movements.length ? (
          movements.map((m) => (
            <div key={m.id}>
              <span>
                {m.reason}
                <small>{dateString(m.created_at)}</small>
              </span>
              <b className={m.quantity > 0 ? "positive" : "negative"}>
                {m.quantity > 0 ? "+" : ""}
                {m.quantity}
              </b>
            </div>
          ))
        ) : (
          <p>No movements yet.</p>
        )}
      </div>
    </Modal>
  );
}
function InvoiceForm({
  products,
  customers,
  settings,
  onClose,
  onSave,
  onCreated,
}) {
  const [v, set] = useState({
    customer_id: "",
    issue_date: daysFromNow(0),
    due_date: daysFromNow(14),
    tax: 18,
    notes: settings.invoice_note,
  });
  const [items, setItems] = useState([
    { product_id: "", quantity: 1, price_cents: 0 },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price_cents, 0);
  const tax = Math.round((subtotal * Number(v.tax)) / 100);
  function update(index, key, value) {
    setItems(
      items.map((item, j) =>
        j === index
          ? {
              ...item,
              [key]: value,
              ...(key === "product_id"
                ? {
                    price_cents:
                      products.find((p) => p.id === value)?.price_cents || 0,
                  }
                : {}),
            }
          : item,
      ),
    );
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const invoice = await post("/invoices", {
        customer_id: v.customer_id,
        issue_date: v.issue_date,
        due_date: v.due_date,
        tax_bps: Math.round(Number(v.tax) * 100),
        notes: v.notes,
        items,
      });
      await onSave();
      onCreated(invoice.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title="Create an invoice"
      description="Start with a draft. Stock is deducted only when you issue it."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Bill to" wide>
            <select
              required
              value={v.customer_id}
              onChange={(e) => set({ ...v, customer_id: e.target.value })}
            >
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!customers.length && (
              <small>Add a customer in the Customers page first.</small>
            )}
          </Field>
          <Field label="Invoice date">
            <input
              type="date"
              required
              value={v.issue_date}
              onChange={(e) => set({ ...v, issue_date: e.target.value })}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              required
              min={v.issue_date}
              value={v.due_date}
              onChange={(e) => set({ ...v, due_date: e.target.value })}
            />
          </Field>
        </div>
        <div className="line-items">
          <div className="line-labels">
            <span>Product</span>
            <span>Qty</span>
            <span>Price (₹)</span>
            <span>Amount</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div className="line-row" key={index}>
              <select
                required
                aria-label={`Product ${index + 1}`}
                value={item.product_id}
                onChange={(e) => update(index, "product_id", e.target.value)}
              >
                <option value="">Select product</option>
                {products
                  .filter(
                    (p) =>
                      p.id === item.product_id ||
                      !items.some((i) => i.product_id === p.id),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} ({p.stock} in stock)
                    </option>
                  ))}
              </select>
              <input
                aria-label={`Quantity ${index + 1}`}
                type="number"
                min="1"
                max="1000000"
                required
                value={item.quantity}
                onChange={(e) =>
                  update(index, "quantity", Number(e.target.value))
                }
              />
              <input
                aria-label={`Price ${index + 1}`}
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={item.price_cents / 100}
                onChange={(e) =>
                  update(
                    index,
                    "price_cents",
                    Math.round(Number(e.target.value) * 100),
                  )
                }
              />
              <b>{currency(item.quantity * item.price_cents)}</b>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove item ${index + 1}`}
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, j) => j !== index))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="text"
            disabled={items.length >= products.length}
            onClick={() =>
              setItems([
                ...items,
                { product_id: "", quantity: 1, price_cents: 0 },
              ])
            }
          >
            <Plus size={16} /> Add line item
          </Button>
        </div>
        <div className="invoice-bottom">
          <Field label="Notes / payment instructions">
            <textarea
              maxLength={2000}
              rows="4"
              value={v.notes}
              onChange={(e) => set({ ...v, notes: e.target.value })}
            />
          </Field>
          <div className="invoice-totals">
            <div>
              <span>Subtotal</span>
              <b>{currency(subtotal)}</b>
            </div>
            <div>
              <label htmlFor="tax">Tax (%)</label>
              <input
                id="tax"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={v.tax}
                onChange={(e) => set({ ...v, tax: e.target.value })}
              />
            </div>
            <div>
              <span>Tax amount</span>
              <b>{currency(tax)}</b>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <b>{currency(subtotal + tax)}</b>
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <FormFooter busy={busy} label="Save draft" onClose={onClose} />
      </form>
    </Modal>
  );
}
function InvoiceDetail({ id, onClose, onSave, notify }) {
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    api("/invoices/" + id)
      .then(setInvoice)
      .catch((e) => setError(e.message));
  }, [id]);
  async function action(action) {
    setBusy(true);
    setError("");
    try {
      await post(`/invoices/${id}/${action}`, {});
      setInvoice(await api("/invoices/" + id));
      await onSave();
      notify(
        {
          issue: "Invoice issued. Stock updated.",
          pay: "Payment recorded.",
          void: "Invoice voided. Stock restored if previously issued.",
        }[action],
      );
      setConfirm("");
    } catch (e) {
      setError(e.message);
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }
  const i = invoice;
  return (
    <Modal
      wide
      title={i ? i.number : "Loading invoice…"}
      description={i ? "Invoice details and payment status" : null}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {i && (
        <>
          <div className="detail-toolbar">
            <Badge status={invoiceStatus(i)} />
            <div>
              {i.status === "draft" && (
                <Button disabled={busy} onClick={() => setConfirm("issue")}>
                  <ArrowUpRight size={16} /> Issue invoice
                </Button>
              )}
              {i.status === "issued" && (
                <Button disabled={busy} onClick={() => setConfirm("pay")}>
                  <Check size={16} /> Mark paid
                </Button>
              )}
              {["draft", "issued"].includes(i.status) && (
                <Button
                  variant="secondary danger-text"
                  disabled={busy}
                  onClick={() => setConfirm("void")}
                >
                  Void
                </Button>
              )}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print / PDF
              </Button>
            </div>
          </div>
          {confirm && (
            <div className="confirmation" role="alert">
              <p>
                {confirm === "issue"
                  ? "Issue this invoice? Stock will be deducted."
                  : confirm === "pay"
                    ? "Confirm that full payment has been received?"
                    : i.status === "issued"
                      ? "Void this invoice? Its stock will be restored."
                      : "Void this draft? This cannot be undone."}
              </p>
              <Button disabled={busy} onClick={() => action(confirm)}>
                {busy ? "Saving…" : "Confirm"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm("")}>
                Cancel
              </Button>
            </div>
          )}
          <article className="invoice-paper" id="print-invoice">
            <div className="paper-header">
              <div>
                <span className="paper-logo">
                  L<span><Asterisk size={18} /></span>
                </span>
                <h2>{i.business_snapshot.business_name}</h2>
                <p className="preserve-lines">{i.business_snapshot.address}</p>
                <p>{i.business_snapshot.email}</p>
                <p>{i.business_snapshot.phone}</p>
                {i.business_snapshot.tax_id && (
                  <p>Tax ID: {i.business_snapshot.tax_id}</p>
                )}
              </div>
              <div className="paper-invoice-title">
                <h1>
                  {i.status === "draft"
                    ? "DRAFT INVOICE"
                    : i.status === "void"
                      ? "VOID INVOICE"
                      : "INVOICE"}
                </h1>
                <p>{i.number}</p>
                <Badge status={invoiceStatus(i)} />
              </div>
            </div>
            <div className="paper-meta">
              <div>
                <label>BILL TO</label>
                <h3>{i.customer_snapshot.name}</h3>
                <p className="preserve-lines">{i.customer_snapshot.address}</p>
                <p>{i.customer_snapshot.email}</p>
                {i.customer_snapshot.tax_id && (
                  <p>Tax ID: {i.customer_snapshot.tax_id}</p>
                )}
              </div>
              <div>
                <p>
                  <span>Invoice date</span>
                  <b>{dateString(i.issue_date)}</b>
                </p>
                <p>
                  <span>Due date</span>
                  <b>{dateString(i.due_date)}</b>
                </p>
                {i.paid_at && (
                  <p>
                    <span>Paid on</span>
                    <b>{dateString(i.paid_at)}</b>
                  </p>
                )}
              </div>
            </div>
            <table className="paper-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {i.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      <small>{item.sku}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{currency(item.price_cents)}</td>
                    <td>{currency(item.line_total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="paper-totals">
              <p>
                <span>Subtotal</span>
                <b>{currency(i.subtotal_cents)}</b>
              </p>
              <p>
                <span>Tax ({i.tax_bps / 100}%)</span>
                <b>{currency(i.tax_cents)}</b>
              </p>
              <p className="total">
                <span>Total (INR)</span>
                <b>{currency(i.total_cents)}</b>
              </p>
            </div>
            {i.notes && (
              <div className="paper-notes">
                <label>NOTES & PAYMENT DETAILS</label>
                <p className="preserve-lines">{i.notes}</p>
              </div>
            )}
            <footer>Generated with Luxora</footer>
          </article>
        </>
      )}
    </Modal>
  );
}

function App() {
  const navs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "customers", label: "Customers", icon: Users },
  ];
  const [page, setPage] = useState(location.hash.slice(1) || "overview");
  const [mobile, setMobile] = useState(false);
  const [products, setProducts] = useState([]),
    [customers, setCustomers] = useState([]),
    [invoices, setInvoices] = useState([]),
    [settings, setSettings] = useState(null),
    [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const toastTimer = useRef();
  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  async function load() {
    try {
      const [p, c, i, s, d] = await Promise.all(
        ["/products", "/customers", "/invoices", "/settings", "/dashboard"].map(
          (p) => api(p),
        ),
      );
      setProducts(p);
      setCustomers(c);
      setInvoices(i);
      setSettings(s);
      setDashboard(d);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const listener = () => {
      setPage(location.hash.slice(1) || "overview");
      setSearch("");
      setFilter("all");
      setMobile(false);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  function navigate(id) {
    location.hash = id;
  }
  const save = async () => {
    await load();
    notify("Changes saved successfully.");
  };
  const createInvoice = () => setModal({ type: "invoice-new" });
  const current = navs.find((n) => n.id === page) || {
    label: page === "settings" ? "Settings" : "Overview",
  };
  const matches = (...values) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());
  const selectedProducts = products.filter(
    (p) =>
      matches(p.name, p.sku, p.category) &&
      (filter === "all" ||
        (filter === "low"
          ? p.stock <= p.reorder_level
          : p.category === filter)),
  );
  const selectedInvoices = invoices.filter(
    (i) =>
      matches(i.number, i.customer_snapshot.name) &&
      (filter === "all" || invoiceStatus(i) === filter),
  );
  function exportInventory() {
    const cell = (v) =>
      '"' +
      String(v)
        .replace(/^[=+\-@\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      [
        "SKU",
        "Name",
        "Category",
        "Stock",
        "Reorder level",
        "Price (INR)",
        "Cost (INR)",
      ],
      ...products.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.stock,
        p.reorder_level,
        (p.price_cents / 100).toFixed(2),
        (p.cost_cents / 100).toFixed(2),
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    a.download = "luxora-inventory.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify("Inventory exported.");
  }
  function InvoiceTable({ rows, compact = false }) {
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                Invoice <ChevronDown size={12} />
              </th>
              <th>Customer</th>
              {!compact && <th>Issued on</th>}
              <th>Due date</th>
              <th>Status</th>
              <th className="align-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <button
                    className="link invoice-link"
                    onClick={() =>
                      setModal({ type: "invoice-detail", id: i.id })
                    }
                  >
                    <FileText size={15} />
                    {i.number}
                  </button>
                </td>
                <td>
                  <div className="person">
                    <span
                      className={`avatar tone-${i.customer_snapshot.name.length % 4}`}
                    >
                      {initials(i.customer_snapshot.name)}
                    </span>
                    {i.customer_snapshot.name}
                  </div>
                </td>
                {!compact && (
                  <td className="muted">{dateString(i.issue_date)}</td>
                )}
                <td className="muted">{dateString(i.due_date)}</td>
                <td>
                  <Badge status={invoiceStatus(i)} />
                </td>
                <td className="align-right amount">
                  {currency(i.total_cents)}
                </td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label={`View ${i.number}`}
                    onClick={() =>
                      setModal({ type: "invoice-detail", id: i.id })
                    }
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            icon={FileText}
            title="No invoices here yet"
            description="Create an invoice or adjust your filters."
            action={
              <Button onClick={createInvoice}>
                <Plus size={16} /> Create invoice
              </Button>
            }
          />
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a href="#overview" className="brand">
          <span className="brand-mark">
            L<span><Asterisk size={18} /></span>
          </span>
          <span>
            luxora<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navs.map((n) => (
            <a
              key={n.id}
              href={"#" + n.id}
              className={page === n.id ? "active" : ""}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "inventory" && dashboard?.low_stock_count > 0 && (
                <span className="nav-count">{dashboard.low_stock_count}</span>
              )}
              {page === n.id && <span className="active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <span className="mini-mark"><Asterisk size={30} /></span>
            <h4>
              A little more organized.
              <br />A lot more possible.
            </h4>
            <p>Your business, in one place.</p>
            <span className="sidebar-card-line" />
          </div>
          <a
            className={
              page === "settings" ? "settings-link active" : "settings-link"
            }
            href="#settings"
          >
            <Settings size={18} /> Business settings
          </a>
          <div className="profile">
            <span className="avatar profile-avatar">
              {initials(settings?.business_name || "Your business")}
            </span>
            <div>
              <b>{settings?.business_name || "Your business"}</b>
              <small>Business workspace</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{current.label}</b>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <i /> Local workspace
            </span>
            <span className="topbar-divider" />
            <button
              className="topbar-avatar"
              aria-label="Business settings"
              onClick={() => navigate("settings")}
            >
              {initials(settings?.business_name || "Your business")}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR BUSINESS, AT A GLANCE</div>
              <h1>
                {page === "overview"
                  ? "Everything in good order."
                  : page === "inventory"
                    ? "Your inventory."
                    : page === "invoices"
                      ? "Invoices, without the fuss."
                      : page === "customers"
                        ? "Good business starts here."
                        : "Make it your own."}
              </h1>
              <p>
                {page === "overview"
                  ? "A clear view of your stock, sales, and what’s next."
                  : page === "inventory"
                    ? "The right products. The right quantities. All in one place."
                    : page === "invoices"
                      ? "From first draft to paid in full. Keep every detail in check."
                      : page === "customers"
                        ? "A home for the people and businesses you work with."
                        : "Your business details, on every invoice you send."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "inventory" ? (
                <>
                  <Button variant="secondary" onClick={exportInventory}>
                    <Download size={16} /> Export
                  </Button>
                  <Button onClick={() => setModal({ type: "product" })}>
                    <Plus size={17} /> Add product
                  </Button>
                </>
              ) : page === "customers" ? (
                <Button onClick={() => setModal({ type: "customer" })}>
                  <Plus size={17} /> Add customer
                </Button>
              ) : (
                page !== "settings" && (
                  <Button onClick={createInvoice}>
                    <Plus size={17} /> Create invoice
                  </Button>
                )
              )}
            </div>
          </div>
          {loadError ? (
            <div className="error-panel">
              <AlertCircle />
              <h3>Couldn’t connect to your workspace</h3>
              <p>{loadError}</p>
              <Button
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                <RefreshCw size={16} /> Try again
              </Button>
            </div>
          ) : loading ? (
            <div className="loading">
              <Loader2 size={28} className="spin" />
              <p>Getting everything in order…</p>
            </div>
          ) : (
            <>
              {page === "overview" && dashboard && (
                <>
                  <div className="stat-grid">
                    <Stat
                      label="Total revenue"
                      value={currency(dashboard.revenue_cents)}
                      icon={Wallet}
                      foot="From fully paid invoices"
                      tint="green"
                    />
                    <Stat
                      label="Outstanding"
                      value={currency(dashboard.outstanding_cents)}
                      icon={FileText}
                      foot={`${dashboard.overdue_count} overdue invoice${dashboard.overdue_count === 1 ? "" : "s"}`}
                      tint="orange"
                    />
                    <Stat
                      label="Inventory value"
                      value={currency(dashboard.value_cents)}
                      icon={Package}
                      foot={`${dashboard.units.toLocaleString("en-IN")} units at cost price`}
                      tint="blue"
                    />
                    <Stat
                      label="Low stock items"
                      value={String(dashboard.low_stock_count).padStart(2, "0")}
                      icon={AlertCircle}
                      foot="Products at or below threshold"
                      tint="yellow"
                      onClick={() => {
                        navigate("inventory");
                        setTimeout(() => setFilter("low"), 0);
                      }}
                    />
                  </div>
                  <div className="overview-middle">
                    <section className="card revenue-card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Revenue overview{" "}
                            <span className="subtle-tag">INR</span>
                          </h2>
                          <p>Payments received over the last 6 months</p>
                        </div>
                        <span className="period">
                          <i /> Paid revenue
                        </span>
                      </div>
                      <RevenueChart data={dashboard.monthly} />
                    </section>
                    <section className="card stock-card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Stock watch{" "}
                            <span className="count-bubble">
                              {dashboard.low_stock_count}
                            </span>
                          </h2>
                          <p>A little attention goes a long way</p>
                        </div>
                        <span className="icon-soft orange">
                          <Package size={18} />
                        </span>
                      </div>
                      <div className="stock-watch-list">
                        {products
                          .filter((p) => p.stock <= p.reorder_level)
                          .slice(0, 3)
                          .map((p, j) => (
                            <button
                              key={p.id}
                              className="watch-item"
                              onClick={() =>
                                setModal({ type: "stock", product: p })
                              }
                            >
                              <ProductIcon category={p.category} index={j} />
                              <span>
                                <b>{p.name}</b>
                                <small>{p.sku}</small>
                              </span>
                              <span
                                className={
                                  p.stock === 0 ? "stock-zero" : "stock-low"
                                }
                              >
                                {p.stock} left
                              </span>
                            </button>
                          ))}
                        {!dashboard.low_stock_count && (
                          <div className="stock-good">
                            <CheckCircle2 size={30} />
                            <p>Your stock is looking healthy.</p>
                          </div>
                        )}
                      </div>
                      <button
                        className="card-bottom-link"
                        onClick={() => {
                          navigate("inventory");
                          setTimeout(() => setFilter("low"), 0);
                        }}
                      >
                        View inventory <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <section className="card recent-card">
                    <div className="section-head">
                      <div>
                        <h2>Recent invoices</h2>
                        <p>The latest from your billing desk</p>
                      </div>
                      <Button
                        variant="secondary small"
                        onClick={() => navigate("invoices")}
                      >
                        View all invoices <ArrowRight size={14} />
                      </Button>
                    </div>
                    <InvoiceTable rows={invoices.slice(0, 5)} compact />
                  </section>
                  <div className="overview-bottom">
                    <section className="card activity-card">
                      <div className="section-head">
                        <div>
                          <h2>Recent stock activity</h2>
                          <p>A record of what came in and went out</p>
                        </div>
                        <History size={18} className="muted" />
                      </div>
                      {dashboard.activity.length ? (
                        dashboard.activity.slice(0, 3).map((a) => (
                          <div className="activity-item" key={a.id}>
                            <span
                              className={`activity-icon ${a.quantity > 0 ? "up" : "down"}`}
                            >
                              {a.quantity > 0 ? (
                                <ArrowDownRight size={17} />
                              ) : (
                                <ArrowUpRight size={17} />
                              )}
                            </span>
                            <div>
                              <b>{a.name}</b>
                              <p>{a.reason}</p>
                            </div>
                            <div className="activity-quantity">
                              <b>
                                {a.quantity > 0 ? "+" : ""}
                                {a.quantity} units
                              </b>
                              <small>{dateString(a.created_at)}</small>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-activity">
                          Stock movements will appear here.
                        </p>
                      )}
                    </section>
                    <div className="tip-card">
                      <span className="tip-icon"><Asterisk size={20} /></span>
                      <span className="eyebrow">A SMALL BUSINESS TIP</span>
                      <h3>
                        Less chasing.
                        <br />
                        More creating.
                      </h3>
                      <p>
                        Keep your customer details up to date so your next
                        invoice is always a few clicks away.
                      </p>
                      <button onClick={() => navigate("customers")}>
                        Meet your customers <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {page === "inventory" && (
                <>
                  <div className="mini-stats">
                    <span>
                      <b>{products.length}</b> total products
                    </span>
                    <span>
                      <i className="dot green" />
                      <b>{products.reduce((s, p) => s + p.stock, 0)}</b> units
                      on hand
                    </span>
                    <span>
                      <i className="dot amber" />
                      <b>
                        {
                          products.filter((p) => p.stock <= p.reorder_level)
                            .length
                        }
                      </b>{" "}
                      need attention
                    </span>
                  </div>
                  <section className="card">
                    <div className="table-toolbar">
                      <div className="tabs">
                        <button
                          className={filter === "all" ? "selected" : ""}
                          onClick={() => setFilter("all")}
                        >
                          All products <span>{products.length}</span>
                        </button>
                        <button
                          className={filter === "low" ? "selected" : ""}
                          onClick={() => setFilter("low")}
                        >
                          Low stock <span>{dashboard.low_stock_count}</span>
                        </button>
                      </div>
                      <div className="table-controls">
                        <SearchBox
                          value={search}
                          onChange={setSearch}
                          placeholder="Search name, SKU…"
                        />
                        <label className="filter-select">
                          <SlidersHorizontal size={15} />
                          <select
                            aria-label="Filter by category"
                            value={
                              ["all", "low"].includes(filter) ? "all" : filter
                            }
                            onChange={(e) => setFilter(e.target.value)}
                          >
                            <option value="all">All categories</option>
                            {[...new Set(products.map((p) => p.category))]
                              .sort()
                              .map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table className="data-table inventory-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Category</th>
                            <th className="align-right">Price</th>
                            <th className="align-right">Stock</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProducts.map((p, index) => (
                            <tr key={p.id}>
                              <td>
                                <div className="product-cell">
                                  <ProductIcon
                                    category={p.category}
                                    index={index}
                                  />
                                  <button
                                    className="product-name"
                                    onClick={() =>
                                      setModal({ type: "product", product: p })
                                    }
                                  >
                                    {p.name}
                                    <small>
                                      Cost: {currency(p.cost_cents)}
                                    </small>
                                  </button>
                                </div>
                              </td>
                              <td className="sku-text">{p.sku}</td>
                              <td>
                                <span className="category-tag">
                                  {p.category}
                                </span>
                              </td>
                              <td className="align-right amount">
                                {currency(p.price_cents)}
                              </td>
                              <td className="align-right">
                                <button
                                  className="stock-button"
                                  onClick={() =>
                                    setModal({ type: "stock", product: p })
                                  }
                                >
                                  {p.stock} <span>units</span>
                                </button>
                              </td>
                              <td>
                                <Badge
                                  status={
                                    p.stock === 0
                                      ? "out"
                                      : p.stock <= p.reorder_level
                                        ? "low"
                                        : "in"
                                  }
                                />
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-btn"
                                    title="Adjust stock"
                                    aria-label={`Adjust stock for ${p.name}`}
                                    onClick={() =>
                                      setModal({ type: "stock", product: p })
                                    }
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    aria-label={`Edit ${p.name}`}
                                    onClick={() =>
                                      setModal({ type: "product", product: p })
                                    }
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!selectedProducts.length && (
                        <Empty
                          title="No products found"
                          description={
                            products.length
                              ? "Try a different search or filter."
                              : "Add your first product to start tracking inventory."
                          }
                          action={
                            <Button
                              onClick={() => setModal({ type: "product" })}
                            >
                              <Plus size={16} /> Add product
                            </Button>
                          }
                        />
                      )}
                    </div>
                    <div className="table-footer">
                      Showing {selectedProducts.length} of {products.length}{" "}
                      products
                      <span>Stock updates are recorded automatically</span>
                    </div>
                  </section>
                </>
              )}
              {page === "invoices" && (
                <>
                  <div className="mini-stats">
                    <span>
                      <b>{invoices.length}</b> total invoices
                    </span>
                    <span>
                      <i className="dot green" />
                      <b>{currency(dashboard.revenue_cents)}</b> collected
                    </span>
                    <span>
                      <i className="dot amber" />
                      <b>{currency(dashboard.outstanding_cents)}</b> outstanding
                    </span>
                  </div>
                  <section className="card">
                    <div className="table-toolbar">
                      <div className="tabs">
                        {[
                          ["all", "All invoices"],
                          ["draft", "Draft"],
                          ["issued", "Unpaid"],
                          ["paid", "Paid"],
                          ["overdue", "Overdue"],
                          ["void", "Void"],
                        ].map(([id, label]) => (
                          <button
                            key={id}
                            className={filter === id ? "selected" : ""}
                            onClick={() => setFilter(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder="Search invoices…"
                      />
                    </div>
                    <InvoiceTable rows={selectedInvoices} />
                    <div className="table-footer">
                      Showing {selectedInvoices.length} of {invoices.length}{" "}
                      invoices<span>All amounts in INR</span>
                    </div>
                  </section>
                </>
              )}
              {page === "customers" && (
                <>
                  <div className="mini-stats">
                    <span>
                      <b>{customers.length}</b> customers and counting
                    </span>
                    <span>
                      <i className="dot green" />
                      Better relationships, better business
                    </span>
                  </div>
                  <section className="card">
                    <div className="table-toolbar">
                      <h2>
                        Your customers{" "}
                        <span className="count-bubble">{customers.length}</span>
                      </h2>
                      <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder="Search customers…"
                      />
                    </div>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th className="align-right">Invoices</th>
                            <th className="align-right">Total billed</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {customers
                            .filter((c) => matches(c.name, c.email, c.phone))
                            .map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <div className="person">
                                    <span
                                      className={`avatar tone-${c.name.length % 4}`}
                                    >
                                      {initials(c.name)}
                                    </span>
                                    <b>{c.name}</b>
                                  </div>
                                </td>
                                <td>{c.email || "—"}</td>
                                <td className="muted">{c.phone || "—"}</td>
                                <td className="align-right">
                                  {c.invoice_count}
                                </td>
                                <td className="align-right amount">
                                  {currency(c.total_cents)}
                                </td>
                                <td>
                                  <button
                                    className="icon-btn"
                                    aria-label={`Edit ${c.name}`}
                                    onClick={() =>
                                      setModal({
                                        type: "customer",
                                        customer: c,
                                      })
                                    }
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!customers.filter((c) =>
                        matches(c.name, c.email, c.phone),
                      ).length && (
                        <Empty
                          icon={Users}
                          title="No customers found"
                          description="Add a customer to get your next invoice started."
                          action={
                            <Button
                              onClick={() => setModal({ type: "customer" })}
                            >
                              <Plus size={16} /> Add customer
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </section>
                </>
              )}
              {page === "settings" && (
                <SettingsPage
                  settings={settings}
                  onSave={save}
                  notify={notify}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              Thoughtfully organized. Powered by <b>luxora.</b>
            </span>
            <span>
              <span className="footer-dot" /> Your workspace, up to date
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === "product" && (
        <ProductForm
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {modal?.type === "customer" && (
        <CustomerForm
          customer={modal.customer}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {modal?.type === "stock" && (
        <StockModal
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {modal?.type === "invoice-new" && settings && (
        <InvoiceForm
          products={products}
          customers={customers}
          settings={settings}
          onClose={() => setModal(null)}
          onSave={load}
          onCreated={(id) => {
            setModal({ type: "invoice-detail", id });
            notify("Draft invoice created.");
          }}
        />
      )}
      {modal?.type === "invoice-detail" && (
        <InvoiceDetail
          id={modal.id}
          onClose={() => setModal(null)}
          onSave={load}
          notify={notify}
        />
      )}
    </div>
  );
}
function Stat({ label, value, icon: Icon, foot, tint, onClick }) {
  return (
    <div
      className={`stat-card ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      {...(onClick
        ? {
            role: "button",
            tabIndex: 0,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <div className="stat-top">
        <span>{label}</span>
        <span className={`icon-soft ${tint}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {tint === "green" ? (
          <span className="dot green" />
        ) : tint === "yellow" ? (
          <span className="dot amber" />
        ) : null}
        {foot}
        {onClick && <ArrowUpRight size={13} />}
      </div>
    </div>
  );
}
function ProductIcon({ category, index = 0 }) {
  const icons = {
    Lighting: "◒",
    Furniture: "▥",
    Decor: "◡",
    Textiles: "▧",
    Kitchen: "▱",
    General: "◇",
  };
  return (
    <span
      aria-hidden="true"
      className={`product-icon product-tone-${["Lighting", "Furniture", "Decor", "Textiles", "Kitchen"].indexOf(category) % 4}`}
    >
      {icons[category] || "◇"}
    </span>
  );
}
function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search-box">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
function RevenueChart({ data }) {
  const max = Math.max(...data.map((d) => d.revenue_cents), 10000) * 1.15;
  const w = 600,
    h = 185;
  const chartHeight = 145;
  const pts = data.map((d, j) => [
    j * (w / 5),
    chartHeight - (d.revenue_cents / max) * chartHeight,
  ]);
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <div className="chart-wrap">
      <div className="chart-y">
        {[1, 0.75, 0.5, 0.25, 0].map((n) => (
          <span key={n}>{shortMoney(max * n)}</span>
        ))}
      </div>
      <div className="chart-main">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={
            "Paid revenue: " +
            data
              .map((d) => d.month + " " + currency(d.revenue_cents))
              .join(", ")
          }
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f8d67" stopOpacity=".17" />
              <stop offset="100%" stopColor="#2f8d67" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((n) => (
            <line
              key={n}
              x1="0"
              y1={n * chartHeight}
              x2={w}
              y2={n * chartHeight}
              stroke="#e7ece8"
              strokeDasharray="4 5"
            />
          ))}
          <polygon
            points={`0,${chartHeight} ${line} ${w},${chartHeight}`}
            fill="url(#areaFill)"
          />
          <polyline
            points={line}
            fill="none"
            stroke="#267959"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {pts.map((p, j) => (
            <g key={j}>
              <circle
                cx={p[0]}
                cy={p[1]}
                r="4"
                fill="#fff"
                stroke="#267959"
                strokeWidth="2"
              >
                <title>{currency(data[j].revenue_cents)}</title>
              </circle>
            </g>
          ))}
        </svg>
        <div className="chart-x">
          {data.map((d) => (
            <span key={d.month}>
              {new Date(d.month + "-15T12:00:00").toLocaleDateString("en-IN", {
                month: "short",
              })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
function SettingsPage({ settings, onSave, notify }) {
  const [v, set] = useState(settings);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await put("/settings", v);
      await onSave();
      notify("Business details saved. New invoices will use these details.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const bind = (k) => ({
    value: v[k],
    onChange: (e) => set({ ...v, [k]: e.target.value }),
  });
  return (
    <div className="settings-layout">
      <section className="card settings-card">
        <div className="section-head">
          <div>
            <h2>Business details</h2>
            <p>
              These appear on new invoices. Existing invoices retain their
              original details.
            </p>
          </div>
          <span className="icon-soft green">
            <ShoppingBag size={20} />
          </span>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Business name" wide>
              <input required maxLength={160} {...bind("business_name")} />
            </Field>
            <Field label="Business email">
              <input type="email" {...bind("email")} />
            </Field>
            <Field label="Phone number">
              <input maxLength={60} {...bind("phone")} />
            </Field>
            <Field label="Business address" wide>
              <textarea rows="3" maxLength={1000} {...bind("address")} />
            </Field>
            <Field label="Tax ID / GSTIN">
              <input maxLength={80} {...bind("tax_id")} />
            </Field>
            <Field label="Currency">
              <input value="INR — Indian Rupee (₹)" disabled />
              <small>All records in this workspace use INR.</small>
            </Field>
            <Field label="Default invoice note" wide>
              <textarea rows="3" maxLength={2000} {...bind("invoice_note")} />
            </Field>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-save">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Save changes
            </Button>
          </div>
        </form>
      </section>
      <aside className="settings-note">
        <span className="icon-soft green">
          <FileText size={20} />
        </span>
        <h3>A detail that matters.</h3>
        <p>
          Complete business information makes invoices clearer and helps
          customers know exactly who they’re paying.
        </p>
        <hr />
        <h4>Your invoicing workflow</h4>
        <ol>
          <li>Create a draft invoice.</li>
          <li>Issue it to deduct stock.</li>
          <li>Print or save as PDF.</li>
          <li>Mark paid when payment arrives.</li>
        </ol>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
