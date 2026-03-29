import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      invoiceId,
      invoiceNumber,
      amount,
      currency = "aud",
      description,
      customerName,
      customerEmail,
      businessEmail,
      sendToClient = true,
      sendToMe = false,
      sendReceipts = true,
      successUrl,
      cancelUrl,
    } = req.body || {};

    if (!invoiceId || !invoiceNumber || !amount) {
      return res.status(400).json({ error: "Missing invoice data." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      payment_method_types: ["card"],

      metadata: {
        invoiceId: String(invoiceId),
        invoiceNumber: String(invoiceNumber),
        customerName: String(customerName || ""),
        customerEmail: String(customerEmail || ""),
        businessEmail: String(businessEmail || ""),
        sendToClient: String(sendToClient),
        sendToMe: String(sendToMe),
        sendReceipts: String(sendReceipts),
      },

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            product_data: {
              name: `Invoice ${invoiceNumber}`,
              description: description || "Accounting services",
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
        },
      ],

      success_url:
        successUrl ||
        `${process.env.BASE_URL}/?invoice=${invoiceId}&status=paid`,
      cancel_url:
        cancelUrl ||
        `${process.env.BASE_URL}/?invoice=${invoiceId}&status=cancelled`,
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to create Stripe checkout session.",
    });
  }
}