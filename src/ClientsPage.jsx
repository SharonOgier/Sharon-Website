import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ClientsPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function ClientsPage(props) {
  const {
    profile,
    clients,
    invoices,
    setActivePage,
    confirm,
    cardStyle,
    colours,
    currency,
    safeNumber,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    showClientModal,
    setShowClientModal,
    showImportModal,
    setShowImportModal,
    editingClientId,
    setEditingClientId,
    clientModalForm,
    setClientModalForm,
    importType,
    setImportType,
    importRows,
    setImportRows,
    importError,
    setImportError,
    invClientSearch,
    setInvClientSearch,
    saveClientFromModal,
    deleteClient,
    confirmImport,
    downloadTemplate,
    parseImportCSV,
    openClientEditor,
    blankClient,
  } = props;

    const activeClients = clients.filter((c) => {
      const clientInvoices = invoices.filter((inv) => String(inv.clientId) === String(c.id));
      return clientInvoices.length > 0;
    });
    const gstExemptClients = clients.filter((c) => c.outsideAustraliaOrGstExempt);
    const totalClientRevenue = invoices
      .filter((inv) => inv.status === "Paid")
      .reduce((sum, inv) => sum + safeNumber(inv.total), 0);
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="Clients"
        subtitle="Manage your client roster, billing preferences, and GST settings. All clients feed directly into your invoices and quotes."
        highlight={String(clients.length)}
      >
        <InsightChip label="Active (invoiced)" value={String(activeClients.length)} />
        <InsightChip label="GST exempt" value={String(gstExemptClients.length)} />
        <InsightChip label="Total paid revenue" value={currency(totalClientRevenue)} />
      </DashboardHero>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
        <MetricCard title="Total clients" value={String(clients.length)} subtitle="All clients currently in the portal." accent={colours.navy} />
        <MetricCard title="Active clients" value={String(activeClients.length)} subtitle="Clients with at least one invoice." accent={colours.teal} />
        <MetricCard title="GST exempt" value={String(gstExemptClients.length)} subtitle="Clients outside Australia or GST exempt." accent={colours.purple} />
        <MetricCard title="Paid revenue" value={currency(totalClientRevenue)} subtitle="Total paid invoices across all clients." accent={colours.navy} />
      </div>

      <SectionCard title="Client details">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>What is the name of the person or organisation? *</label>
            <input
              style={inputStyle}
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>What type of work do you do for this Client? *</label>
            <select
              style={inputStyle}
              value={clientForm.workType}
              onChange={(e) => setClientForm({ ...clientForm, workType: e.target.value })}
            >
              <option>Financial / Management Accountant</option>
              <option>Bookkeeping</option>
              <option>Payroll</option>
              <option>BAS / GST Services</option>
              <option>Business Advisory</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>What is the name of the contact person there?</label>
            <input
              style={inputStyle}
              value={clientForm.contactPerson}
              onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>What is their email address?</label>
            <input
              style={inputStyle}
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={clientForm.recruiterUsed}
              onChange={(e) => setClientForm({ ...clientForm, recruiterUsed: e.target.checked })}
            />
            I went through a recruiter or similar third party to get this work
          </label>
        </div>

        <details style={{ ...cardStyle, marginTop: 20, padding: 18, background: "#FAFAFA" }}>
          <summary style={{ fontWeight: 800, marginBottom: 14, cursor: "pointer" }}>Invoice & Quote Options</summary>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendToClient}
                onChange={(e) => setClientForm({ ...clientForm, sendToClient: e.target.checked })}
              />
              Send to my Client
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendToMe}
                onChange={(e) => setClientForm({ ...clientForm, sendToMe: e.target.checked })}
              />
              Send to me
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.autoReminders}
                onChange={(e) => setClientForm({ ...clientForm, autoReminders: e.target.checked })}
              />
              Automatically send reminders once an Invoice is more than 2 days overdue
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.includeAddressDetails}
                onChange={(e) =>
                  setClientForm({ ...clientForm, includeAddressDetails: e.target.checked })
                }
              />
              Include Client address or other details
            </label>

            {clientForm.includeAddressDetails && (
              <div>
                <label style={labelStyle}>Client address/additional details</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  value={clientForm.addressDetails}
                  onChange={(e) =>
                    setClientForm({ ...clientForm,
                      addressDetails: e.target.value,
                      address: e.target.value,
                    })
                  }
                />
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendReceipts}
                onChange={(e) => setClientForm({ ...clientForm, sendReceipts: e.target.checked })}
              />
              Send receipts to this client for Invoice payments made via card
            </label>
          </div>
        </details>

        <details style={{ ...cardStyle, marginTop: 20, padding: 18, background: "#FAFAFA" }}>
          <summary style={{ fontWeight: 800, marginBottom: 14, cursor: "pointer" }}>Advanced Options</summary>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.outsideAustraliaOrGstExempt}
                onChange={(e) =>
                  setClientForm({ ...clientForm,
                    outsideAustraliaOrGstExempt: e.target.checked,
                  })
                }
              />
              This Client is outside Australia or Services for this Client are exempt from GST
            </label>

            <div style={{ maxWidth: 220 }}>
              <label style={labelStyle}>Default currency:</label>
              <select
                style={inputStyle}
                value={clientForm.defaultCurrency}
                onChange={(e) => setClientForm({ ...clientForm, defaultCurrency: e.target.value })}
              >
                <option>AUD $</option>
                <option>USD $</option>
                <option>NZD $</option>
                <option>GBP £</option>
                <option>EUR €</option>
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.feesDeducted}
                onChange={(e) => setClientForm({ ...clientForm, feesDeducted: e.target.checked })}
              />
              Payments will have fees or expenses deducted
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.deductsTaxPrior}
                onChange={(e) => setClientForm({ ...clientForm, deductsTaxPrior: e.target.checked })}
              />
              This Client deducts tax prior to payment
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.shortTermRentalIncome}
                onChange={(e) =>
                  setClientForm({ ...clientForm, shortTermRentalIncome: e.target.checked })
                }
              />
              This “Client” is for short-term rental income
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.hasPurchaseOrder}
                onChange={(e) => setClientForm({ ...clientForm, hasPurchaseOrder: e.target.checked })}
              />
              I have a purchase order or reference number
            </label>
          </div>
        </details>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <button style={buttonSecondary} onClick={() => setClientForm(blankClient)}>
            Cancel
          </button>
          <button style={buttonPrimary} onClick={saveClient}>
            Save
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Client List">
        <DataTable
          emptyState={{ icon: "👥", title: "No clients yet", message: "Add your first client above to start creating invoices and quotes." }}
          columns={[
            { key: "name", label: "Client" },
            { key: "contactPerson", label: "Contact" },
            { key: "workType", label: "Work Type" },
            { key: "isPaid", label: "Status", render: (v, row) => (row.isPaid ? "Paid" : (((row.dueDate || row.date || "") < todayLocal()) ? "Overdue" : "Unpaid")) },
            { key: "email", label: "Email" },
            { key: "defaultCurrency", label: "Currency" },
            {
              key: "actions",
              label: "",
              render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={() => openClientEditor(row)}>View / Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteClient(row.id)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={clients}
        />

        {clientEditorOpen && clientEditorForm ? (
          <div style={{ marginTop: 20, ...cardStyle, padding: 20, border: `2px solid ${colours.lightPurple}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>View / Edit Client</h3>
              <button style={buttonSecondary} onClick={closeClientEditor}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div><label style={labelStyle}>Client name</label><input style={inputStyle} value={clientEditorForm.name} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
              <div><label style={labelStyle}>Contact person</label><input style={inputStyle} value={clientEditorForm.contactPerson || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, contactPerson: e.target.value }))} /></div>
              <div><label style={labelStyle}>Email</label><input style={inputStyle} value={clientEditorForm.email || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
              <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={clientEditorForm.phone || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
              <div><label style={labelStyle}>Work type</label><input style={inputStyle} value={clientEditorForm.workType || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, workType: e.target.value }))} /></div>
              <div><label style={labelStyle}>Default currency</label><select style={inputStyle} value={clientEditorForm.defaultCurrency || "AUD $"} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}><option>AUD $</option><option>USD $</option><option>NZD $</option><option>GBP £</option><option>EUR €</option></select></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Address details</label><textarea style={{ ...inputStyle, minHeight: 90 }} value={clientEditorForm.addressDetails || clientEditorForm.address || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, addressDetails: e.target.value, address: e.target.value }))} /></div>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.outsideAustraliaOrGstExempt)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, outsideAustraliaOrGstExempt: e.target.checked }))} /> Client is GST exempt / outside Australia</label>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.feesDeducted)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, feesDeducted: e.target.checked }))} /> Fees deducted before payment</label>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.deductsTaxPrior)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, deductsTaxPrior: e.target.checked }))} /> Client deducts tax prior to payment</label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
              <button style={buttonSecondary} onClick={closeClientEditor}>Cancel</button>
              <button style={buttonPrimary} onClick={saveClientEdits}>Save Changes</button>
            </div>
          </div>
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}
      </SectionCard>
    </div>
    );

}
