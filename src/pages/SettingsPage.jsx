import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage(props) {
  const {
    profile,
    setProfile,
    activeSettingsTab,
    setActiveSettingsTab,
    savingClient,
    newPassword,
    setNewPassword,
    newPasswordConfirm,
    setNewPasswordConfirm,
    isResettingPassword,
    setIsResettingPassword,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    currency,
    safeNumber,
    isValidEmail,
    DEFAULT_MONTHLY_SUBSCRIPTION,
    settingsTabs,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    saveProfileToSupabase,
    handleCloseAccount,
    handleSignOut,
    toast,
  } = props;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Settings" subtitle="Configure your business profile, financial settings, branding and security. Changes save to your Supabase database automatically." highlight={activeSettingsTab}>
        <InsightChip label="Business" value={profile.businessName || "Not set"} />
        <InsightChip label="ABN" value={profile.abn || "Not set"} />
        <InsightChip label="GST" value={profile.gstRegistered ? "Registered" : "Not registered"} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Tax rate" value={`${profile.taxRate || 30}%`} subtitle="Income tax rate used for reserve estimates." accent={colours.navy} />
        <MetricCard title="Payment terms" value={`${profile.paymentTermsDays || 14} days`} subtitle="Default days until invoice is due." accent={colours.teal} />
        <MetricCard title="Subscription fee" value={currency(safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION))} subtitle="Monthly portal fee deducted from Safe to Spend." accent={colours.purple} />
        <MetricCard title="Invoice prefix" value={profile.invoicePrefix || "INV"} subtitle="Auto-applied to all new invoice numbers." accent={colours.navy} />
      </div>
      <SectionCard
        title="Settings"
        right={
          <div style={{ minWidth: 220 }}>
            <select
              style={inputStyle}
              value={activeSettingsTab}
              onChange={(e) => setActiveSettingsTab(e.target.value)}
            >
              {settingsTabs.map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {activeSettingsTab === "Profile" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Business Name</label>
              <input
                style={inputStyle}
                value={profile.businessName}
                onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>ABN</label>
              <input
                style={inputStyle}
                value={profile.abn}
                onChange={(e) => setProfile({ ...profile, abn: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>
              <input
                style={inputStyle}
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={buttonPrimary} onClick={async () => {
                try {
                  await saveProfileToSupabase(profile);
                  toast.success("Profile saved!");
                } catch (err) { toast.error(err.message || "Failed to save profile"); }
              }}>Save Profile</button>
            </div>
          </div>
        )}

        {activeSettingsTab === "Financial" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Invoice Prefix</label>
              <input
                style={inputStyle}
                value={profile.invoicePrefix}
                onChange={(e) => setProfile({ ...profile, invoicePrefix: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Quote Prefix</label>
              <input
                style={inputStyle}
                value={profile.quotePrefix}
                onChange={(e) => setProfile({ ...profile, quotePrefix: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Payment Terms (days)</label>
              <input
                type="number"
                style={inputStyle}
                value={profile.paymentTermsDays}
                onChange={(e) => setProfile({ ...profile, paymentTermsDays: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Tax Rate %</label>
              <input
                type="number"
                style={inputStyle}
                value={profile.taxRate}
                onChange={(e) => setProfile({ ...profile, taxRate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Portal Subscription Fee ($/mo)</label>
              <input
                type="number"
                style={inputStyle}
                value={profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION}
                onChange={(e) => setProfile({ ...profile, monthlySubscription: safeNumber(e.target.value) })}
                placeholder="45"
                min="0"
                step="1"
              />
              <div style={{ fontSize: 12, color: colours.muted, marginTop: 4 }}>Fixed monthly subscription cost ($45 default). Deducted from Safe to Spend on the dashboard.</div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.gstRegistered}
                onChange={(e) => setProfile({ ...profile, gstRegistered: e.target.checked })}
              />
              GST Registered
            </label>

            <div>
              <label style={labelStyle}>Bank Name</label>
              <input
                style={inputStyle}
                value={profile.bankName}
                onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>BSB</label>
              <input
                style={inputStyle}
                value={profile.bsb}
                onChange={(e) => setProfile({ ...profile, bsb: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Account Number</label>
              <input
                style={inputStyle}
                value={profile.accountNumber}
                onChange={(e) => setProfile({ ...profile, accountNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>PayID</label>
              <input
                style={inputStyle}
                value={profile.payId}
                onChange={(e) => setProfile({ ...profile, payId: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Stripe Payment Link</label>
              <input
                style={inputStyle}
                value={profile.stripePaymentLink || ""}
                onChange={(e) => setProfile({ ...profile, stripePaymentLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>PayPal Business Email</label>
              <input
                style={inputStyle}
                value={profile.paypalBusinessEmail || ""}
                onChange={(e) => setProfile({ ...profile, paypalBusinessEmail: e.target.value.trim() })}
                placeholder="your-paypal-email@example.com"
              />
              <div style={{ fontSize: 12, color: colours.muted, marginTop: 4 }}>
                Used to generate a PayPal checkout link with the invoice amount prefilled. Do not use a PayPal.Me link here.
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Stripe Server URL</label>
              <input
                style={inputStyle}
                value={profile.stripeServerUrl || ""}
                onChange={(e) => setProfile({ ...profile, stripeServerUrl: e.target.value })}
                placeholder="Leave blank for automatic live URL, or enter your backend URL"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={buttonPrimary} onClick={async () => {
                try {
                  await saveProfileToSupabase(profile);
                  toast.success("Financial settings saved!");
                } catch (err) { toast.error(err.message || "Failed to save settings"); }
              }}>Save Financial Settings</button>
            </div>
          </div>
        )}

        {activeSettingsTab === "Branding" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Upload Logo</label>
              <input
                type="file"
                accept="image/*"
                style={inputStyle}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await fileToDataUrl(file);
                  const updated = { ...profile, logoFileName: file.name, logoDataUrl: dataUrl };
                  setProfile(updated);
                  try {
                    await saveProfileToSupabase(updated);
                    toast.success("Logo saved!");
                  } catch (err) { toast.error("Logo uploaded but failed to save — click Save Branding"); }
                }}
              />
            </div>

            {profile.logoDataUrl ? (
              <div>
                <img
                  src={profile.logoDataUrl}
                  alt="Logo preview"
                  style={{ maxHeight: LOGO_PREVIEW_MAX_HEIGHT, maxWidth: LOGO_PREVIEW_MAX_WIDTH, objectFit: "contain" }}
                />
              </div>
            ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

            <div>
              <label style={labelStyle}>Legal Business Name</label>
              <input
                style={inputStyle}
                value={profile.legalBusinessName}
                onChange={(e) => setProfile({ ...profile, legalBusinessName: e.target.value })}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hideLegalNameOnDocs}
                onChange={(e) => setProfile({ ...profile, hideLegalNameOnDocs: e.target.checked })}
              />
              Hide legal name on documents
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hideAddressOnDocs}
                onChange={(e) => setProfile({ ...profile, hideAddressOnDocs: e.target.checked })}
              />
              Hide address on documents
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hidePhoneOnDocs}
                onChange={(e) => setProfile({ ...profile, hidePhoneOnDocs: e.target.checked })}
              />
              Hide phone on documents
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={buttonPrimary} onClick={async () => {
                try {
                  await saveProfileToSupabase(profile);
                  toast.success("Branding saved!");
                } catch (err) { toast.error(err.message || "Failed to save branding"); }
              }}>
                Save Branding
              </button>
            </div>
          </div>
        )}

        {activeSettingsTab === "Security" && (
          <div style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.twoFactor}
                onChange={(e) => setProfile({ ...profile, twoFactor: e.target.checked })}
              />
              Enable two-factor authentication
            </label>

            <div style={{ borderTop: `1px solid ${colours.border}`, paddingTop: 20, marginTop: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: colours.text, marginBottom: 6 }}>Close Account</div>
              <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16, lineHeight: 1.6 }}>
                Closing your account will sign you out and disable access to the portal. Your data will be kept safe and your account can be reactivated at any time by contacting{" "}
                <a href="mailto:info@sharonogier.com" style={{ color: colours.purple }}>info@sharonogier.com</a>.
              </div>
              <button
                onClick={() => confirm({
                  title: "Close your account?",
                  message: "You will be signed out and lose access to the portal. Your data is kept safe and your account can be reactivated at any time by contacting us.",
                  confirmLabel: "Close Account",
                  onConfirm: handleCloseAccount,
                })}
                style={{
                  background: "#fff",
                  color: "#EF4444",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close Account
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );

}
