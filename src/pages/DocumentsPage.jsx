import React, { useState, useMemo } from "react";

// -----------------------------------------------------------------------------
// DocumentsPage
// All state and handlers come from SharonPortalWebsite via props.
// -----------------------------------------------------------------------------

export default function DocumentsPage(props) {
  const {
    documents,
    documentFile,
    setDocumentFile,
    documentEditorOpen,
    documentEditorForm,
    setDocumentEditorForm,
    savingDocumentEdits,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    formatDateAU,
    safeNumber,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    MiniBarChart,
    uploadDocument,
    deleteDocument,
    openDocumentEditor,
    closeDocumentEditor,
    saveDocumentEdits,
    openDocumentFile = null,
  } = props;

    const recentDocs = [...documents].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)).slice(0, 1);
    const lastUploaded = recentDocs[0] ? formatDateAU(recentDocs[0].uploadedAt) : "None yet";
    const docTypes = documents.reduce((acc, d) => {
      const ext = String(d.name || "").split(".").pop().toLowerCase() || "other";
      acc[ext] = (acc[ext] || 0) + 1; return acc;
    }, {});
    const typeData = Object.entries(docTypes).slice(0, 6).map(([label, value]) => ({ label, value }));
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Documents" subtitle="Store, organise and access all your portal documents, receipts and generated PDFs in one place." highlight={String(documents.length)}>
        <InsightChip label="Total files" value={String(documents.length)} />
        <InsightChip label="Last uploaded" value={lastUploaded} />
        <InsightChip label="File types" value={String(Object.keys(docTypes).length)} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Total documents" value={String(documents.length)} subtitle="All files stored in the portal." accent={colours.purple} />
        <MetricCard title="Last uploaded" value={lastUploaded} subtitle="Most recently added document." accent={colours.teal} />
        <MetricCard title="File types" value={String(Object.keys(docTypes).length)} subtitle="Distinct file extensions stored." accent={colours.purple} />
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Files by type</div>
          <MiniBarChart data={typeData.length ? typeData : [{ label: "None", value: 0 }]} height={70} accent={colours.purple} />
        </div>
      </div>
      <SectionCard
        title="Documents"
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input type="file" style={{ ...inputStyle, padding: "8px 10px", maxWidth: 260 }} onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
            <button style={buttonPrimary} onClick={uploadDocument}>Upload</button>
          </div>
        }
      >
        <div style={{ color: colours.muted, fontSize: 14, marginBottom: 16 }}>Store generated PDFs, supporting documents, and uploaded files here.</div>
        {documents.length ? (
          <DataTable
            columns={[
              { key: "name", label: "Document" },
              { key: "uploadedAt", label: "Uploaded", render: (v) => formatDateAU(v) },
              { key: "actions", label: "", render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(row.filePath || row.url) && (
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => openDocumentFile ? openDocumentFile(row) : row.url && window.open(row.url, "_blank", "noopener,noreferrer")}
                    >View</button>
                  )}
                  <button style={buttonSecondary} onClick={() => openDocumentEditor(row)}>Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteDocument(row.id)}>Delete</button>
                </div>
              )},
            ]}
            rows={documents}
          />
        ) : (
          <div style={{ color: colours.muted, fontSize: 14 }}>No documents uploaded yet.</div>
        )}
        {documentEditorOpen && documentEditorForm ? (
          <div style={{ marginTop: 20, ...cardStyle, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>View / Edit Document</h3>
              <button style={buttonSecondary} onClick={closeDocumentEditor}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div><label style={labelStyle}>Document name</label><input style={inputStyle} value={documentEditorForm.name || ""} onChange={(e) => setDocumentEditorForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
              <div><label style={labelStyle}>{documentEditorForm.filePath ? "Stored file path" : "URL"}</label><input style={inputStyle} value={documentEditorForm.filePath || documentEditorForm.url || ""} onChange={(e) => !documentEditorForm.filePath && setDocumentEditorForm((prev) => ({ ...prev, url: e.target.value }))} readOnly={Boolean(documentEditorForm.filePath)} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
              <button style={buttonSecondary} onClick={closeDocumentEditor}>Cancel</button>
              <button style={buttonPrimary} onClick={saveDocumentEdits}>Save Changes</button>
            </div>
          </div>
        ) : <EmptyState icon="" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}
      </SectionCard>
    </div>
    );

}
