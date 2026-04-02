import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ServicesPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function ServicesPage(props) {
  const {
    services,
    serviceSearch,
    setServiceSearch,
    showServiceModal,
    setShowServiceModal,
    editingServiceId,
    serviceForm,
    setServiceForm,
    savingService,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    safeNumber,
    currency,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    GST_TYPE_OPTIONS,
    openNewServiceModal,
    openEditServiceModal,
    saveService,
    deleteService,
    handleServiceFormChange,
  } = props;

    const filteredServices = services.filter((service) =>
      service.name.toLowerCase().includes(serviceSearch.toLowerCase())
    );
    const totalServiceValue = services.reduce((s, svc) => s + safeNumber(svc.total || svc.price), 0);
    const gstServices = services.filter((s) => s.gstType === "GST on Income (10%)");
    const gstFreeServices = services.filter((s) => s.gstType !== "GST on Income (10%)");
    const avgPrice = services.length > 0 ? services.reduce((s, svc) => s + safeNumber(svc.price), 0) / services.length : 0;
    const topServices = [...services].sort((a, b) => safeNumber(b.price) - safeNumber(a.price)).slice(0, 6).map((s) => ({ label: s.name?.slice(0, 8) || "—", value: safeNumber(s.price) }));
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero title="Services" subtitle="Manage your service catalogue. Services auto-populate into invoices and quotes." highlight={String(services.length)}>
          <InsightChip label="GST applicable" value={String(gstServices.length)} />
          <InsightChip label="GST free" value={String(gstFreeServices.length)} />
          <InsightChip label="Avg price" value={currency(avgPrice)} />
        </DashboardHero>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricCard title="Total services" value={String(services.length)} subtitle="Services in your catalogue." accent={colours.navy} />
          <MetricCard title="GST applicable" value={String(gstServices.length)} subtitle="Services with 10% GST." accent={colours.teal} />
          <MetricCard title="GST free" value={String(gstFreeServices.length)} subtitle="Exempt or input-taxed services." accent={colours.purple} />
          <MetricCard title="Average price" value={currency(avgPrice)} subtitle="Mean price across all services." accent={colours.navy} />
          <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Top services by price</div>
            <MiniBarChart data={topServices} height={90} accent={colours.teal} />
          </div>
        </div>
        <SectionCard
          title="Services"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={{ ...inputStyle, minWidth: 220 }}
                placeholder="Search services"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
              />
              <button style={buttonPrimary} onClick={openNewServiceModal}>
                New Service
              </button>
            </div>
          }
        >
          <DataTable
            emptyState={{ icon: "⚙️", title: "No services yet", message: "Add services to your catalogue and they will auto-populate into new invoices and quotes." }}
            columns={[
              { key: "name", label: "Service" },
              { key: "gstType", label: "GST Type" },
              { key: "price", label: "Price", render: (v) => currency(v) },
              { key: "gst", label: "GST", render: (v) => currency(v) },
              { key: "total", label: "Total", render: (v) => currency(v) },
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => openEditServiceModal(row)}>
                      Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => deleteService(row.id)}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredServices}
          />
        </SectionCard>

        {showServiceModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: colours.white,
                borderRadius: 12,
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 20, borderBottom: `1px solid ${colours.border}` }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: colours.text }}>
                  {editingServiceId ? "Edit Service" : "New Service"}
                </div>
              </div>

              <div style={{ padding: 20, display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Service Name</label>
                  <input
                    style={inputStyle}
                    value={serviceForm.name}
                    onChange={(e) => handleServiceFormChange("name", e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>GST Type</label>
                  <select
                    style={inputStyle}
                    value={serviceForm.gstType}
                    onChange={(e) => handleServiceFormChange("gstType", e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="GST on Income (10%)">GST on Income (10%)</option>
                    <option value="GST Free">GST Free</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Price</label>
                  <input
                    style={inputStyle}
                    value={serviceForm.price}
                    onChange={(e) => handleServiceFormChange("price", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>GST</label>
                    <input style={inputStyle} value={serviceForm.gst} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Total</label>
                    <input style={inputStyle} value={serviceForm.total} readOnly />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                  padding: 20,
                  borderTop: `1px solid ${colours.border}`,
                }}
              >
                <button
                  style={buttonSecondary}
                  onClick={() => {
                    setShowServiceModal(false);
                    resetServiceForm();
                  }}
                >
                  Cancel
                </button>
                <button style={buttonPrimary} onClick={saveService}>
                  Save Service
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

}
