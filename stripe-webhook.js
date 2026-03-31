const DEFAULT_API_BASE_URL = "https://sharons-portal.onrender.com";

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveInvoiceTotal = (invoice) => {
  const directTotal = safeNumber(
    invoice?.total ??
    invoice?.grandTotal ??
    invoice?.invoiceTotal ??
    invoice?.totalAmount ??
    invoice?.amount
  );

  if (directTotal > 0) return directTotal;

  const subtotal = safeNumber(invoice?.subtotal);
  const gst = safeNumber(invoice?.gst);
  const quantity = Math.max(1, safeNumber(invoice?.quantity || 1));

  if (subtotal > 0 || gst > 0) {
    const inferredTotal = subtotal + gst;
    if (inferredTotal > 0) return inferredTotal;
  }

  const unitPrice = safeNumber(invoice?.unitPrice ?? invoice?.price ?? invoice?.rate);
  if (unitPrice > 0) {
    const inferredTotal = unitPrice * quantity + gst;
    if (inferredTotal > 0) return inferredTotal;
  }

  return 0;
};

const resolveInvoiceStripeAmount  = async (invoice) => {
  const serverBaseUrl = getStripeServerBaseUrl();
  const selectedClient = getClientById(invoice?.clientId) || {};

  const rawTotal = resolveInvoiceTotal(invoice);

  if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
    console.error("Stripe invoice total invalid", {
      invoice,
      total: invoice?.total,
      grandTotal: invoice?.grandTotal,
      invoiceTotal: invoice?.invoiceTotal,
      totalAmount: invoice?.totalAmount,
      subtotal: invoice?.subtotal,
      gst: invoice?.gst,
      quantity: invoice?.quantity,
      rawTotal,
    });
    throw new Error("Invoice total is missing or zero");
  }

  const payload = {
    invoiceId: invoice?.id,
    invoiceNumber: invoice?.invoiceNumber,
    customerName: selectedClient?.name || selectedClient?.businessName || "",
    customerEmail: selectedClient?.email || "",
    description:
      invoice?.description ||
      `Invoice ${invoice?.invoiceNumber || invoice?.id || ""}`,
    amount: Number(rawTotal.toFixed(2)),
    currency: String(invoice?.currencyCode || "AUD").toLowerCase(),
    successUrl: `${window.location.origin}?stripe=success&invoice=${encodeURIComponent(
      invoice?.invoiceNumber || ""
    )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
    cancelUrl: `${window.location.origin}?stripe=cancel&invoice=${encodeURIComponent(
      invoice?.invoiceNumber || ""
    )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
  };

  const response = await fetch(`${serverBaseUrl}/api/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Stripe checkout response error", data);
    throw new Error(data?.error || "Stripe checkout failed");
  }

  if (!data?.url) {
    throw new Error("Stripe checkout URL was not returned");
  }

  return data.url;
};
