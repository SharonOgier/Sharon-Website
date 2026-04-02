import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SetupWizardPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function SetupWizardPage(props) {
  const {
    wizardForm,
    setWizardForm,
    wizardSaving,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    completeSetupWizard,
    handleSignOut,
  } = props;

    <div style={{ minHeight: "100vh", background: colours.bg, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 760, padding: 28 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: colours.text, marginBottom: 8 }}>Welcome to your portal setup</div>
        <div style={{ fontSize: 14, color: colours.muted, marginBottom: 22 }}>
          This wizard appears only for users who have not completed setup yet. It fills your Settings → Profile page first, then sends you to Settings so you can finish the rest of the pages yourself.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div><label style={labelStyle}>First name</label><input style={inputStyle} value={wizardForm.firstName} onChange={(e) => setWizardForm((prev) => ({ ...prev, firstName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Last name</label><input style={inputStyle} value={wizardForm.lastName} onChange={(e) => setWizardForm((prev) => ({ ...prev, lastName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Preferred name</label><input style={inputStyle} value={wizardForm.preferredName} onChange={(e) => setWizardForm((prev) => ({ ...prev, preferredName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Business name *</label><input style={inputStyle} value={wizardForm.businessName} onChange={(e) => setWizardForm((prev) => ({ ...prev, businessName: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Legal business name</label><input style={inputStyle} value={wizardForm.legalBusinessName} onChange={(e) => setWizardForm((prev) => ({ ...prev, legalBusinessName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Email *</label><input style={inputStyle} value={wizardForm.email} onChange={(e) => setWizardForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={wizardForm.phone} onChange={(e) => setWizardForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Address</label><input style={inputStyle} value={wizardForm.address} onChange={(e) => setWizardForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
          <div><label style={labelStyle}>ABN</label><input style={inputStyle} value={wizardForm.abn} onChange={(e) => setWizardForm((prev) => ({ ...prev, abn: e.target.value }))} /></div>
          <div><label style={labelStyle}>Work type</label><input style={inputStyle} value={wizardForm.workType} onChange={(e) => setWizardForm((prev) => ({ ...prev, workType: e.target.value }))} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}><input type="checkbox" checked={wizardForm.gstRegistered} onChange={(e) => setWizardForm((prev) => ({ ...prev, gstRegistered: e.target.checked }))} />GST Registered</label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <button style={buttonPrimary} onClick={completeSetupWizard} disabled={wizardSaving}>{wizardSaving ? "Saving..." : "Continue to Dashboard"}</button>
          <button style={buttonSecondary} onClick={handleSignOut}>Log out</button>
        </div>
      </div>
    </div>

}
