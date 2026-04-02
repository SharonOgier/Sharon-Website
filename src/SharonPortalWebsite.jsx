import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./client";
import MobileWizard from "./MobileWizard";
import {
  ToastContainer,
  useToast,
  useConfirm,
  PaywallScreen,
  SectionCard,
  SummaryBox,
  DashboardHero,
  InsightChip,
  MetricCard,
  ActionHubCard,
  MiniBarChart,
  TrendBarsCard,
  WaterfallCard,
  ActivityListCard,
  EmptyState,
  DataTable,
  ExpenseTypeModal,
  IncomeSourceModal,
} from "./PortalComponents";
import {
  colours,
  navSections,
  navLabels,
  settingsTabs,
  isValidEmail,
  collectValidationErrors,
  summariseValidationErrors,
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  DEFAULT_MONTHLY_SUBSCRIPTION,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_TABLES,
  GST_TYPE_OPTIONS,
  expenseCategories,
  incomeTypeOptions,
  incomeFrequencyOptions,
  inputStyle,
  labelStyle,
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  currency,
  safeNumber,
  parseLocalDate,
  todayLocal,
  formatDateAU,
  addDays,
  addDaysEOM,
  nextNumber,
  makePaymentReference,
  formatCurrencyByCode,
  getClientCurrencyCode,
  calculateAdjustmentValues,
  fileToDataUrl,
  blankClient,
  initialProfile,
  initialClients,
  initialInvoices,
  initialQuotes,
  initialExpenses,
  initialIncomeSources,
  initialDocuments,
  formatMonthKey,
  formatMonthLabel,
  getSubscriptionAccess,
  LOCKED_FEE_RATE_PERCENT,
} from "./PortalHelpers";
import {
  buildQuoteHtml,
  buildQuoteEmailHtml,
  buildInvoiceHtml,
  openBlobUrlInWindow,
  writeInvoicePreviewToWindow,
} from "./PortalDocumentBuilders";


export default function AccountingPortalPrototype() {
  const { toasts, toast, removeToast } = useToast();
  const { confirm, modal: confirmModal } = useConfirm();

  const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_DOCUMENT_FILE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const getMimeTypeFromFile = (file) => {
    const explicitType = String(file?.type || "").trim().toLowerCase();
    if (explicitType) return explicitType;
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".csv")) return "text/csv";
    if (name.endsWith(".xls")) return "application/vnd.ms-excel";
    if (name.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (name.endsWith(".doc")) return "application/msword";
    if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return "";
  };

  const validateSelectedFile = (file, { allowedTypes, maxBytes, label }) => {
    if (!file) throw new Error(`Please select a ${label.toLowerCase()} file first.`);
    const mimeType = getMimeTypeFromFile(file);
    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`${label} file type is not allowed.`);
    }
    if (safeNumber(file.size) <= 0) {
      throw new Error(`${label} file appears to be empty.`);
    }
    if (safeNumber(file.size) > maxBytes) {
      throw new Error(`${label} file is too large.`);
    }
    return mimeType;
  };
  const [savingClient, setSavingClient] = useState(false);
  const [savingClientEdits, setSavingClientEdits] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingInvoiceEdits, setSavingInvoiceEdits] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [savingQuoteEdits, setSavingQuoteEdits] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingIncomeSource, setSavingIncomeSource] = useState(false);
  const [savingDocumentEdits, setSavingDocumentEdits] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [billWizardStep, setBillWizardStep] = useState(1);
  const [invoiceWizardStep, setInvoiceWizardStep] = useState(1);
  const [showARCreditNoteModal, setShowARCreditNoteModal] = useState(false);
  const [showAPCreditNoteModal, setShowAPCreditNoteModal] = useState(false);
  const [creditNoteSource, setCreditNoteSource] = useState(null);
  const [creditNoteForm, setCreditNoteForm] = useState({ amount: "", reason: "", date: todayLocal() });
  const [knownSuppliers, setKnownSuppliers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [basQuarter, setBasQuarter] = useState("0");
  const [basNotes, setBasNotes] = useState({ lodgedDate: "", referenceNumber: "", notes: "" });
  const [importType, setImportType] = useState("clients");
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientModalForm, setClientModalForm] = useState({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" });
  const [invClientSearch, setInvClientSearch] = useState("");
  const [quoteClientSearch, setQuoteClientSearch] = useState("");
  const [supplierForm, setSupplierForm] = useState({ name: "", email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" });
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [invoiceAlerts, setInvoiceAlerts] = useState([]);
  const [showInvoiceAlerts, setShowInvoiceAlerts] = useState(false);
  const invoiceAlertsShownRef = useRef(false);
  const [recurringDue, setRecurringDue] = useState([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringSelected, setRecurringSelected] = useState([]);
  const recurringShownRef = useRef(false);
  const [quoteWizardStep, setQuoteWizardStep] = useState(1);
  const [activePage, setActivePage] = useState("dashboard");
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [showMobileWizard, setShowMobileWizard] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [activeSettingsTab, setActiveSettingsTab] = useState("Profile");
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showResetSentModal, setShowResetSentModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [setupComplete, setSetupComplete] = useState(false);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [hasLoadedUserProfile, setHasLoadedUserProfile] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    businessName: "",
    legalBusinessName: "",
    email: "",
    phone: "",
    address: "",
    abn: "",
    workType: "Financial / Management Accountant",
    gstRegistered: true,
  });
  const hasHydratedSupabaseState = useRef(false);
  const lastSavedProfileRef = useRef(null);
  const isSigningOut = useRef(false);
  const [isSupabaseRestoring, setIsSupabaseRestoring] = useState(false);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState(
    supabase ? "Ready to sync to database" : "Supabase not connected"
  );
  const [profile, setProfile] = useState(initialProfile);
  const [clients, setClients] = useState(initialClients);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [incomeSources, setIncomeSources] = useState(initialIncomeSources);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentFile, setDocumentFile] = useState(null);
  const [services, setServices] = useState([]);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    gstType: "GST on Income (10%)",
    price: "",
    gst: "0.00",
    total: "0.00",
  });
  const [showIncomeSourceModal, setShowIncomeSourceModal] = useState(false);
  const [incomeSourceForm, setIncomeSourceForm] = useState({
    name: "",
    incomeType: "Casual employment",
    beforeTax: "",
    frequency: "",
    startedAfterDate: false,
    hasEndDate: false,
  });
  const [clientForm, setClientForm] = useState(blankClient);

  const blankLineItem = () => ({ id: Date.now() + Math.random(), description: "", quantity: 1, unitPrice: "", gstType: "GST on Income (10%)" });

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "",
    invoiceDate: todayLocal(),
    dueDate: addDays(todayLocal(), initialProfile.paymentTermsDays),
    startDate: "",
    endDate: "",
    sendDate: "",
    sendTime: "",
    recurs: "Never",
    lineItems: [blankLineItem()],
    gstType: "GST on Income (10%)",
    manualGst: false,
    currencyCode: "AUD",
    description: "",
    subtotal: "",
    comments: "",
    purchaseOrderReference: "",
    includesUntaxedPortion: false,
    hidePhoneNumber: initialProfile.hidePhoneOnDocs,
    quantity: 1,
    gstOverride: "",
    savedRecordId: null,
    invoiceNumber: "",
  });

  const buildInvoiceEditorForm = (invoice) => {
    const quantity = Math.max(1, safeNumber(invoice?.quantity || 1));
    const unitPrice = quantity ? safeNumber(invoice?.subtotal) / quantity : safeNumber(invoice?.subtotal);
    const selectedClient = getClientById(invoice?.clientId) || clients[0];
    const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);
    return {
      id: invoice?.id || null,
      invoiceNumber: invoice?.invoiceNumber || "",
      clientId: invoice?.clientId || clients[0]?.id || "",
      invoiceDate: invoice?.invoiceDate || todayLocal(),
      dueDate: invoice?.dueDate || addDays(invoice?.invoiceDate || todayLocal(), (safeNumber(profile.paymentTermsDays) || 14)),
      startDate: invoice?.startDate || "",
      endDate: invoice?.endDate || "",
      sendDate: invoice?.sendDate || "",
      sendTime: invoice?.sendTime || "",
      recurs: invoice?.recurs || "Never",
      lineItems: (invoice?.lineItems && invoice.lineItems.length > 0)
        ? invoice.lineItems
        : [{ id: Date.now(), description: invoice?.description || "", quantity: invoice?.quantity || 1, unitPrice: invoice?.subtotal ? (safeNumber(invoice.subtotal) / Math.max(1, safeNumber(invoice.quantity || 1))).toFixed(2) : "", gstType: gstExempt ? "GST Free" : invoice?.gstType || "GST on Income (10%)" }],
      gstType: gstExempt ? "GST Free" : invoice?.gstType || "GST on Income (10%)",
      manualGst: false,
      currencyCode: invoice?.currencyCode || getClientCurrencyCode(selectedClient),
      description: invoice?.description || "",
      subtotal: unitPrice ? unitPrice.toFixed(2) : "",
      comments: invoice?.comments || "",
      purchaseOrderReference: invoice?.purchaseOrderReference || "",
      includesUntaxedPortion: Boolean(invoice?.includesUntaxedPortion),
      hidePhoneNumber: invoice?.hidePhoneNumber == null ? profile.hidePhoneOnDocs : Boolean(invoice?.hidePhoneNumber),
      quantity,
      gstOverride: "",
      status: invoice?.status || "Draft",
      paymentReference: invoice?.paymentReference || makePaymentReference(invoice?.invoiceNumber || ""),
      stripeCheckoutUrl: invoice?.stripeCheckoutUrl || "",
    };
  };

  const [invoiceEditorOpen, setInvoiceEditorOpen] = useState(false);
  const [invoiceEditorForm, setInvoiceEditorForm] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    clientId: "",
    quoteDate: todayLocal(),
    expiryDate: addDays(todayLocal(), 31),
    lineItems: [{ id: Date.now() + Math.random(), description: "", quantity: 1, unitPrice: "", gstType: "GST on Income (10%)" }],
    gstType: "GST on Income (10%)",
    manualGst: false,
    currencyCode: "AUD",
    description: "",
    quantity: 1,
    subtotal: "",
    gstOverride: "",
    comments: "",
    hidePhoneNumber: initialProfile.hidePhoneOnDocs,
    savedRecordId: null,
    quoteNumber: "",
  });

  const buildQuoteEditorForm = (quote) => {
    const quantity = Math.max(1, safeNumber(quote?.quantity || 1));
    const unitPrice = quantity ? safeNumber(quote?.subtotal) / quantity : safeNumber(quote?.subtotal);
    const selectedClient = getClientById(quote?.clientId) || clients[0];
    const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);
    return {
      id: quote?.id || null,
      quoteNumber: quote?.quoteNumber || "",
      clientId: quote?.clientId || clients[0]?.id || "",
      quoteDate: quote?.quoteDate || todayLocal(),
      expiryDate: quote?.expiryDate || addDays(quote?.quoteDate || todayLocal(), 31),
      lineItems: (quote?.lineItems && quote.lineItems.length > 0)
        ? quote.lineItems
        : [{ id: Date.now(), description: quote?.description || "", quantity: quote?.quantity || 1, unitPrice: unitPrice ? unitPrice.toFixed(2) : "", gstType: gstExempt ? "GST Free" : quote?.gstType || "GST on Income (10%)" }],
      gstType: gstExempt ? "GST Free" : quote?.gstType || "GST on Income (10%)",
      manualGst: false,
      currencyCode: quote?.currencyCode || getClientCurrencyCode(selectedClient),
      description: quote?.description || "",
      quantity,
      subtotal: unitPrice ? unitPrice.toFixed(2) : "",
      gstOverride: "",
      comments: quote?.comments || "",
      hidePhoneNumber: quote?.hidePhoneNumber == null ? profile.hidePhoneOnDocs : Boolean(quote?.hidePhoneNumber),
      status: quote?.status || "Draft",
    };
  };

  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [quoteEditorForm, setQuoteEditorForm] = useState(null);

  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [clientEditorForm, setClientEditorForm] = useState(null);
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [expenseEditorForm, setExpenseEditorForm] = useState(null);
  const [incomeSourceEditorOpen, setIncomeSourceEditorOpen] = useState(false);
  const [incomeSourceEditorForm, setIncomeSourceEditorForm] = useState(null);
  const [documentEditorOpen, setDocumentEditorOpen] = useState(false);
  const [documentEditorForm, setDocumentEditorForm] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    date: todayLocal(),
    dueDate: addDaysEOM(todayLocal()),
    supplier: "",
    category: "",
    description: "",
    amount: "",
    expenseType: "",
    workType: profile.workType,
    receiptFileName: "",
    receiptUrl: "",
  });
  const blankBillLine = () => ({ id: Date.now() + Math.random(), description: "", category: "", amount: "", gstIncl: "yes" });
  const [billLineItems, setBillLineItems] = useState([blankBillLine()]);
  const [receiptFile, setReceiptFile] = useState(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseTypeStep, setExpenseTypeStep] = useState(1);
  const [expenseTypeSelection, setExpenseTypeSelection] = useState("");
  const [expenseWorkType, setExpenseWorkType] = useState(profile.workType);
  const [expenseWorkTypes, setExpenseWorkTypes] = useState([
    "Financial / Management Accountant",
    "Bookkeeping",
    "Payroll",
    "Business Advisory",
  ]);
  const [expenseCategorySelection, setExpenseCategorySelection] = useState("");
  const [searchExpenseCategory, setSearchExpenseCategory] = useState("");

  const clearPortalForFreshSetup = () => {
    setProfile(initialProfile);
    setClients([]);
    setInvoices([]);
    setQuotes([]);
    setExpenses([]);
    setIncomeSources([]);
    setServices([]);
    setDocuments([]);
    setSuppliers([]);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("sas_profile");
      window.localStorage.removeItem("sas_clients");
      window.localStorage.removeItem("sas_invoices");
      window.localStorage.removeItem("sas_quotes");
      window.localStorage.removeItem("sas_expenses");
      window.localStorage.removeItem("sas_incomeSources");
      window.localStorage.removeItem("sas_services");
      window.localStorage.removeItem("sas_documents");
    }
  };

  const buildWizardProfile = () => {
    const businessName = String(wizardForm.businessName || "").trim();
    const email = String(wizardForm.email || authUser?.email || "").trim();
    const firstName = String(wizardForm.firstName || "").trim();
    const preferredName = String(wizardForm.preferredName || "").trim();
    const address = String(wizardForm.address || "").trim();

    return { ...initialProfile,
      firstName,
      lastName: String(wizardForm.lastName || "").trim(),
      preferredName: preferredName || firstName,
      businessName,
      legalBusinessName: String(wizardForm.legalBusinessName || "").trim(),
      email,
      phone: String(wizardForm.phone || "").trim(),
      address,
      personalAddress: address,
      abn: String(wizardForm.abn || "").trim(),
      workType: wizardForm.workType || "Financial / Management Accountant",
      gstRegistered: Boolean(wizardForm.gstRegistered),
    };
  };

  const completeSetupWizard = async () => {
    const nextProfile = { ...buildWizardProfile(),
      setupComplete: true,
      setupCompletedAt: new Date().toISOString(),
      trialStartedAt: new Date().toISOString(),
      subscriptionStatus: "trialing",
    };
    const wizardErrors = collectValidationErrors(
      !nextProfile.businessName && "Please enter your business name.",
      !nextProfile.email && "Please enter your email address.",
      nextProfile.email && !isValidEmail(nextProfile.email) && "Please enter a valid email address."
    );
    if (wizardErrors.length) {
      summariseValidationErrors("Setup wizard", wizardErrors, toast);
      return;
    }

    setWizardSaving(true);
    try {
      clearPortalForFreshSetup();
      setProfile({
        ...nextProfile,
        setupComplete: true,
        setupCompletedAt: nextProfile.setupCompletedAt,
      });
      setWizardForm((prev) => ({ ...prev,
        businessName: nextProfile.businessName,
        legalBusinessName: nextProfile.legalBusinessName,
        email: nextProfile.email,
        firstName: nextProfile.firstName,
        lastName: nextProfile.lastName,
        preferredName: nextProfile.preferredName,
        phone: nextProfile.phone,
        address: nextProfile.address,
        abn: nextProfile.abn,
        workType: nextProfile.workType,
        gstRegistered: nextProfile.gstRegistered,
      }));
      setSetupComplete(true);
      setHasLoadedUserProfile(true);
      setActivePage("dashboard");

      if (supabase && authUser) {
        await saveProfileToSupabase(nextProfile);
      }
    } finally {
      setWizardSaving(false);
    }
  };

  useEffect(() => {
    if (!authUser?.email) return;
    setWizardForm((prev) => ({ ...prev,
      email: prev.email || authUser.email || "",
    }));
  }, [authUser]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setIsMobileViewport(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setShowQuickAddMenu(false);
  }, [activePage]);

  useEffect(() => {
    if (!supabase?.auth) {
      setHasLoadedUserProfile(true);
      setAuthReady(true);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("SUPABASE AUTH SESSION ERROR:", error);
        return;
      }
      setAuthUser(data?.session?.user || null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setAuthUser(null); setAuthReady(true); return; }
      if (event === "PASSWORD_RECOVERY") { setIsResettingPassword(true); setAuthReady(true); return; }
      if (isSigningOut.current) return;
      setAuthUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setProfile((prev) => {
      const nextFeeRate = LOCKED_FEE_RATE_PERCENT;
      const nextStripeServerUrl = DEFAULT_API_BASE_URL;
      if (
        safeNumber(prev?.feeRate) === nextFeeRate &&
        String(prev?.stripeServerUrl || "").trim() === nextStripeServerUrl
      ) {
        return prev;
      }
      return {
        ...prev,
        feeRate: nextFeeRate,
        stripeServerUrl: nextStripeServerUrl,
      };
    });
  }, []);

  useEffect(() => {
    if (!hasLoadedUserProfile || invoiceAlertsShownRef.current || expenses.length === 0) return;
    const today = parseLocalDate(todayLocal());
    const alerts = [];
    expenses.forEach((bill) => {
      if (bill.isPaid || bill.status === "Paid") return;
      const dueDate = bill.dueDate || bill.date;
      if (!dueDate) return;
      const due = parseLocalDate(dueDate);
      const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
      const supplier = bill.supplier || bill.description || `Bill ${bill.id}`;
      const amount = bill.amount ? ` ($${parseFloat(bill.amount).toFixed(2)})` : "";
      if (diff < 0) {
        alerts.push({ id: bill.id, type: "overdue", days: Math.abs(diff), label: `${supplier}${amount} is overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? "s" : ""}` });
      } else if (diff === 0) {
        alerts.push({ id: bill.id, type: "today", days: 0, label: `${supplier}${amount} is due today` });
      } else if (diff <= 2) {
        alerts.push({ id: bill.id, type: "soon", days: diff, label: `${supplier}${amount} is due in ${diff} day${diff !== 1 ? "s" : ""}` });
      }
    });
    if (alerts.length > 0) {
      alerts.sort((a, b) => a.type === "overdue" ? -1 : b.type === "overdue" ? 1 : a.days - b.days);
      setInvoiceAlerts(alerts);
      setShowInvoiceAlerts(true);
      invoiceAlertsShownRef.current = true;
    }
  }, [hasLoadedUserProfile, expenses]);

  useEffect(() => {
    if (!hasLoadedUserProfile || recurringShownRef.current || invoices.length === 0) return;
    const today = todayLocal();
    const calcNext = (fromDate, freq) => {
      const d = parseLocalDate(fromDate);
      if (freq === "Weekly") d.setDate(d.getDate() + 7);
      else if (freq === "Fortnightly") d.setDate(d.getDate() + 14);
      else if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
      else if (freq === "Quarterly") d.setMonth(d.getMonth() + 3);
      else if (freq === "Annually") d.setFullYear(d.getFullYear() + 1);
      else return null;
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    };
    const due = invoices
      .filter((inv) => inv.recurs && inv.recurs !== "Never" && inv.type !== "credit_note")
      .filter((inv) => {
        const check = inv.nextRecurDate || calcNext(inv.invoiceDate, inv.recurs);
        return check && check <= today;
      })
      .map((inv) => ({
        ...inv,
        clientName: (clients.find((c) => String(c.id) === String(inv.clientId)) || {}).name || "Unknown client",
        dueRecurDate: inv.nextRecurDate || calcNext(inv.invoiceDate, inv.recurs),
      }));
    if (due.length > 0) {
      setRecurringDue(due);
      setRecurringSelected(due.map((inv) => inv.id));
      setShowRecurringModal(true);
      recurringShownRef.current = true;
    }
  }, [hasLoadedUserProfile, invoices, clients]);

  useEffect(() => {
    const fromBills = expenses.map((e) => e.supplier).filter(Boolean);
    const fromDirectory = suppliers.map((s) => s.name).filter(Boolean);
    const combined = [...new Set([...fromDirectory, ...fromBills])].sort();
    setKnownSuppliers(combined);
  }, [expenses, suppliers]);

  // Note: incomeSources, services, and documents are persisted in Supabase only.
  // localStorage writes were removed to avoid a stale shadow copy with no reader.

  useEffect(() => {
    window.simulateInvoicePayment = simulateInvoicePayment;
    return () => {
      delete window.simulateInvoicePayment;
    };
  }, [invoices]);

  useEffect(() => {
    window.sendInvoiceFromPreview = sendInvoiceFromPreview;
    window.sendQuoteFromPreview = sendQuoteFromPreview;
    return () => {
      delete window.sendInvoiceFromPreview;
      delete window.sendQuoteFromPreview;
    };
  }, [invoices, quotes, profile, clients]);

  useEffect(() => {
    if (authUser) {
      restorePortalStateFromSupabase();
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !hasLoadedUserProfile) return;
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get("stripe");
    const invoiceId = params.get("invoiceId");

    if (stripeStatus === "success") {
      if (invoiceId) {
        setActivePage("invoices");
        const invoice = invoices.find((inv) => String(inv.id) === String(invoiceId));
        if (invoice && invoice.status !== "Paid") {
          const updatedInvoice = { ...invoice, status: "Paid", paidAt: new Date().toISOString(), paidVia: "Stripe" };
          (async () => {
            try {
              const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
              setInvoices((prev) => prev.map((inv) => String(inv.id) === String(invoiceId) ? savedInvoice : inv));
              // Clear the query string so a refresh doesn't re-trigger this
              window.history.replaceState({}, "", window.location.pathname);
            } catch (e) {
              console.error("Failed to mark invoice paid on stripe success:", e);
            }
          })();
        }
      }
    }
  }, [authUser, hasLoadedUserProfile, invoices]);

  useEffect(() => {
    if (!authUser) return;
    if (profile?.setupComplete) {
      setSetupComplete(true);
    }
  }, [authUser, profile?.setupComplete]);


  const uploadReceiptToSupabase = async (file) => {
    if (!supabase) {
      throw new Error("Supabase client not provided");
    }

    validateSelectedFile(file, {
      allowedTypes: ALLOWED_RECEIPT_TYPES,
      maxBytes: MAX_RECEIPT_FILE_BYTES,
      label: "Receipt",
    });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const today = todayLocal();
    const businessSlug = String(profile?.businessName || "portal").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
    const folderPath = `${businessSlug}/expenses/${today}`;
    const filePath = `${folderPath}/receipt-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false });
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return {
      fileName: file.name,
      filePath,
      receiptUrl: publicUrlData.publicUrl,
    };
  };

  const uploadDocumentToSupabase = async (file) => {
    if (!supabase) {
      throw new Error("Supabase client not provided");
    }

    validateSelectedFile(file, {
      allowedTypes: ALLOWED_DOCUMENT_TYPES,
      maxBytes: MAX_DOCUMENT_FILE_BYTES,
      label: "Document",
    });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const today = todayLocal();
    const businessSlug = String(profile?.businessName || "portal").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
    const folderPath = `${businessSlug}/documents/${today}`;
    const filePath = `${folderPath}/document-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false });
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return {
      fileName: file.name,
      filePath,
      url: publicUrlData.publicUrl,
    };
  };

  const sanitiseForSupabase = (value) =>
    JSON.parse(
      JSON.stringify(value, (_, nestedValue) =>
        nestedValue === undefined ? null : nestedValue
      )
    );

  const coerceRowId = (value, fallbackIndex = 0) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    // Multiply by 1000 and add a random 0-999 offset so records created
    // within the same millisecond (e.g. bulk import) don't collide.
    return Date.now() * 1000 + Math.floor(Math.random() * 1000) + fallbackIndex;
  };

  const buildSupabaseRow = (item, fallbackIndex = 0) => {
    if (!authUser?.id) {
      throw new Error("Please sign in first.");
    }

    const id = coerceRowId(item?.id, fallbackIndex);
    return {
      id,
      user_id: authUser.id,
      data: sanitiseForSupabase({ ...(item || {}),
        id,
      }),
      updated_at: new Date().toISOString(),
    };
  };

  const fetchCollectionFromDatabase = async (tableName) => {
    if (!authUser?.id) throw new Error("Please sign in first.");

    const { data, error } = await supabase
      .from(tableName)
      .select("id, data, updated_at, user_id")
      .eq("user_id", authUser.id)
      .order("id", { ascending: true });
    if (error) throw error;

    return (data || []).map((row) => ({ ...(row.data || {}),
      id: row.id,
      user_id: row.user_id,
    }));
  };

  const upsertRecordInDatabase = async (tableName, record) => {
    if (!authUser?.id) throw new Error("Please sign in first.");
    const row = buildSupabaseRow(record);
    const { error } = await supabase
      .from(tableName)
      .upsert(row, { onConflict: "id" });
    if (error) throw error;

    return { ...(row.data || {}),
      id: row.id,
      user_id: row.user_id,
    };
  };

  const deleteRecordFromDatabase = async (tableName, id) => {
    if (!authUser?.id) throw new Error("Please sign in first.");
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", safeNumber(id))
      .eq("user_id", authUser.id);
    if (error) throw error;
  };


  const validateClientPayload = (payload) =>
    collectValidationErrors(
      !String(payload?.name || "").trim() && "Client name is required.",
      payload?.email && !isValidEmail(payload.email) && "Client email is invalid."
    );

  const validateInvoicePayload = (payload) =>
    collectValidationErrors(
      !payload?.clientId && "Invoice client is required.",
      !String(payload?.description || "").trim() && "Invoice description is required.",
      safeNumber(payload?.quantity) <= 0 && "Invoice quantity must be greater than zero.",
      safeNumber(payload?.subtotal) < 0 && "Invoice amount cannot be negative.",
      payload?.invoiceDate && payload?.dueDate && parseLocalDate(payload.dueDate) < parseLocalDate(payload.invoiceDate) && "Invoice due date cannot be before invoice date."
    );

  const validateQuotePayload = (payload) =>
    collectValidationErrors(
      !payload?.clientId && "Quote client is required.",
      !String(payload?.description || "").trim() && "Quote description is required.",
      safeNumber(payload?.quantity) <= 0 && "Quote quantity must be greater than zero.",
      safeNumber(payload?.subtotal) < 0 && "Quote amount cannot be negative.",
      payload?.quoteDate && payload?.expiryDate && parseLocalDate(payload.expiryDate) < parseLocalDate(payload.quoteDate) && "Quote expiry date cannot be before quote date."
    );

  const validateExpensePayload = (payload) =>
    collectValidationErrors(
      !String(payload?.supplier || "").trim() && "Expense supplier is required.",
      !String(payload?.category || "").trim() && "Expense category is required.",
      safeNumber(payload?.amount) <= 0 && "Expense amount must be greater than zero."
    );

  const validateIncomeSourcePayload = (payload) =>
    collectValidationErrors(
      !String(payload?.name || "").trim() && "Income source name is required.",
      !String(payload?.incomeType || "").trim() && "Income source type is required.",
      safeNumber(payload?.beforeTax) <= 0 && "Income source amount must be greater than zero.",
      !String(payload?.frequency || "").trim() && "Income frequency is required."
    );

  const handleAuthSubmit = async () => {
    if (!supabase?.auth) {
      toast.error("Supabase Auth is not configured in client.js");
      return;
    }

    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");

    const errors = collectValidationErrors(
      !isValidEmail(email) && "Enter a valid email address.",
      password.length < 6 && "Password must be at least 6 characters.",
      authMode === "signup" && password !== confirmPassword && "Passwords do not match."
    );
    if (errors.length) {
      summariseValidationErrors("Authentication", errors, toast);
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is off, user is signed in immediately
        if (signUpData?.session) {
          toast.success("Account created! Welcome to the portal.");
        } else {
          // Email confirmation is on — ask them to confirm
          toast.success("Account created! Check your email to confirm, then sign in.");
          setAuthMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      console.error("SUPABASE AUTH ERROR:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase?.auth) {
      toast.error("Supabase Auth is not configured in client.js");
      return;
    }

    const email = String(authForm.email || "").trim();
    if (!isValidEmail(email)) {
      toast.warning("Enter your email first, then click Reset password.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setShowResetSentModal(true);
    } catch (error) {
      console.error("SUPABASE PASSWORD RESET ERROR:", error);
      toast.error(error.message || "Password reset failed");
    }
  };

  const handleSignOut = async () => {
    if (!supabase?.auth) return;
    try {
      isSigningOut.current = true;
      await supabase.auth.signOut();
      if (typeof window !== "undefined" && window.localStorage) { Object.keys(window.localStorage).forEach((key) => { if (key.startsWith("sb-")) window.localStorage.removeItem(key); }); }
      hasHydratedSupabaseState.current = false;
      setIsSupabaseRestoring(false);
      setAuthUser(null);
      setProfile(initialProfile);
      setClients([]);
      setInvoices([]);
      setQuotes([]);
      setExpenses([]);
      setIncomeSources([]);
      setServices([]);
      setDocuments([]);
      setSetupComplete(false);
      setHasLoadedUserProfile(false);
      setWizardForm({
        firstName: "",
        lastName: "",
        preferredName: "",
        businessName: "",
        legalBusinessName: "",
        email: "",
        phone: "",
        address: "",
        abn: "",
        workType: "Financial / Management Accountant",
        gstRegistered: true,
      });
      setActivePage("settings");
      setActiveSettingsTab("Profile");
    } catch (error) {
      console.error("SUPABASE SIGN OUT ERROR:", error);
    } finally {
      isSigningOut.current = false;
    }
  };

  const handleCloseAccount = async () => {
    if (!supabase || !authUser?.id) return;
    try {
      const closedProfile = { ...profile, accountStatus: "closed" };
      await saveProfileToSupabase(closedProfile);
      await handleSignOut();
    } catch (error) {
      console.error("CLOSE ACCOUNT ERROR:", error);
      toast.error("Could not close account. Please try again.");
    }
  };

  const saveARCreditNote = async () => {
    if (!creditNoteSource) return;
    const amt = safeNumber(creditNoteForm.amount);
    if (amt <= 0) { toast.warning("Enter a credit note amount"); return; }
    try {
      const cn = {
        clientId: creditNoteSource.clientId,
        invoiceDate: creditNoteForm.date,
        dueDate: creditNoteForm.date,
        invoiceNumber: `CN-${creditNoteSource.invoiceNumber || creditNoteSource.id}`,
        total: -Math.abs(amt),
        subtotal: -Math.abs(amt),
        status: "Credit Note",
        type: "credit_note",
        linkedInvoiceId: creditNoteSource.id,
        comments: creditNoteForm.reason || "Credit note",
        lineItems: [{ id: Date.now(), description: creditNoteForm.reason || "Credit note", quantity: 1, unitPrice: -Math.abs(amt), gstType: "GST Free" }],
        currencyCode: creditNoteSource.currencyCode || "AUD",
      };
      const saved = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, cn);
      setInvoices((prev) => [...prev, saved]);
      toast.success("AR credit note saved!");
      setShowARCreditNoteModal(false);
      setCreditNoteForm({ amount: "", reason: "", date: todayLocal() });
    } catch (err) { toast.error(err.message || "Failed to save credit note"); }
  };

  const saveAPCreditNote = async () => {
    if (!creditNoteSource) return;
    const amt = safeNumber(creditNoteForm.amount);
    if (amt <= 0) { toast.warning("Enter a credit note amount"); return; }
    try {
      const cn = {
        ...creditNoteSource,
        date: creditNoteForm.date,
        amount: -Math.abs(amt),
        gst: -(Math.abs(amt) / 11),
        description: creditNoteForm.reason || "Credit note",
        type: "credit_note",
        linkedBillId: creditNoteSource.id,
        isPaid: false,
        status: "Credit Note",
        expenseType: "Credit Note",
      };
      const saved = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, cn);
      setExpenses((prev) => [...prev, saved]);
      toast.success("AP credit note saved!");
      setShowAPCreditNoteModal(false);
      setCreditNoteForm({ amount: "", reason: "", date: todayLocal() });
    } catch (err) { toast.error(err.message || "Failed to save credit note"); }
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) { toast.warning("Supplier name is required"); return; }
    try {
      const payload = { ...supplierForm, id: editingSupplierId || Date.now() };
      const saved = await upsertRecordInDatabase(SUPABASE_TABLES.suppliers, payload);
      setSuppliers((prev) => editingSupplierId
        ? prev.map((s) => s.id === editingSupplierId ? saved : s)
        : [...prev, saved]);
      toast.success(editingSupplierId ? "Supplier updated!" : "Supplier saved!");
      setShowSupplierModal(false);
      setSupplierForm({ name: "", email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" });
      setEditingSupplierId(null);
    } catch (err) { toast.error(err.message || "Failed to save supplier"); }
  };

  const deleteSupplier = (id) => {
    confirm({
      title: "Delete supplier?",
      message: "This supplier will be removed from your directory. Existing bills will not be affected.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteRecordFromDatabase(SUPABASE_TABLES.suppliers, id);
          setSuppliers((prev) => prev.filter((s) => s.id !== id));
          toast.success("Supplier deleted");
        } catch (err) { toast.error(err.message || "Failed to delete supplier"); }
      },
    });
  };

  const saveClientFromModal = async () => {
    if (!clientModalForm.name.trim()) { toast.warning("Client name is required"); return; }
    try {
      const payload = { ...clientModalForm, id: editingClientId || Date.now() };
      const saved = await upsertRecordInDatabase(SUPABASE_TABLES.clients, payload);
      setClients((prev) => editingClientId
        ? prev.map((c) => c.id === editingClientId ? saved : c)
        : [...prev, saved]);
      toast.success(editingClientId ? "Client updated!" : "Client saved!");
      setShowClientModal(false);
      setClientModalForm({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" });
      setEditingClientId(null);
    } catch (err) { toast.error(err.message || "Failed to save client"); }
  };

  const downloadTemplate = (type) => {
    const clientHeaders = "Name,Business Name,Email,Phone,Address,ABN,Currency,Work Type";
    const clientExample = "John Smith,Smith Farms Pty Ltd,john@smithfarms.com.au,0412 345 678,123 Farm Rd Dubbo NSW 2830,12 345 678 901,AUD $,Primary production";
    const supplierHeaders = "Name,Contact Person,Email,Phone,Address,ABN,Notes";
    const supplierExample = "AGL Energy,Jane Brown,accounts@agl.com.au,1800 123 456,72 Yeo St Neutral Bay NSW 2089,74 115 061 375,Monthly billing";
    const csv = type === "clients"
      ? `${clientHeaders}\n${clientExample}\n`
      : `${supplierHeaders}\n${supplierExample}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "clients" ? "clients_template.csv" : "suppliers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseImportCSV = (text, type) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { rows: [], error: "File must have a header row and at least one data row." };
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      if (type === "clients") {
        rows.push({ name: row["name"] || row["clientname"] || "", businessName: row["businessname"] || "", email: row["email"] || "", phone: row["phone"] || "", address: row["address"] || "", abn: row["abn"] || "", defaultCurrency: row["currency"] || "AUD $", workType: row["worktype"] || "" });
      } else {
        rows.push({ name: row["name"] || row["suppliername"] || "", contactPerson: row["contactperson"] || "", email: row["email"] || "", phone: row["phone"] || "", address: row["address"] || "", abn: row["abn"] || "", notes: row["notes"] || "" });
      }
    }
    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) return { rows: [], error: "No valid rows found. Make sure the Name column is filled in." };
    return { rows: valid, error: "" };
  };

  const confirmImport = async () => {
    if (!importRows.length) return;
    try {
      const table = importType === "clients" ? SUPABASE_TABLES.clients : SUPABASE_TABLES.suppliers;
      const existing = importType === "clients" ? clients : suppliers;
      const existingNames = new Set(existing.map((r) => r.name.toLowerCase().trim()));
      const newRows = importRows.filter((r) => !existingNames.has(r.name.toLowerCase().trim()));
      const saved = await Promise.all(newRows.map((r) => upsertRecordInDatabase(table, { ...r })));
      if (importType === "clients") setClients((prev) => [...prev, ...saved]);
      else setSuppliers((prev) => [...prev, ...saved]);
      toast.success(`Imported ${saved.length} ${importType}${newRows.length < importRows.length ? ` (${importRows.length - newRows.length} duplicates skipped)` : ""}!`);
      setShowImportModal(false);
      setImportRows([]);
      setImportError("");
    } catch (err) { toast.error(err.message || "Import failed"); }
  };

  const confirmRecurring = async () => {
    const calcNext = (fromDate, freq) => {
      const d = parseLocalDate(fromDate);
      if (freq === "Weekly") d.setDate(d.getDate() + 7);
      else if (freq === "Fortnightly") d.setDate(d.getDate() + 14);
      else if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
      else if (freq === "Quarterly") d.setMonth(d.getMonth() + 3);
      else if (freq === "Annually") d.setFullYear(d.getFullYear() + 1);
      else return null;
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    };
    const toCreate = recurringDue.filter((inv) => recurringSelected.includes(inv.id));
    try {
      for (const inv of toCreate) {
        const newDate = inv.dueRecurDate;
        const newDue = addDays(newDate, safeNumber(profile.paymentTermsDays) || 14);
        const nextRecur = calcNext(newDate, inv.recurs);
        const newInvoice = { ...inv, invoiceDate: newDate, dueDate: newDue,
          invoiceNumber: "", status: "Draft", paidAt: null, paidVia: null, nextRecurDate: nextRecur };
        delete newInvoice.clientName; delete newInvoice.dueRecurDate;
        const saved = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, newInvoice);
        setInvoices((prev) => [...prev, saved]);
        const updatedSource = { ...inv, nextRecurDate: nextRecur };
        delete updatedSource.clientName; delete updatedSource.dueRecurDate;
        await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedSource);
        setInvoices((prev) => prev.map((i) => String(i.id) === String(inv.id) ? { ...i, nextRecurDate: nextRecur } : i));
      }
      toast.success(toCreate.length + " recurring invoice" + (toCreate.length !== 1 ? "s" : "") + " created as Draft!");
    } catch (err) { toast.error(err.message || "Failed to create recurring invoices"); }
    setShowRecurringModal(false);
    setRecurringDue([]);
    setRecurringSelected([]);
  };

  const getStableProfileRowId = () => {
    const clean = String(authUser?.id || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 12);
    if (clean) {
      const parsed = Number.parseInt(clean, 16);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 1;
  };

  const saveProfileToSupabase = async (profilePayload) => {
    if (!supabase || !authUser?.id) return;
    try {
      setSupabaseSyncStatus("Saving profile to Supabase database...");
      const savedProfile = await upsertRecordInDatabase(SUPABASE_TABLES.profile, {
        ...profilePayload,
        id: profilePayload?.id || getStableProfileRowId(),
      });

      setProfile((prev) => ({
        ...prev,
        ...savedProfile,
        setupComplete: Boolean(savedProfile?.setupComplete ?? prev?.setupComplete),
        setupCompletedAt: savedProfile?.setupCompletedAt || prev?.setupCompletedAt || "",
      }));
      setSetupComplete(Boolean(savedProfile?.setupComplete));
      lastSavedProfileRef.current = JSON.stringify(profilePayload);
      setSupabaseSyncStatus("Profile saved to Supabase database");
    } catch (error) {
      console.error("SUPABASE PROFILE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Supabase profile save failed");
    }
  };

  const saveAllCurrentStateToSupabase = async () => {
    if (!supabase) {
      setSupabaseSyncStatus("Supabase not connected");
      return;
    }

    setSupabaseSyncStatus("Saving all portal records to Supabase database...");

    try {
      await saveProfileToSupabase(profile);

      // Save each collection independently so one table's failure doesn't
      // mask errors in others. Collect all failures and report them together.
      const collections = [
        { name: "clients",       items: clients,       table: SUPABASE_TABLES.clients },
        { name: "invoices",      items: invoices,      table: SUPABASE_TABLES.invoices },
        { name: "quotes",        items: quotes,        table: SUPABASE_TABLES.quotes },
        { name: "expenses",      items: expenses,      table: SUPABASE_TABLES.expenses },
        { name: "income sources",items: incomeSources, table: SUPABASE_TABLES.incomeSources },
        { name: "services",      items: services,      table: SUPABASE_TABLES.services },
        { name: "documents",     items: documents,     table: SUPABASE_TABLES.documents },
        { name: "suppliers",     items: suppliers,     table: SUPABASE_TABLES.suppliers },
      ];

      const saveResults = await Promise.all(
        collections.map(({ name, items, table }) =>
          Promise.all(items.map((item) => upsertRecordInDatabase(table, item)))
            .then(() => ({ name, ok: true }))
            .catch((err) => ({ name, ok: false, message: err?.message || "Unknown error" }))
        )
      );

      const failures = saveResults.filter((r) => !r.ok);
      if (failures.length) {
        const summary = failures.map((f) => `${f.name}: ${f.message}`).join("; ");
        console.error("SUPABASE BULK SAVE — partial failure:", summary);
        setSupabaseSyncStatus(`Saved with errors — ${summary}`);
      } else {
        setSupabaseSyncStatus("All portal records saved to Supabase database");
      }
    } catch (error) {
      console.error("SUPABASE BULK SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Supabase bulk save failed");
    }
  };

  const restorePortalStateFromSupabase = async () => {
    if (!supabase || isSupabaseRestoring || !authUser) return;
    setHasLoadedUserProfile(false);
    setIsSupabaseRestoring(true);
    setSupabaseSyncStatus("Loading from Supabase database...");

    try {
      // Each table is fetched independently so a missing/broken table never
      // blocks the others from loading.
      const safeF = (table) => fetchCollectionFromDatabase(table).catch((err) => {
        console.warn(`[restore] Could not load table "${table}":`, err?.message);
        return [];
      });
      const [
        remoteProfileRows,
        remoteClients,
        remoteInvoices,
        remoteQuotes,
        remoteExpenses,
        remoteIncomeSources,
        remoteServices,
        remoteDocuments,
        remoteSuppliers,
      ] = await Promise.all([
        safeF(SUPABASE_TABLES.profile),
        safeF(SUPABASE_TABLES.clients),
        safeF(SUPABASE_TABLES.invoices),
        safeF(SUPABASE_TABLES.quotes),
        safeF(SUPABASE_TABLES.expenses),
        safeF(SUPABASE_TABLES.incomeSources),
        safeF(SUPABASE_TABLES.services),
        safeF(SUPABASE_TABLES.documents),
        safeF(SUPABASE_TABLES.suppliers),
      ]);
      hasHydratedSupabaseState.current = true;

      const remoteProfile =
        Array.isArray(remoteProfileRows) && remoteProfileRows.length
          ? [...remoteProfileRows].reverse().find((row) => Boolean(row?.setupComplete)) ||
            remoteProfileRows[remoteProfileRows.length - 1]
          : null;
      const nextProfile = remoteProfile?.data
        ? { ...initialProfile, ...remoteProfile.data, id: remoteProfile.id }
        : remoteProfile
          ? { ...initialProfile, ...remoteProfile }
          : initialProfile;
      // Migrate old default of 21 days to 14 days
      if (safeNumber(nextProfile.paymentTermsDays) === 21) {
        nextProfile.paymentTermsDays = 14;
      }
      const nextSetupComplete = Boolean(nextProfile.setupComplete);

      setProfile(nextProfile);
      lastSavedProfileRef.current = JSON.stringify(nextProfile);
      setClients(Array.isArray(remoteClients) ? remoteClients : []);
      setInvoices(Array.isArray(remoteInvoices) ? remoteInvoices : []);
      setQuotes(Array.isArray(remoteQuotes) ? remoteQuotes : []);
      setExpenses(Array.isArray(remoteExpenses) ? remoteExpenses : []);
      setIncomeSources(Array.isArray(remoteIncomeSources) ? remoteIncomeSources : []);
      setServices(Array.isArray(remoteServices) ? remoteServices : []);
      setDocuments(Array.isArray(remoteDocuments) ? remoteDocuments : []);
      setSuppliers(Array.isArray(remoteSuppliers) ? remoteSuppliers : []);
      setSetupComplete(nextSetupComplete);
      setWizardForm((prev) => ({ ...prev,
        firstName: nextProfile.firstName || "",
        lastName: nextProfile.lastName || "",
        preferredName: nextProfile.preferredName || "",
        businessName: nextProfile.businessName || "",
        legalBusinessName: nextProfile.legalBusinessName || "",
        email: nextProfile.email || authUser?.email || "",
        phone: nextProfile.phone || "",
        address: nextProfile.address || "",
        abn: nextProfile.abn || "",
        workType: nextProfile.workType || "Financial / Management Accountant",
        gstRegistered: nextProfile.gstRegistered ?? true,
      }));

      if (nextSetupComplete) {
        setActivePage("dashboard");
      } else {
        setActivePage("settings");
        setActiveSettingsTab("Profile");
      }

      setSupabaseSyncStatus(
        nextSetupComplete ? "Loaded from Supabase database" : "Setup required for this user"
      );
    } catch (error) {
      console.error("SUPABASE DATABASE RESTORE ERROR:", error);
      hasHydratedSupabaseState.current = true;
      setSupabaseSyncStatus(error.message || "Supabase database load failed");
    } finally {
      setHasLoadedUserProfile(true);
      setIsSupabaseRestoring(false);
    }
  };

  const uploadDocument = async () => {
    try {
      if (!documentFile) {
        toast.warning("Please select a file first");
        return;
      }

      const uploaded = await uploadDocumentToSupabase(documentFile);
      const newDocument = {
        name: uploaded.fileName,
        filePath: uploaded.filePath,
        url: uploaded.url,
        uploadedAt: new Date().toISOString(),
      };
      const savedDocument = await upsertRecordInDatabase(SUPABASE_TABLES.documents, newDocument);

      setDocuments((prev) => [...prev, savedDocument]);

      setSupabaseSyncStatus("Document saved to Supabase database");
      setDocumentFile(null);
      toast.success("Document uploaded successfully!");
    } catch (err) {
      console.error("DOCUMENT UPLOAD ERROR:", err);
      setSupabaseSyncStatus(err.message || "Document save failed");
      toast.error(err.message || "Something went wrong");
    }
  };

  const deleteDocument = (id) => {
    confirm({ title: "Delete document", message: "This document will be permanently removed.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.documents, id);
      setDocuments((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Document deleted from Supabase database");
    } catch (error) {
      console.error("DOCUMENT DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Document delete failed");
      toast.error(error.message || "Document delete failed");
    }
      },
    });
  };

  const calculateServiceValues = (priceValue, gstTypeValue) => {
    const price = safeNumber(priceValue);
    const gst = gstTypeValue === "GST on Income (10%)" ? price * 0.1 : 0;
    return {
      gst: gst.toFixed(2),
      total: (price + gst).toFixed(2),
    };
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceForm({
      name: "",
      gstType: "GST on Income (10%)",
      price: "",
      gst: "0.00",
      total: "0.00",
    });
  };

  const openNewServiceModal = () => {
    resetServiceForm();
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name || "",
      gstType: service.gstType || "",
      price: String(service.price ?? ""),
      gst: Number(service.gst || 0).toFixed(2),
      total: Number(service.total || 0).toFixed(2),
    });
    setShowServiceModal(true);
  };

  const handleServiceFormChange = (field, value) => {
    if (field === "name") {
      setServiceForm((prev) => ({ ...prev, name: value }));
      return;
    }

    if (field === "price") {
      const cleaned = value.replace(/[^0-9.]/g, "");
      const computed = calculateServiceValues(cleaned, serviceForm.gstType);
      setServiceForm((prev) => ({ ...prev,
        price: cleaned,
        gst: computed.gst,
        total: computed.total,
      }));
      return;
    }

    if (field === "gstType") {
      const computed = calculateServiceValues(serviceForm.price, value);
      setServiceForm((prev) => ({ ...prev,
        gstType: value,
        gst: computed.gst,
        total: computed.total,
      }));
      return;
    }
  };

  const saveService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.gstType) return;
    const payload = {
      ...(editingServiceId ? { id: editingServiceId } : {}),
      name: serviceForm.name.trim(),
      gstType: serviceForm.gstType,
      price: safeNumber(serviceForm.price),
      gst: safeNumber(serviceForm.gst),
      total: safeNumber(serviceForm.total),
    };
    try {
      const savedService = await upsertRecordInDatabase(SUPABASE_TABLES.services, payload);
      if (editingServiceId) {
        setServices((prev) => prev.map((item) => (item.id === editingServiceId ? savedService : item)));
      } else {
        setServices((prev) => [...prev, savedService]);
      }

      setSupabaseSyncStatus("Service saved to Supabase database");
      setShowServiceModal(false);
      resetServiceForm();
    } catch (error) {
      console.error("SERVICE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Service save failed");
      toast.error(error.message || "Service save failed");
    }
  };

  const deleteService = (serviceId) => {
    confirm({ title: "Delete service", message: "This service will be removed from your catalogue.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.services, serviceId);
      setServices((prev) => prev.filter((item) => item.id !== serviceId));
      setSupabaseSyncStatus("Service deleted from Supabase database");
    } catch (error) {
      console.error("SERVICE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Service delete failed");
      toast.error(error.message || "Service delete failed");
    }
      },
    });
  };

  const resetIncomeSourceForm = () => {
    setIncomeSourceForm({
      name: "",
      incomeType: "Casual employment",
      beforeTax: "",
      frequency: "",
      startedAfterDate: false,
      hasEndDate: false,
    });
  };

  const saveIncomeSource = async () => {
    const incomeErrors = validateIncomeSourcePayload({ ...incomeSourceForm, beforeTax: safeNumber(incomeSourceForm.beforeTax) });
    if (incomeErrors.length) {
      summariseValidationErrors("Income source", incomeErrors, toast);
      return;
    }

    const payload = {
      name: incomeSourceForm.name.trim(),
      incomeType: incomeSourceForm.incomeType,
      beforeTax: safeNumber(incomeSourceForm.beforeTax),
      frequency: incomeSourceForm.frequency,
      startedAfterDate: incomeSourceForm.startedAfterDate,
      hasEndDate: incomeSourceForm.hasEndDate,
    };
    try {
      const savedIncomeSource = await upsertRecordInDatabase(SUPABASE_TABLES.incomeSources, payload);
      setIncomeSources((prev) => [...prev, savedIncomeSource]);
      setSupabaseSyncStatus("Income source saved to Supabase database");
      setShowIncomeSourceModal(false);
      resetIncomeSourceForm();
    } catch (error) {
      console.error("INCOME SOURCE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source save failed");
      toast.error(error.message || "Income source save failed");
    }
  };

  const getClientName = (clientId) =>
    clients.find((c) => c.id === safeNumber(clientId))?.name || "Unknown client";

  const getClientById = (clientId) =>
    clients.find((c) => c.id === safeNumber(clientId));

  const formatClientCurrency = (value, clientId) =>
    formatCurrencyByCode(value, getClientCurrencyCode(getClientById(clientId)));

  const clientIsGstExempt = (clientId) => {
    const client = getClientById(clientId);
    return Boolean(client?.outsideAustraliaOrGstExempt);
  };

  const gstAppliesToClient = (clientId) =>
    Boolean(profile.gstRegistered) && !clientIsGstExempt(clientId);

  const calculateFormGst = ({ unitPrice, quantity, gstType, clientId, manualGst, gstOverride }) => {
    if (clientIsGstExempt(clientId)) {
      return 0;
    }

    if (manualGst && gstOverride !== "") {
      return safeNumber(gstOverride);
    }

    const subtotalExGst = safeNumber(unitPrice) * Math.max(1, safeNumber(quantity || 1));
    const serviceHasGst = gstType === "GST on Income (10%)";

    if (!gstAppliesToClient(clientId) || !serviceHasGst) {
      return 0;
    }

    return subtotalExGst * 0.1;
  };

  const computeLineItemTotals = (lineItems, clientId) => {
    const exempt = clientIsGstExempt(clientId);
    return (lineItems || []).map((item) => {
      const qty = Math.max(1, safeNumber(item.quantity || 1));
      const unit = safeNumber(item.unitPrice);
      const rowSubtotal = unit * qty;
      const effectiveGstType = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
      const rowGst = effectiveGstType === "GST on Income (10%)" ? rowSubtotal * 0.1 : 0;
      return { ...item, qty, unit, rowSubtotal, rowGst, rowTotal: rowSubtotal + rowGst };
    });
  };

  const getDocumentBusinessName = () =>
    profile.hideLegalNameOnDocs || !profile.legalBusinessName
      ? profile.businessName
      : profile.legalBusinessName;

  const getDocumentAddress = () => (profile.hideAddressOnDocs ? "" : profile.address || "");

  const buildLineItemSummary = ({ clientId, subtotal, total, gst, purchaseOrderReference = "" }) => {
    const client = getClientById(clientId);
    const adjustments = calculateAdjustmentValues({
      subtotal,
      total,
      client,
      profile,
    });
    return {
      client,
      currencyCode: getClientCurrencyCode(client),
      gstStatus: clientIsGstExempt(clientId) ? "GST not applicable" : gst > 0 ? "GST applies" : "GST free",
      feeAmount: adjustments.feeAmount,
      taxWithheld: adjustments.taxWithheld,
      netExpected: adjustments.netExpected,
      purchaseOrderReference,
    };
  };

  const sendSavedDocumentEmail = async ({ documentType, documentRecord }) => {
  let emailDocumentRecord = { ...(documentRecord || {}) };
  let stripeCheckoutUrl = emailDocumentRecord?.stripeCheckoutUrl || "";

  const client = getClientById(emailDocumentRecord?.clientId);

  const recipientList = Array.from(
    new Set(
      [
        client?.sendToClient && isValidEmail(client?.email)
          ? String(client.email).trim()
          : "",
        client?.sendToMe && isValidEmail(profile?.email)
          ? String(profile.email).trim()
          : "",
      ].filter(Boolean)
    )
  );

  if (!recipientList.length) {
    return {
      ok: false,
      skipped: true,
      message: `No email recipients configured for this ${documentType}.`,
    };
  }

  const serverBaseUrl = getApiBaseUrl(profile?.stripeServerUrl);

  if (
    documentType === "invoice" &&
    !stripeCheckoutUrl &&
    typeof resolveInvoiceStripeAmount === "function" &&
    resolveInvoiceStripeAmount(emailDocumentRecord) > 0
  ) {
    try {
      stripeCheckoutUrl = await createStripeCheckoutForInvoice(emailDocumentRecord);

      if (stripeCheckoutUrl) {
        emailDocumentRecord = {
          ...emailDocumentRecord,
          stripeCheckoutUrl,
        };
      }
    } catch (e) {
      console.error("EMAIL STRIPE LINK ERROR:", e);
    }
  }

  const resolvedTotal = safeNumber(
    emailDocumentRecord?.total ??
    emailDocumentRecord?.grandTotal ??
    emailDocumentRecord?.invoiceTotal ??
    emailDocumentRecord?.amount ??
    emailDocumentRecord?.totalAmount
  );

  let invoiceHtml = "";
  let quoteHtml = "";

  if (documentType === "invoice") {
    invoiceHtml = buildInvoiceHtml(
      emailDocumentRecord,
      stripeCheckoutUrl || emailDocumentRecord?.stripeCheckoutUrl || "",
      { allowEmail: false },
      { profile, clients }
    );
  }

  if (documentType === "quote") {
    try {
      quoteHtml = buildQuoteHtml(
        emailDocumentRecord,
        { allowEmail: false },
        { profile, clients }
      );
    } catch (error) {
      console.error("buildQuoteHtml crashed:", error);
      quoteHtml = "";
    }

    if (!String(quoteHtml || "").trim()) {
      console.warn("Using fallback quote HTML for PDF generation", {
        quoteId: emailDocumentRecord?.id,
        quoteNumber: emailDocumentRecord?.quoteNumber,
        clientId: emailDocumentRecord?.clientId,
      });

      quoteHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quote ${emailDocumentRecord?.quoteNumber || ""}</title>
<style>
body { font-family: Arial, sans-serif; padding: 40px; color: #14202B; }
.card { border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; }
.title { font-size: 32px; font-weight: 900; color: #6A1B9A; margin-bottom: 18px; }
.row { margin: 8px 0; }
.label { font-weight: 700; }
.total { margin-top: 20px; font-size: 20px; font-weight: 800; color: #006D6D; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">QUOTE</div>
    <div class="row"><span class="label">Business:</span> ${profile?.businessName || "Your Business"}</div>
    <div class="row"><span class="label">Quote Number:</span> ${emailDocumentRecord?.quoteNumber || ""}</div>
    <div class="row"><span class="label">Quote Date:</span> ${formatDateAU(emailDocumentRecord?.quoteDate)}</div>
    <div class="row"><span class="label">Expiry Date:</span> ${formatDateAU(emailDocumentRecord?.expiryDate)}</div>
    <div class="row"><span class="label">Client:</span> ${getClientName(emailDocumentRecord?.clientId)}</div>
    <div class="row"><span class="label">Description:</span> ${emailDocumentRecord?.description || "Professional services"}</div>
    <div class="row"><span class="label">Quantity:</span> ${safeNumber(emailDocumentRecord?.quantity || 1)}</div>
    <div class="row"><span class="label">Subtotal:</span> ${formatCurrencyByCode(safeNumber(emailDocumentRecord?.subtotal), emailDocumentRecord?.currencyCode || "AUD")}</div>
    <div class="row"><span class="label">GST:</span> ${formatCurrencyByCode(safeNumber(emailDocumentRecord?.gst), emailDocumentRecord?.currencyCode || "AUD")}</div>
    <div class="total">Total Estimate: ${formatCurrencyByCode(resolvedTotal, emailDocumentRecord?.currencyCode || "AUD")}</div>
  </div>
</body>
</html>`;
    }
  }

  const emailBodyHtml =
    documentType === "invoice"
      ? invoiceHtml
      : buildQuoteEmailHtml(emailDocumentRecord, { profile, clients });

  const payload = {
    to: recipientList,
    subject:
      documentType === "invoice"
        ? `Invoice ${emailDocumentRecord?.invoiceNumber || ""} from ${profile.businessName || "Your Business"}`
        : `Quote ${emailDocumentRecord?.quoteNumber || ""} from ${profile.businessName || "Your Business"}`,
    customerName: getClientName(emailDocumentRecord?.clientId),
    clientName: getClientById(emailDocumentRecord?.clientId)?.name || "",
    clientEmail: getClientById(emailDocumentRecord?.clientId)?.email || "",
    businessName: profile?.businessName || "",
    businessAddress: profile?.address || "",
    businessEmail: profile?.email || "",
    businessPhone: profile?.phone || "",
    abn: profile?.abn || "",
    logoDataUrl: profile?.logoDataUrl || "",
    documentType,
    html: emailBodyHtml,
    documentHtml:
      documentType === "quote"
        ? (quoteHtml || emailBodyHtml)
        : (invoiceHtml || emailBodyHtml),
    quoteHtml: documentType === "quote" ? (quoteHtml || emailBodyHtml) : "",
    invoiceHtml: documentType === "invoice" ? (invoiceHtml || emailBodyHtml) : "",
    text: `Please see your ${documentType} below in the email body.`,
    filename: `${documentType}-${emailDocumentRecord?.invoiceNumber || emailDocumentRecord?.quoteNumber || "document"}.pdf`,
    replyTo: profile?.email || "",
    number:
      documentType === "invoice"
        ? emailDocumentRecord?.invoiceNumber || ""
        : emailDocumentRecord?.quoteNumber || "",
    invoiceNumber: emailDocumentRecord?.invoiceNumber || "",
    quoteNumber: emailDocumentRecord?.quoteNumber || "",
    invoiceDate: emailDocumentRecord?.invoiceDate || "",
    dueDate: emailDocumentRecord?.dueDate || "",
    quoteDate: emailDocumentRecord?.quoteDate || "",
    expiryDate: emailDocumentRecord?.expiryDate || "",
    description: emailDocumentRecord?.description || "",
    comments: emailDocumentRecord?.comments || "",
    quantity: safeNumber(emailDocumentRecord?.quantity || 1),
    subtotal: safeNumber(emailDocumentRecord?.subtotal),
    gst: safeNumber(emailDocumentRecord?.gst),
    total: resolvedTotal,
    currencyCode: emailDocumentRecord?.currencyCode || "AUD",
    hidePhoneNumber: Boolean(emailDocumentRecord?.hidePhoneNumber),
    stripeCheckoutUrl: stripeCheckoutUrl || emailDocumentRecord?.stripeCheckoutUrl || "",
  };

  const endpoint = `${serverBaseUrl}/api/send-document-email`;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("EMAIL NETWORK ERROR:", {
      endpoint,
      documentType,
      error,
    });
    throw new Error(`Could not reach the email server at ${endpoint}. Check the Stripe Server URL setting and your backend CORS configuration.`);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    console.error("EMAIL RESPONSE PARSE ERROR:", error);
  }

  if (!response.ok) {
    console.error("EMAIL ERROR:", data);
    throw new Error(data?.error || data?.details || "Email failed");
  }

  return {
    ok: true,
    message: data?.message || "Email sent",
    recipients: recipientList,
    stripeCheckoutUrl,
    updatedDocumentRecord: emailDocumentRecord,
  };
};
    useEffect(() => {
    setInvoiceForm((prev) => {
      const currentDate = prev.invoiceDate || todayLocal();
      const autoDueDate = addDays(currentDate, (safeNumber(profile.paymentTermsDays) || 14));
      return { ...prev,
        dueDate: autoDueDate,
        hidePhoneNumber: profile.hidePhoneOnDocs,
      };
    });
    }, [profile.paymentTermsDays, profile.hidePhoneOnDocs]);

    useEffect(() => {
    setInvoiceForm((prev) => ({ ...prev,
      dueDate: addDays(prev.invoiceDate || todayLocal(), (safeNumber(profile.paymentTermsDays) || 14)),
    }));
    }, [invoiceForm.invoiceDate]);

    useEffect(() => {
    setQuoteForm((prev) => ({ ...prev,
      hidePhoneNumber: profile.hidePhoneOnDocs,
    }));
    }, [profile.hidePhoneOnDocs]);

    useEffect(() => {
    setInvoiceForm((prev) => {
      if (!prev.savedRecordId) return prev;
      return {
        ...prev,
        savedRecordId: null,
        invoiceNumber: "",
      };
    });
    }, [invoiceForm.clientId, invoiceForm.invoiceDate, invoiceForm.dueDate, invoiceForm.lineItems, invoiceForm.description, invoiceForm.subtotal, invoiceForm.quantity, invoiceForm.comments, invoiceForm.purchaseOrderReference, invoiceForm.includesUntaxedPortion, invoiceForm.hidePhoneNumber, invoiceForm.gstType, invoiceForm.gstOverride, invoiceForm.manualGst, invoiceForm.startDate, invoiceForm.endDate, invoiceForm.sendDate, invoiceForm.sendTime, invoiceForm.recurs, invoiceForm.serviceId]);

    useEffect(() => {
    setQuoteForm((prev) => {
      if (!prev.savedRecordId) return prev;
      return {
        ...prev,
        savedRecordId: null,
        quoteNumber: "",
      };
    });
    }, [quoteForm.clientId, quoteForm.quoteDate, quoteForm.expiryDate, quoteForm.lineItems, quoteForm.serviceId, quoteForm.gstType, quoteForm.manualGst, quoteForm.currencyCode, quoteForm.description, quoteForm.quantity, quoteForm.subtotal, quoteForm.gstOverride, quoteForm.comments, quoteForm.hidePhoneNumber]);

    useEffect(() => {
    if (!invoiceEditorOpen || !invoiceEditorForm) return;

    setInvoiceEditorForm((prev) => {
      if (!prev) return prev;
      const selectedClient = getClientById(prev.clientId) || clients[0];
      if (!selectedClient) return prev;
      const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

      return { ...prev,
        clientId: selectedClient.id,
        currencyCode: getClientCurrencyCode(selectedClient),
        gstType: gstExempt ? "GST Free" : prev.gstType || "GST on Income (10%)",
      };
    });
    }, [clients, invoiceEditorOpen]);

    useEffect(() => {
    if (!quoteEditorOpen || !quoteEditorForm) return;

    setQuoteEditorForm((prev) => {
      if (!prev) return prev;
      const selectedClient = getClientById(prev.clientId) || clients[0];
      if (!selectedClient) return prev;
      const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

      return { ...prev,
        clientId: selectedClient.id,
        currencyCode: getClientCurrencyCode(selectedClient),
        gstType: gstExempt ? "GST Free" : prev.gstType || "GST on Income (10%)",
      };
    });
    }, [clients, quoteEditorOpen]);

    useEffect(() => {
    if (!clients.length) return;

    setInvoiceForm((prev) => {
      const clientId = clients.some((c) => c.id === safeNumber(prev.clientId)) ? prev.clientId : clients[0].id;
      const selectedClient = getClientById(clientId) || clients[0];
      return { ...prev,
        clientId,
        currencyCode: getClientCurrencyCode(selectedClient),
        manualGst: clientIsGstExempt(clientId) ? false : prev.manualGst,
        gstOverride: clientIsGstExempt(clientId) ? "" : prev.gstOverride,
      };
    });

    setQuoteForm((prev) => {
      const clientId = clients.some((c) => c.id === safeNumber(prev.clientId)) ? prev.clientId : clients[0].id;
      const selectedClient = getClientById(clientId) || clients[0];
      return { ...prev,
        clientId,
        currencyCode: getClientCurrencyCode(selectedClient),
        manualGst: clientIsGstExempt(clientId) ? false : prev.manualGst,
        gstOverride: clientIsGstExempt(clientId) ? "" : prev.gstOverride,
      };
    });
    }, [clients]);

    const invoiceAllocations = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "Paid")
      .map((inv) => {
        const gross = safeNumber(inv.total);
        const gst = safeNumber(inv.gst);
        const incomeExGst = gross - gst;
        const client = getClientById(inv.clientId);
        const feeAmount =
          inv.feeAmount != null ? safeNumber(inv.feeAmount) : calculateAdjustmentValues({
            subtotal: safeNumber(inv.subtotal),
            total: gross,
            client,
            profile,
          }).feeAmount;
        const taxWithheld =
          inv.taxWithheld != null ? safeNumber(inv.taxWithheld) : calculateAdjustmentValues({
            subtotal: safeNumber(inv.subtotal),
            total: gross,
            client,
            profile,
          }).taxWithheld;
        const estimatedTax = client?.deductsTaxPrior ? 0 : incomeExGst * (safeNumber(profile.taxRate) / 100);
        const netAvailable =
          inv.netExpected != null
            ? safeNumber(inv.netExpected)
            : gross - gst - estimatedTax - feeAmount - taxWithheld;
        return { ...inv,
          gross,
          gst,
          incomeExGst,
          estimatedTax,
          fee: feeAmount,
          taxWithheld,
          netAvailable,
        };
      });
    }, [invoices, clients, profile.taxRate, profile.feeRate]);

    const totals = useMemo(() => {
    const totalIncome = invoices.reduce((sum, inv) => sum + safeNumber(inv.total), 0);
    const paidIncome = invoices
      .filter((x) => x.status === "Paid")
      .reduce((sum, inv) => sum + safeNumber(inv.total), 0);
    const totalExpenses = expenses.reduce((sum, ex) => sum + safeNumber(ex.amount), 0);

    const gstCollected = invoiceAllocations.reduce((sum, x) => sum + x.gst, 0);
    const gstOnExpenses = expenses.reduce((sum, ex) => sum + safeNumber(ex.gst), 0);
    const gstPayable = gstCollected - gstOnExpenses;

    const incomeExGst = invoiceAllocations.reduce((sum, x) => sum + x.incomeExGst, 0);
    const estimatedTax = invoiceAllocations.reduce((sum, x) => sum + x.estimatedTax, 0);
    const totalFees = invoiceAllocations.reduce((sum, x) => sum + x.fee, 0);
    const totalTaxWithheld = invoiceAllocations.reduce((sum, x) => sum + x.taxWithheld, 0);
    const preExpenseAvailable = invoiceAllocations.reduce((sum, x) => sum + x.netAvailable, 0);
    const monthlySubscriptionCost = safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION);
    const safeToSpend = preExpenseAvailable - totalExpenses - monthlySubscriptionCost;

    return {
      totalIncome,
      paidIncome,
      totalExpenses,
      gstCollected,
      gstOnExpenses,
      gstPayable,
      incomeExGst,
      estimatedTax,
      totalFees,
      totalTaxWithheld,
      preExpenseAvailable,
      monthlySubscriptionCost,
      safeToSpend,
    };
    }, [invoices, expenses, invoiceAllocations]);


    const buildClientEditorForm = (client) => ({ ...blankClient,
    ...(client || {}),
    });
    const buildExpenseEditorForm = (expense) => ({ ...(expense || {}),
    date: expense?.date || todayLocal(),
    dueDate: expense?.dueDate || expense?.date || todayLocal(),
    supplier: expense?.supplier || "",
    category: expense?.category || "",
    description: expense?.description || "",
    amount: expense?.amount != null ? String(expense.amount) : "",
    expenseType: expense?.expenseType || "",
    workType: expense?.workType || profile.workType,
    receiptFileName: expense?.receiptFileName || "",
    receiptUrl: expense?.receiptUrl || "",
    });
    const buildIncomeSourceEditorForm = (item) => ({ ...(item || {}),
    name: item?.name || "",
    incomeType: item?.incomeType || "Casual employment",
    beforeTax: item?.beforeTax != null ? String(item.beforeTax) : "",
    frequency: item?.frequency || "",
    startedAfterDate: Boolean(item?.startedAfterDate),
    hasEndDate: Boolean(item?.hasEndDate),
    });
    const openClientEditor = (client) => {
    setClientEditorForm(buildClientEditorForm(client));
    setClientEditorOpen(true);
    };
    const closeClientEditor = () => {
    setClientEditorOpen(false);
    setClientEditorForm(null);
    };
    const openExpenseEditor = (expense) => {
    setExpenseEditorForm(buildExpenseEditorForm(expense));
    setExpenseEditorOpen(true);
    };
    const closeExpenseEditor = () => {
    setExpenseEditorOpen(false);
    setExpenseEditorForm(null);
    };
    const openIncomeSourceEditor = (item) => {
    setIncomeSourceEditorForm(buildIncomeSourceEditorForm(item));
    setIncomeSourceEditorOpen(true);
    };
    const closeIncomeSourceEditor = () => {
    setIncomeSourceEditorOpen(false);
    setIncomeSourceEditorForm(null);
    };
    const openDocumentEditor = (item) => {
    setDocumentEditorForm({ ...(item || {}),
      name: item?.name || "",
      url: item?.url || "",
    });
    setDocumentEditorOpen(true);
    };

    const closeDocumentEditor = () => {
    setDocumentEditorOpen(false);
    setDocumentEditorForm(null);
    };
    const saveClientEdits = async () => {
    if (!clientEditorForm) return;
    const payload = { ...clientEditorForm,
      name: String(clientEditorForm.name || "").trim(),
      address: clientEditorForm.addressDetails || clientEditorForm.address || "",
    };
    const errors = validateClientPayload(payload);
    if (errors.length) {
      summariseValidationErrors("Client", errors, toast);
      return;
    }
    try {
      const savedClient = await upsertRecordInDatabase(SUPABASE_TABLES.clients, payload);
      setClients((prev) => prev.map((item) => (item.id === savedClient.id ? savedClient : item)));
      closeClientEditor();
      setSupabaseSyncStatus("Client updated in Supabase database");
      toast.success("Client updated!");
    } catch (error) {
      console.error("CLIENT EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client update failed");
      toast.error(error.message || "Client update failed");
    }
    };

    const saveExpenseEdits = async () => {
    if (!expenseEditorForm) return;
    const payload = { ...expenseEditorForm,
      dueDate: expenseEditorForm.dueDate || expenseEditorForm.date,
      supplier: String(expenseEditorForm.supplier || "").trim(),
      category: String(expenseEditorForm.category || "").trim(),
      description: String(expenseEditorForm.description || "").trim(),
      amount: safeNumber(expenseEditorForm.amount),
      gst: safeNumber(expenseEditorForm.amount) / 11,
    };
    const errors = validateExpensePayload(payload);
    if (errors.length) {
      summariseValidationErrors("Expense", errors, toast);
      return;
    }
    try {
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);
      setExpenses((prev) => prev.map((item) => (item.id === savedExpense.id ? savedExpense : item)));
      closeExpenseEditor();
      setSupabaseSyncStatus("Expense updated in Supabase database");
      toast.success("Expense updated!");
    } catch (error) {
      console.error("EXPENSE EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Expense update failed");
      toast.error(error.message || "Expense update failed");
    }
    };


    const markBillPaid = async (expense) => {
    try {
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, {
        ...expense,
        isPaid: true,
        paidAt: new Date().toISOString(),
      });
      setExpenses((prev) => prev.map((item) => (item.id === savedExpense.id ? savedExpense : item)));
      setSupabaseSyncStatus("Bill marked paid");
    } catch (error) {
      console.error("MARK BILL PAID ERROR:", error);
      toast.error(error.message || "Could not mark bill paid");
    }
    };

    const markBillUnpaid = async (expense) => {
    try {
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, {
        ...expense,
        isPaid: false,
        paidAt: "",
      });
      setExpenses((prev) => prev.map((item) => (item.id === savedExpense.id ? savedExpense : item)));
      setSupabaseSyncStatus("Bill marked unpaid");
    } catch (error) {
      console.error("MARK BILL UNPAID ERROR:", error);
      toast.error(error.message || "Could not mark bill unpaid");
    }
    };

    const sendExpenseDirect = async (expense) => {
    try {
      const recipient = String(profile?.email || "").trim();
      if (!recipient) {
        toast.warning("Add your email in Settings first to email this expense.");
        return;
      }

      const subject = encodeURIComponent(`Expense ${expense?.supplier || expense?.description || expense?.id || ""}`);
      const lines = [
        `Expense details`,
        `Supplier: ${expense?.supplier || ""}`,
        `Date: ${formatDateAU(expense?.date)}`,
        `Category: ${expense?.category || ""}`,
        `Amount: ${currency(expense?.amount)}`,
        expense?.description ? `Description: ${expense.description}` : "",
        expense?.receiptUrl ? `Receipt: ${expense.receiptUrl}` : "",
      ].filter(Boolean);
      const body = encodeURIComponent(lines.join("\n"));
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
      toast.success("Expense email opened.");
    } catch (error) {
      console.error("EXPENSE EMAIL ERROR:", error);
      toast.error(error.message || "Expense email failed");
    }
    };

    const saveIncomeSourceEdits = async () => {
    if (!incomeSourceEditorForm) return;
    const payload = { ...incomeSourceEditorForm,
      name: String(incomeSourceEditorForm.name || "").trim(),
      beforeTax: safeNumber(incomeSourceEditorForm.beforeTax),
    };
    const errors = validateIncomeSourcePayload(payload);
    if (errors.length) {
      summariseValidationErrors("Income source", errors, toast);
      return;
    }
    try {
      const savedItem = await upsertRecordInDatabase(SUPABASE_TABLES.incomeSources, payload);
      setIncomeSources((prev) => prev.map((item) => (item.id === savedItem.id ? savedItem : item)));
      closeIncomeSourceEditor();
      setSupabaseSyncStatus("Income source updated in Supabase database");
      toast.success("Income source updated!");
    } catch (error) {
      console.error("INCOME SOURCE EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source update failed");
      toast.error(error.message || "Income source update failed");
    }
    };
    const saveDocumentEdits = async () => {
    if (!documentEditorForm) return;
    const payload = { ...documentEditorForm,
      name: String(documentEditorForm.name || "").trim(),
      url: String(documentEditorForm.url || "").trim(),
    };
    if (!payload.name) {
      toast.warning("Document name is required");
      return;
    }
    try {
      const savedDocument = await upsertRecordInDatabase(SUPABASE_TABLES.documents, payload);
      setDocuments((prev) => prev.map((item) => (item.id === savedDocument.id ? savedDocument : item)));
      closeDocumentEditor();
      setSupabaseSyncStatus("Document updated in Supabase database");
      toast.success("Document updated!");
    } catch (error) {
      console.error("DOCUMENT EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Document update failed");
      toast.error(error.message || "Document update failed");
    }
    };

    const saveClient = async () => {
    setSavingClient(true);
    const payload = {
      ...clientForm,
      name: String(clientForm.name || "").trim(),
      address: clientForm.addressDetails || clientForm.address || "",
    };
    const errors = validateClientPayload(payload);
    if (errors.length) {
      summariseValidationErrors("Client", errors, toast);
      return;
    }

    try {
      const savedClient = await upsertRecordInDatabase(SUPABASE_TABLES.clients, payload);
      setClients((prev) => [...prev, savedClient]);
      setSupabaseSyncStatus("Client saved to Supabase database");
      setClientForm(blankClient);
      toast.success("Client saved!");
    } catch (error) {
      console.error("CLIENT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client save failed");
      toast.error(error.message || "Client save failed");
    } finally {
      setSavingClient(false);
    }
    };

    const saveInvoice = async () => {
    const computedLines = computeLineItemTotals(invoiceForm.lineItems, invoiceForm.clientId);
    const hasLines = computedLines.some((l) => l.rowSubtotal > 0 || l.description);
    if (!invoiceForm.clientId) { toast.warning("Please select a client for this invoice"); return; }
    if (!hasLines) { toast.warning("Add at least one line item with a description and amount"); return; }

    const subtotal = computedLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = computedLines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: invoiceForm.clientId,
      subtotal,
      total,
      gst,
      purchaseOrderReference: invoiceForm.purchaseOrderReference,
    });
    const invoiceNumber = nextNumber(profile.invoicePrefix, invoices, "invoiceNumber");
    const invoiceDate = invoiceForm.invoiceDate || todayLocal();
    const dueDate = invoiceForm.dueDate || addDays(invoiceDate, (safeNumber(profile.paymentTermsDays) || 14));
    const payload = {
      invoiceNumber,
      clientId: safeNumber(invoiceForm.clientId),
      invoiceDate,
      dueDate,
      startDate: invoiceForm.startDate,
      endDate: invoiceForm.endDate,
      sendDate: invoiceForm.sendDate,
      sendTime: invoiceForm.sendTime,
      recurs: invoiceForm.recurs,
      lineItems: computedLines,
      gstType: invoiceForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: invoiceForm.comments,
      purchaseOrderReference: invoiceForm.purchaseOrderReference,
      includesUntaxedPortion: invoiceForm.includesUntaxedPortion,
      hidePhoneNumber: invoiceForm.hidePhoneNumber,
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      status: "Draft",
      paymentReference: makePaymentReference(invoiceNumber),
      stripeCheckoutUrl: "",
    };

    setSavingInvoice(true);
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, payload);
      let nextInvoice = savedInvoice;
      const saveMessage = "Invoice saved to Supabase database. Use Preview to print or download the PDF.";

      setInvoices((prev) => [...prev, nextInvoice]);
      setInvoiceForm((prev) => ({
        ...prev,
        savedRecordId: nextInvoice.id,
        invoiceNumber: nextInvoice.invoiceNumber || "",
        currencyCode: nextInvoice.currencyCode || prev.currencyCode,
      }));
      setSupabaseSyncStatus(saveMessage);
      toast.success(saveMessage);
      return true;
    } catch (error) {
      console.error("INVOICE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice save failed");
      toast.error(error.message || "Invoice save failed");
      return false;
    } finally {
      setSavingInvoice(false);
    }
    };

    const openInvoiceEditor = (invoice) => {
    setInvoiceEditorForm(buildInvoiceEditorForm(invoice));
    setInvoiceEditorOpen(true);
    };
    const closeInvoiceEditor = () => {
    setInvoiceEditorOpen(false);
    setInvoiceEditorForm(null);
    };
    const saveInvoiceEdits = async () => {
    if (!invoiceEditorForm?.id || !invoiceEditorForm.clientId) return;
    const computedLines = computeLineItemTotals(invoiceEditorForm.lineItems || [], invoiceEditorForm.clientId);
    const subtotal = computedLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = computedLines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: invoiceEditorForm.clientId,
      subtotal,
      total,
      gst,
      purchaseOrderReference: invoiceEditorForm.purchaseOrderReference,
    });
    const updatedInvoice = {
      id: invoiceEditorForm.id,
      invoiceNumber: invoiceEditorForm.invoiceNumber,
      clientId: safeNumber(invoiceEditorForm.clientId),
      invoiceDate: invoiceEditorForm.invoiceDate,
      dueDate: invoiceEditorForm.dueDate,
      startDate: invoiceEditorForm.startDate,
      endDate: invoiceEditorForm.endDate,
      sendDate: invoiceEditorForm.sendDate,
      sendTime: invoiceEditorForm.sendTime,
      recurs: invoiceEditorForm.recurs,
      lineItems: computedLines,
      gstType: invoiceEditorForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: invoiceEditorForm.comments,
      purchaseOrderReference: invoiceEditorForm.purchaseOrderReference,
      includesUntaxedPortion: invoiceEditorForm.includesUntaxedPortion,
      hidePhoneNumber: invoiceEditorForm.hidePhoneNumber,
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      status: invoiceEditorForm.status || "Draft",
      paymentReference: invoiceEditorForm.paymentReference || "",
      stripeCheckoutUrl: invoiceEditorForm.stripeCheckoutUrl || "",
    };

    setSavingInvoiceEdits(true);
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === invoiceEditorForm.id ? savedInvoice : invoice))
      );
      setSupabaseSyncStatus("Invoice changes saved to Supabase database");
      closeInvoiceEditor();
    } catch (error) {
      console.error("INVOICE UPDATE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice update failed");
      toast.error(error.message || "Invoice update failed");
    } finally {
      setSavingInvoiceEdits(false);
    }
    };
    const saveQuote = async () => {
    const computedLines = computeLineItemTotals(quoteForm.lineItems, quoteForm.clientId);
    const hasLines = computedLines.some((l) => l.rowSubtotal > 0 || l.description);
    if (!quoteForm.clientId) { toast.warning("Please select a client for this quote"); return; }
    if (!hasLines) { toast.warning("Add at least one line item with a description and amount"); return; }

    const subtotal = computedLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = computedLines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: quoteForm.clientId,
      subtotal,
      total,
      gst,
    });
    const quoteNumber = nextNumber(profile.quotePrefix, quotes, "quoteNumber");
    const quoteDate = quoteForm.quoteDate || todayLocal();
    const expiryDate = quoteForm.expiryDate || addDays(quoteDate, 31);
    const payload = {
      quoteNumber,
      clientId: safeNumber(quoteForm.clientId),
      quoteDate,
      expiryDate,
      lineItems: computedLines,
      gstType: quoteForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: quoteForm.comments,
      hidePhoneNumber: quoteForm.hidePhoneNumber,
      status: "Draft",
    };
    setSavingQuote(true);
    try {
      const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, payload);
      let nextQuote = savedQuote;
      const saveMessage = "Quote saved to Supabase database. Use Preview to print or download the PDF.";

      setQuotes((prev) => [...prev, nextQuote]);
      setQuoteForm((prev) => ({
        ...prev,
        savedRecordId: nextQuote.id,
        quoteNumber: nextQuote.quoteNumber || "",
        currencyCode: nextQuote.currencyCode || prev.currencyCode,
      }));
      setSupabaseSyncStatus(saveMessage);
      toast.success(saveMessage);
      return true;
    } catch (error) {
      console.error("QUOTE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote save failed");
      toast.error(error.message || "Quote save failed");
      return false;
    } finally {
      setSavingQuote(false);
    }
    };

    const openQuoteEditor = (quote) => {
    setQuoteEditorForm(buildQuoteEditorForm(quote));
    setQuoteEditorOpen(true);
    };
    const closeQuoteEditor = () => {
    setQuoteEditorOpen(false);
    setQuoteEditorForm(null);
    };
    const saveQuoteEdits = async () => {
    if (!quoteEditorForm?.id || !quoteEditorForm.clientId) return;
    const computedLines = computeLineItemTotals(quoteEditorForm.lineItems || [], quoteEditorForm.clientId);
    const subtotal = computedLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = computedLines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: quoteEditorForm.clientId,
      subtotal,
      total,
      gst,
    });
    const updatedQuote = {
      id: quoteEditorForm.id,
      quoteNumber: quoteEditorForm.quoteNumber,
      clientId: safeNumber(quoteEditorForm.clientId),
      quoteDate: quoteEditorForm.quoteDate,
      expiryDate: quoteEditorForm.expiryDate,
      lineItems: computedLines,
      gstType: quoteEditorForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: quoteEditorForm.comments,
      hidePhoneNumber: quoteEditorForm.hidePhoneNumber,
      status: quoteEditorForm.status || "Draft",
    };

    setSavingQuoteEdits(true);
    try {
      const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, updatedQuote);
      setQuotes((prev) =>
        prev.map((quote) => (quote.id === quoteEditorForm.id ? savedQuote : quote))
      );
      setSupabaseSyncStatus("Quote changes saved to Supabase database");
      closeQuoteEditor();
    } catch (error) {
      console.error("QUOTE UPDATE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote update failed");
      toast.error(error.message || "Quote update failed");
    } finally {
      setSavingQuoteEdits(false);
    }
    };   const convertQuoteToInvoice = async (quote) => {
    if (!quote?.id) return;
    try {
      // 1. Mark the quote as Accepted and save
      const acceptedQuote = { ...quote, status: "Accepted" };
      const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, acceptedQuote);
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? savedQuote : q));

      // 2. Build the invoice payload from the quote — preserve all line items, amounts, client
      const invoiceNumber = nextNumber(profile.invoicePrefix, invoices, "invoiceNumber");
      const invoiceDate = todayLocal();
      const dueDate = addDays(invoiceDate, safeNumber(profile.paymentTermsDays) || 14);
      const invoicePayload = {
        invoiceNumber,
        clientId: safeNumber(quote.clientId),
        invoiceDate,
        dueDate,
        lineItems: quote.lineItems || [],
        gstType: quote.gstType || "GST on Income (10%)",
        currencyCode: quote.currencyCode || "AUD",
        gstStatus: quote.gstStatus || "",
        description: quote.description || "",
        subtotal: safeNumber(quote.subtotal),
        gst: safeNumber(quote.gst),
        total: safeNumber(quote.total),
        feeAmount: safeNumber(quote.feeAmount),
        taxWithheld: safeNumber(quote.taxWithheld),
        netExpected: safeNumber(quote.netExpected),
        quantity: safeNumber(quote.quantity) || 1,
        comments: quote.comments || "",
        purchaseOrderReference: quote.purchaseOrderReference || "",
        hidePhoneNumber: quote.hidePhoneNumber ?? profile.hidePhoneOnDocs,
        status: "Draft",
        paymentReference: makePaymentReference(invoiceNumber),
        stripeCheckoutUrl: "",
        convertedFromQuoteId: quote.id,
        convertedFromQuoteNumber: quote.quoteNumber || "",
      };
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, invoicePayload);
      setInvoices((prev) => [...prev, savedInvoice]);

      toast.success(`Invoice ${invoiceNumber} created from quote ${quote.quoteNumber || quote.id}!`);
      setSupabaseSyncStatus("Quote converted to invoice");
      closeQuoteEditor();
      setActivePage("invoices");
    } catch (error) {
      console.error("CONVERT QUOTE TO INVOICE ERROR:", error);
      toast.error(error.message || "Could not convert quote to invoice");
    }
    };
    const sendInvoiceFromPreview = async (invoiceId, previewWindow) => {
    const invoice = invoices.find((item) => String(item.id) === String(invoiceId));
    if (!invoice) {
      previewWindow?.alert?.("Invoice not found. Save the invoice first, then try again.");
      return;
    }

    const statusEl = previewWindow?.document?.getElementById?.("preview-email-status");
    const emailButton = previewWindow?.document?.getElementById?.("preview-email-button");
    const setStatus = (message, colour = "#64748B") => {
      if (statusEl) {
        statusEl.textContent = message || "";
        statusEl.style.color = colour;
      }
    };

    try {
      if (emailButton) {
        emailButton.disabled = true;
        emailButton.textContent = "Sending...";
        emailButton.style.opacity = "0.7";
        emailButton.style.cursor = "not-allowed";
      }
      setStatus("Sending invoice...", "#64748B");

      const result = await sendSavedDocumentEmail({
        documentType: "invoice",
        documentRecord: invoice,
      });

      if (result?.ok) {
        const updatedInvoice = {
          ...invoice,
          ...(result.updatedDocumentRecord || {}),
          stripeCheckoutUrl:
            result.stripeCheckoutUrl ||
            result.updatedDocumentRecord?.stripeCheckoutUrl ||
            invoice.stripeCheckoutUrl ||
            "",
          emailedAt: new Date().toISOString(),
          emailRecipients: result.recipients || [],
        };
        const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
        setInvoices((prev) =>
          prev.map((item) => (String(item.id) === String(invoiceId) ? savedInvoice : item))
        );
        setSupabaseSyncStatus(result.message || "Invoice emailed");
        setStatus(result.message || "Invoice emailed.", "#166534");
      } else {
        setStatus(result?.message || "Could not send invoice.", "#B42318");
      }
    } catch (error) {
      console.error("PREVIEW INVOICE EMAIL ERROR:", error);
      setStatus(`Send failed: ${error.message || "Unknown error"}`, "#B42318");
    } finally {
      if (emailButton) {
        emailButton.disabled = false;
        emailButton.textContent = "Email Invoice";
        emailButton.style.opacity = "1";
        emailButton.style.cursor = "pointer";
      }
    }
    };

    const sendQuoteFromPreview = async (quoteId, previewWindow) => {
    const quote = quotes.find((item) => String(item.id) === String(quoteId));
    if (!quote) {
      previewWindow?.alert?.("Quote not found. Save the quote first, then try again.");
      return;
    }

    const statusEl = previewWindow?.document?.getElementById?.("preview-email-status");
    const emailButton = previewWindow?.document?.getElementById?.("preview-email-button");
    const setStatus = (message, colour = "#64748B") => {
      if (statusEl) {
        statusEl.textContent = message || "";
        statusEl.style.color = colour;
      }
    };

    try {
      if (emailButton) {
        emailButton.disabled = true;
        emailButton.textContent = "Sending...";
        emailButton.style.opacity = "0.7";
        emailButton.style.cursor = "not-allowed";
      }
      setStatus("Sending quote...", "#64748B");

      const result = await sendSavedDocumentEmail({
        documentType: "quote",
        documentRecord: quote,
      });

      if (result?.ok) {
        const updatedQuote = {
          ...quote,
          emailedAt: new Date().toISOString(),
          emailRecipients: result.recipients || [],
        };
        const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, updatedQuote);
        setQuotes((prev) =>
          prev.map((item) => (String(item.id) === String(quoteId) ? savedQuote : item))
        );
        setSupabaseSyncStatus(result.message || "Quote emailed");
        setStatus(result.message || "Quote emailed.", "#166534");
      } else {
        setStatus(result?.message || "Could not send quote.", "#B42318");
      }
    } catch (error) {
      console.error("PREVIEW QUOTE EMAIL ERROR:", error);
      setStatus(`Send failed: ${error.message || "Unknown error"}`, "#B42318");
    } finally {
      if (emailButton) {
        emailButton.disabled = false;
        emailButton.textContent = "Email Quote";
        emailButton.style.opacity = "1";
        emailButton.style.cursor = "pointer";
      }
    }
    };

    const writeQuotePreviewToWindow = (w, quote, options = {}) => {
    const html = buildQuoteHtml(quote, options, { profile, clients });
    const blob = new Blob([html], { type: "text/html" });
    openBlobUrlInWindow(w, blob);
    };

    const openSavedQuotePreview = (quote) => {
    const w = window.open("", "_blank");
    if (!w) return;
    writeQuotePreviewToWindow(w, quote, { allowEmail: true });
    };

    const saveExpense = async () => {
    try {
      const expenseErrors = validateExpensePayload({ ...expenseForm, amount: safeNumber(expenseForm.amount) });
      if (expenseErrors.length) {
        summariseValidationErrors("Expense", expenseErrors, toast);
        return;
      }
      if (!expenseForm.supplier || !expenseForm.amount || !expenseForm.category) {
        toast.warning("Please fill in supplier, amount and category");
        return;
      }

      const amount = safeNumber(expenseForm.amount);
      const gst = amount / 11;
      let receiptUrl = "";
      let receiptFileName = "";

      if (receiptFile) {
        const uploaded = await uploadReceiptToSupabase(receiptFile);
        receiptUrl = uploaded.receiptUrl;
        receiptFileName = uploaded.fileName;
      }

      const payload = {
        ...expenseForm,
        dueDate: expenseForm.dueDate || expenseForm.date,
        amount,
        gst,
        isPaid: false,
        paidAt: "",
        receiptFileName,
        receiptUrl,
      };
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);

      setExpenses((prev) => [...prev, savedExpense]);
      setExpenseForm({
        date: todayLocal(),
        dueDate: addDaysEOM(todayLocal()),
        supplier: "",
        category: "",
        description: "",
        amount: "",
        expenseType: "",
        workType: profile.workType,
        receiptFileName: "",
        receiptUrl: "",
      });
      setSupabaseSyncStatus("Expense saved to Supabase database");
      setReceiptFile(null);
      toast.success("Expense saved!");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      setSupabaseSyncStatus(err.message || "Expense save failed");
      toast.error(err.message || "Something went wrong");
    }
    };

    const markInvoicePaid = async (invoiceId, paidVia = "Manual") => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const updatedInvoice = { ...invoice, status: "Paid", paidAt: new Date().toISOString(), paidVia };
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? savedInvoice : inv))
      );
      setSupabaseSyncStatus("Invoice payment status saved to Supabase database");
    } catch (error) {
      console.error("MARK INVOICE PAID ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice payment update failed");
      toast.error(error.message || "Invoice payment update failed");
    }
    };
    async function simulateInvoicePayment(invoiceId) {
    const invoice = invoices.find((x) => String(x.id) === String(invoiceId));
    if (!invoice) {
      toast.error("Invoice not found");
      return;
    }

    const updatedInvoice = { ...invoice,
      status: "Paid",
      paidAt: new Date().toISOString(),
    };
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((inv) =>
          String(inv.id) === String(invoiceId) ? savedInvoice : inv
        )
      );
      const client = getClientById(invoice.clientId);
      setSupabaseSyncStatus("Simulated payment saved to Supabase database");
      toast.success(`Simulated payment completed for ${invoice.invoiceNumber}`);
    } catch (error) {
      console.error("SIMULATED PAYMENT ERROR:", error);
      setSupabaseSyncStatus(error.message || "Simulated payment failed");
      toast.error(error.message || "Simulated payment failed");
    }
    }

    const deleteInvoice = (id) => {
    confirm({ title: "Delete invoice", message: "This invoice will be permanently deleted.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.invoices, id);
      setInvoices((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Invoice deleted from Supabase database");
    } catch (error) {
      console.error("INVOICE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice delete failed");
      toast.error(error.message || "Invoice delete failed");
    }
      },
    });
    };
    const deleteQuote = (id) => {
    confirm({ title: "Delete quote", message: "This quote will be permanently deleted.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.quotes, id);
      setQuotes((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Quote deleted from Supabase database");
    } catch (error) {
      console.error("QUOTE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote delete failed");
      toast.error(error.message || "Quote delete failed");
    }
      },
    });
    };
    const deleteExpense = (id) => {
    confirm({ title: "Delete expense", message: "This expense record will be permanently deleted.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.expenses, id);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Expense deleted from Supabase database");
    } catch (error) {
      console.error("EXPENSE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Expense delete failed");
      toast.error(error.message || "Expense delete failed");
    }
      },
    });
    };
    const deleteClient = (id) => {
    confirm({ title: "Delete client", message: "This client will be permanently deleted.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.clients, id);
      setClients((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Client deleted from Supabase database");
    } catch (error) {
      console.error("CLIENT DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client delete failed");
      toast.error(error.message || "Client delete failed");
    }
      },
    });
    };
    const deleteIncomeSource = (id) => {
    confirm({ title: "Delete income source", message: "This income source will be permanently deleted.", confirmLabel: "Delete", onConfirm: async () => {
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.incomeSources, id);
      setIncomeSources((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Income source deleted from Supabase database");
    } catch (error) {
      console.error("INCOME SOURCE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source delete failed");
      toast.error(error.message || "Income source delete failed");
    }
      },
    });
    };

  const resolveInvoiceStripeAmount = (invoice) => {
    const storedTotal = safeNumber(
      invoice?.total ?? invoice?.grandTotal ?? invoice?.invoiceTotal ??
      invoice?.totalAmount ?? invoice?.amount ?? null
    );
    if (storedTotal > 0) return Number(storedTotal.toFixed(2));

    const quantity = Math.max(1, safeNumber(invoice?.quantity || 1));
    const resolvedSubtotal = safeNumber(invoice?.subtotal);
    const resolvedGst = safeNumber(invoice?.gst) > 0
      ? safeNumber(invoice?.gst)
      : calculateFormGst({
          unitPrice: quantity > 0 ? resolvedSubtotal / quantity : resolvedSubtotal,
          quantity,
          gstType: invoice?.gstType || "GST on Income (10%)",
          clientId: invoice?.clientId,
          manualGst: false,
          gstOverride: "",
        });
    const recomputed = resolvedSubtotal + resolvedGst;
    if (recomputed > 0) return Number(recomputed.toFixed(2));
    return 0;
  };

    const createStripeCheckoutForInvoice = async (invoice) => {
    const serverBaseUrl = getApiBaseUrl(profile?.stripeServerUrl);
    const selectedClient = getClientById(invoice?.clientId) || {};

    const rawTotal = resolveInvoiceStripeAmount(invoice);

    if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
      console.error("Stripe invoice total could not be resolved", { invoice, rawTotal });
      throw new Error(`Invoice total could not be determined for ${invoice?.invoiceNumber || invoice?.id}. Please open and re-save the invoice.`);
    }

    const payload = {
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      clientId: invoice?.clientId,
      customerName: selectedClient?.name || selectedClient?.businessName || "",
      customerEmail: selectedClient?.email || "",
      description:
        invoice?.description ||
        `Invoice ${invoice?.invoiceNumber || invoice?.id || ""}`,
      currency: String(invoice?.currencyCode || "AUD").toLowerCase(),
      amount: Number(rawTotal.toFixed(2)),
      total: Number(rawTotal.toFixed(2)),
      successUrl: `${window.location.origin}?stripe=success&invoice=${encodeURIComponent(
        invoice?.invoiceNumber || ""
      )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
      cancelUrl: `${window.location.origin}?stripe=cancel&invoice=${encodeURIComponent(
        invoice?.invoiceNumber || ""
      )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
    };

    let response;

    try {
      response = await fetch(`${serverBaseUrl}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("STRIPE CHECKOUT NETWORK ERROR:", {
        serverBaseUrl,
        error,
      });
      throw new Error(`Could not reach the Stripe server at ${serverBaseUrl}. Check the Stripe Server URL setting and your backend deployment.`);
    }

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

    const payInvoiceWithStripe = async (invoice) => {
    try {
      const checkoutUrl = await createStripeCheckoutForInvoice(invoice);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("STRIPE CHECKOUT ERROR:", error);
      toast.error(error.message || "Stripe checkout failed");
    }
    };

    const resetExpenseModal = () => {
    setExpenseModalOpen(false);
    setExpenseTypeStep(1);
    setExpenseTypeSelection("");
    setExpenseWorkType(profile.workType);
    setExpenseCategorySelection("");
    setSearchExpenseCategory("");
    setReceiptFile(null);
    };

    const nextExpenseModalStep = () => {
    if (expenseTypeStep === 1) {
      if (!expenseTypeSelection) return;
      setExpenseTypeStep(2);
      return;
    }

    if (expenseTypeStep === 2) {
      if (!expenseTypeSelection || !expenseWorkType || !expenseCategorySelection) return;
      setExpenseForm((prev) => ({ ...prev,
        expenseType: expenseTypeSelection,
        workType: expenseWorkType,
        category: expenseCategorySelection,
      }));
      setExpenseTypeStep(3);
      return;
    }

    if (expenseTypeStep === 3) {
      setExpenseModalOpen(false);
      return;
    }
    };


    const openSavedInvoicePreview = async (invoice) => {
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.open();
    w.document.write(`<!doctype html>
    <html>
    <head><meta charset="utf-8" /><title>Invoice Preview</title></head>
    <body style="font-family: Arial, sans-serif; padding: 40px; color: #14202B;">
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">Preparing invoice preview...</div>
    <div style="font-size: 14px; color: #64748B;">Generating the Stripe payment section.</div>
    </body>
    </html>`);
    w.document.close();

    let stripeCheckoutUrl = invoice.stripeCheckoutUrl || "";
    let previewInvoice = { ...invoice };

    try {
      if (!stripeCheckoutUrl && resolveInvoiceStripeAmount(invoice) > 0) {
        stripeCheckoutUrl = await createStripeCheckoutForInvoice(invoice);

        if (stripeCheckoutUrl) {
          previewInvoice = { ...invoice, stripeCheckoutUrl };
          setInvoices((prev) =>
            prev.map((item) =>
              item.id === invoice.id ? { ...item, stripeCheckoutUrl } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("STRIPE PREVIEW ERROR:", error);
    }

    writeInvoicePreviewToWindow(w, previewInvoice, stripeCheckoutUrl, { allowEmail: true }, { profile, clients });
    w.simulateInvoicePayment = () => simulateInvoicePayment(invoice.id);
    };

    const openInvoicePreview = async () => {
    const computedPreviewLines = computeLineItemTotals(invoiceForm.lineItems || [], invoiceForm.clientId);
    const previewSubtotal = computedPreviewLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const previewGst = computedPreviewLines.reduce((s, l) => s + l.rowGst, 0);
    const previewTotal = previewSubtotal + previewGst;

    const savedInvoiceNumber = String(invoiceForm.invoiceNumber || "").trim();
    const previewNumber = savedInvoiceNumber || nextNumber(profile.invoicePrefix, invoices, "invoiceNumber");
    const previewInvoice = {
      id: invoiceForm.savedRecordId || Date.now(),
      invoiceNumber: previewNumber,
      clientId: safeNumber(invoiceForm.clientId),
      invoiceDate: invoiceForm.invoiceDate,
      dueDate: invoiceForm.dueDate,
      description: computedPreviewLines.map((l) => l.description).filter(Boolean).join("; "),
      lineItems: computedPreviewLines,
      subtotal: previewSubtotal,
      gst: previewGst,
      total: previewTotal,
      comments: invoiceForm.comments,
      purchaseOrderReference: invoiceForm.purchaseOrderReference,
      hidePhoneNumber: invoiceForm.hidePhoneNumber,
      quantity: computedPreviewLines.reduce((s, l) => s + l.qty, 0),
      paymentReference: makePaymentReference(previewNumber),
      stripeCheckoutUrl: "",
    };

    const w = window.open("", "_blank");
    if (!w) return;

    let stripeCheckoutUrl = "";
    try {
      if (resolveInvoiceStripeAmount(previewInvoice) > 0) {
        stripeCheckoutUrl = await createStripeCheckoutForInvoice(previewInvoice);
      }
    } catch (error) {
      console.error("STRIPE PREVIEW ERROR:", error);
    }

    const previewInvoiceWithStripe = {
      ...previewInvoice,
      stripeCheckoutUrl,
    };

    writeInvoicePreviewToWindow(w, previewInvoiceWithStripe, stripeCheckoutUrl, { allowEmail: true }, { profile, clients });
    w.simulateInvoicePayment = () => simulateInvoicePayment(previewInvoice.id);
    };

    const openQuotePreview = () => {
    const computedPreviewLines = computeLineItemTotals(quoteForm.lineItems || [], quoteForm.clientId);
    const qSubtotal = computedPreviewLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const qGst = computedPreviewLines.reduce((s, l) => s + l.rowGst, 0);
    const qTotal = qSubtotal + qGst;

    const previewNumber = nextNumber(profile.quotePrefix, quotes, "quoteNumber");
    const previewQuote = {
      id: `preview-${Date.now()}`,
      quoteNumber: previewNumber,
      clientId: safeNumber(quoteForm.clientId),
      quoteDate: quoteForm.quoteDate,
      expiryDate: quoteForm.expiryDate,
      lineItems: computedPreviewLines,
      gstType: quoteForm.gstType,
      currencyCode: getClientCurrencyCode(getClientById(quoteForm.clientId)),
      gstStatus: clientIsGstExempt(quoteForm.clientId)
        ? "GST not applicable"
        : qGst > 0
          ? "GST applies"
          : "GST free",
      description: computedPreviewLines.map((l) => l.description).filter(Boolean).join("; "),
      quantity: computedPreviewLines.reduce((s, l) => s + l.qty, 0),
      subtotal: qSubtotal,
      gst: qGst,
      total: qTotal,
      ...calculateAdjustmentValues({
        subtotal: qSubtotal,
        total: qTotal,
        client: getClientById(quoteForm.clientId),
        profile,
      }),
      comments: quoteForm.comments,
      hidePhoneNumber: quoteForm.hidePhoneNumber,
      status: "Preview",
    };

    const w = window.open("", "_blank");
    if (!w) return;
    writeQuotePreviewToWindow(w, previewQuote, { allowEmail: true });
    };

    const exportToATOForm = () => {
      const classifyIncomeType = (src) => {
        const raw = String(src?.incomeType || "").toLowerCase();
        if (raw.includes("casual") || raw.includes("salary") || raw.includes("wage")) return "Salary/Wages";
        if (raw.includes("business") || raw.includes("sole trader")) return "Business (sole trader)";
        if (raw.includes("interest")) return "Interest";
        if (raw.includes("dividend")) return "Dividends";
        if (raw.includes("foreign")) return "Other";
        return "Other";
      };

      const incomeRecords = invoices
        .filter((inv) => inv.status === "Paid")
        .map((inv) => {
          const client = getClientById(inv.clientId);
          return {
            date: inv.paidAt ? inv.paidAt.slice(0, 10) : (inv.invoiceDate || ""),
            type: "Business (sole trader)",
            payer: client?.name || client?.businessName || inv.clientName || "",
            gross: safeNumber(inv.total),
            withheld: safeNumber(inv.taxWithheld || 0),
            franked: 0,
            franking: 0,
            abn: client?.abn || "",
          };
        });

      incomeSources.forEach((src) => {
        const beforeTax = safeNumber(src.beforeTax);
        if (beforeTax <= 0) return;
        const incomeType = classifyIncomeType(src);
        incomeRecords.push({
          date: todayLocal(),
          type: incomeType,
          payer: src.name || "",
          gross: beforeTax,
          withheld: safeNumber(src.taxWithheld || 0),
          franked: incomeType === "Dividends" ? beforeTax : 0,
          franking: safeNumber(src.frankingCredit || 0),
          abn: "",
        });
      });

      const expenseRecords = expenses.map((exp) => ({
        date: exp.date || "",
        type: exp.category || exp.expenseType || "Other",
        supplier: exp.supplier || exp.description || "",
        amount: safeNumber(exp.amount),
        gstIncl: exp.gstIncluded !== false ? "yes" : "no",
      }));

      const atoState = { income: incomeRecords, expenses: expenseRecords };
      const encoded = encodeURIComponent(JSON.stringify(atoState));
      const atoBaseUrl = profile?.atoExportUrl
        || (typeof import.meta !== "undefined" && import.meta.env?.VITE_ATO_EXPORT_URL)
        || "https://www.sharonogier.com/australian-ato-tax-form.html";
      window.open(`${atoBaseUrl}#import=${encoded}`, "_blank");
    };

    const monthlyFinance = useMemo(() => {
      const bucket = new Map();
      const ensureBucket = (key) => {
        if (!bucket.has(key)) {
          bucket.set(key, {
            monthKey: key,
            label: formatMonthLabel(key),
            revenue: 0,
            expenses: 0,
            gst: 0,
            net: 0,
          });
        }
        return bucket.get(key);
      };

      invoiceAllocations.forEach((invoice) => {
        const key = formatMonthKey(invoice.paidAt || invoice.invoiceDate);
        const row = ensureBucket(key);
        row.revenue += safeNumber(invoice.gross);
        row.gst += safeNumber(invoice.gst);
        row.net += safeNumber(invoice.netAvailable);
      });

      expenses.forEach((expense) => {
        const key = formatMonthKey(expense.date);
        const row = ensureBucket(key);
        row.expenses += safeNumber(expense.amount);
        row.net -= safeNumber(expense.amount);
      });

      return [...bucket.values()]
        .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)))
        .slice(-6);
    }, [invoiceAllocations, expenses]);

    const clientRevenueRows = useMemo(() => {
      const grouped = new Map();
      invoiceAllocations.forEach((invoice) => {
        const key = getClientName(invoice.clientId) || "Unknown client";
        grouped.set(key, (grouped.get(key) || 0) + safeNumber(invoice.gross));
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }, [invoiceAllocations]);

    const expenseCategoryRows = useMemo(() => {
      const grouped = new Map();
      expenses.forEach((expense) => {
        const key = expense.category || expense.expenseType || "Other";
        grouped.set(key, (grouped.get(key) || 0) + safeNumber(expense.amount));
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }, [expenses]);

    const invoiceStatusRows = useMemo(() => {
      const grouped = new Map();
      invoices.forEach((invoice) => {
        const key = invoice.status || "Draft";
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }, [invoices]);

    const recentActivityRows = useMemo(() => {
      const invoiceRows = invoices.map((invoice) => ({
        type: "Invoice",
        sortDate: invoice.paidAt || invoice.invoiceDate || "",
        date: formatDateAU(invoice.paidAt || invoice.invoiceDate),
        label: `${invoice.invoiceNumber || "Invoice"} · ${getClientName(invoice.clientId)}`,
        caption: `${invoice.status || "Draft"} invoice`,
        value: currency(invoice.total),
      }));

      const expenseRows = expenses.map((expense) => ({
        type: "Expense",
        sortDate: expense.date || "",
        date: formatDateAU(expense.date),
        label: expense.supplier || expense.description || "Expense",
        caption: expense.category || expense.expenseType || "Expense",
        value: currency(expense.amount),
      }));

      return [...invoiceRows, ...expenseRows]
        .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
        .slice(0, 6);
    }, [invoices, expenses]);

    const dashboardInsights = useMemo(() => {
      const collectionRate = totals.totalIncome > 0 ? (totals.paidIncome / totals.totalIncome) * 100 : 0;
      const averagePaidInvoice = invoiceAllocations.length ? totals.paidIncome / invoiceAllocations.length : 0;
      const expenseCoverage = totals.totalExpenses > 0 ? totals.safeToSpend / totals.totalExpenses : 0;
      return {
        collectionRate,
        averagePaidInvoice,
        expenseCoverage,
        paidInvoiceCount: invoiceAllocations.length,
      };
    }, [totals, invoiceAllocations]);


    const financialInsights = useMemo(() => {
      const topClientValue = clientRevenueRows[0]?.value || 0;
      const topThreeClientValue = clientRevenueRows.slice(0, 3).reduce((sum, row) => sum + safeNumber(row.value), 0);
      const topClientShare = totals.paidIncome > 0 ? (topClientValue / totals.paidIncome) * 100 : 0;
      const topThreeClientShare = totals.paidIncome > 0 ? (topThreeClientValue / totals.paidIncome) * 100 : 0;
      const averageInvoiceValue = invoices.length ? totals.totalIncome / invoices.length : 0;
      const averageMonthlyRevenue = monthlyFinance.length
        ? monthlyFinance.reduce((sum, month) => sum + safeNumber(month.revenue), 0) / monthlyFinance.length
        : 0;
      const usableCashRatio = totals.paidIncome > 0 ? (totals.safeToSpend / totals.paidIncome) * 100 : 0;
      const expenseRatio = totals.paidIncome > 0 ? (totals.totalExpenses / totals.paidIncome) * 100 : 0;
      const gstRatio = totals.paidIncome > 0 ? (totals.gstPayable / totals.paidIncome) * 100 : 0;
      const taxRatio = totals.paidIncome > 0 ? (totals.estimatedTax / totals.paidIncome) * 100 : 0;
      const volatility = monthlyFinance.length > 1
        ? monthlyFinance.slice(1).map((month, index) => {
            const previous = monthlyFinance[index]?.revenue || 0;
            const change = previous > 0 ? ((month.revenue - previous) / previous) * 100 : 0;
            return { ...month, change };
          })
        : [];
      const averageVolatility = volatility.length
        ? volatility.reduce((sum, row) => sum + Math.abs(row.change), 0) / volatility.length
        : 0;
      const bestMonth = monthlyFinance.length
        ? monthlyFinance.reduce((best, month) => safeNumber(month.revenue) > safeNumber(best.revenue) ? month : best, monthlyFinance[0])
        : null;
      const worstMonth = monthlyFinance.length
        ? monthlyFinance.reduce((worst, month) => safeNumber(month.revenue) < safeNumber(worst.revenue) ? month : worst, monthlyFinance[0])
        : null;
      const latestMonth = monthlyFinance.length ? monthlyFinance[monthlyFinance.length - 1] : null;
      const previousMonth = monthlyFinance.length > 1 ? monthlyFinance[monthlyFinance.length - 2] : null;
      const revenueChangePct = previousMonth && safeNumber(previousMonth.revenue) > 0
        ? ((safeNumber(latestMonth?.revenue) - safeNumber(previousMonth.revenue)) / safeNumber(previousMonth.revenue)) * 100
        : 0;
      const expenseByMonth = expenses.reduce((acc, expense) => {
        const key = String(expense?.date || '').slice(0, 7);
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + safeNumber(expense?.amount);
        return acc;
      }, {});
      const sortedExpenseMonths = Object.entries(expenseByMonth).sort((a, b) => a[0].localeCompare(b[0]));
      const latestExpenseValue = sortedExpenseMonths.length ? safeNumber(sortedExpenseMonths[sortedExpenseMonths.length - 1][1]) : 0;
      const previousExpenseValue = sortedExpenseMonths.length > 1 ? safeNumber(sortedExpenseMonths[sortedExpenseMonths.length - 2][1]) : 0;
      const expenseChangePct = previousExpenseValue > 0 ? ((latestExpenseValue - previousExpenseValue) / previousExpenseValue) * 100 : 0;
      const largestExpenseCategory = expenseCategoryRows[0] || null;
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          100 - Math.min(topClientShare, 100) * 0.35 - Math.min(expenseRatio, 100) * 0.25 - Math.min(averageVolatility, 100) * 0.2 + Math.max(usableCashRatio, 0) * 0.2,
        ),
      );
      let healthLabel = "Needs attention";
      if (healthScore >= 75) healthLabel = "Healthy";
      else if (healthScore >= 55) healthLabel = "Watch list";
      const alerts = [];
      if (topThreeClientShare >= 60) alerts.push(`Client concentration is elevated: ${topThreeClientShare.toFixed(1)}% of paid revenue comes from your top 3 clients.`);
      if (revenueChangePct <= -10) alerts.push(`Revenue is down ${Math.abs(revenueChangePct).toFixed(1)}% versus the prior month.`);
      if (expenseChangePct >= 10) alerts.push(`Expenses are up ${expenseChangePct.toFixed(1)}% versus the prior month.`);
      if (usableCashRatio <= 35 && totals.paidIncome > 0) alerts.push(`Only ${Math.max(usableCashRatio, 0).toFixed(1)}% of paid income is currently safe to spend.`);
      if (!alerts.length) alerts.push("No immediate financial alerts. The current trend looks relatively stable.");
      return {
        topClientShare,
        topThreeClientShare,
        averageInvoiceValue,
        averageMonthlyRevenue,
        usableCashRatio,
        expenseRatio,
        gstRatio,
        taxRatio,
        averageVolatility,
        bestMonth,
        worstMonth,
        revenueChangePct,
        expenseChangePct,
        largestExpenseCategory,
        healthScore,
        healthLabel,
        alerts,
      };
    }, [clientRevenueRows, totals, invoices, monthlyFinance, expenses, expenseCategoryRows]);

    const renderDashboard = () => {
      // ── Onboarding checklist ──────────────────────────────────────
      const onboardingSteps = [
        { label: "Add your business name", done: Boolean(profile.businessName), action: () => { setActivePage("settings"); setActiveSettingsTab("Profile"); } },
        { label: "Add your ABN", done: Boolean(profile.abn), action: () => { setActivePage("settings"); setActiveSettingsTab("Profile"); } },
        { label: "Set your GST registration status", done: Boolean(profile.gstRegistered !== undefined && profile.gstRegistered !== null), action: () => { setActivePage("settings"); setActiveSettingsTab("Financial"); } },
        { label: "Upload your logo", done: Boolean(profile.logoDataUrl), action: () => { setActivePage("settings"); setActiveSettingsTab("Branding"); } },
        { label: "Add your first client", done: clients.length > 0, action: () => setActivePage("invoices") },
        { label: "Create your first invoice", done: invoices.length > 0, action: () => setActivePage("invoices") },
      ];
      const doneCount = onboardingSteps.filter((s) => s.done).length;
      const allDone = doneCount === onboardingSteps.length;
      const pct = Math.round((doneCount / onboardingSteps.length) * 100);

      return (
    <div style={{ display: "grid", gap: 20 }}>
      {!allDone && (
        <div style={{ ...cardStyle, padding: 24, background: "linear-gradient(135deg, #F5ECFB 0%, #EDE9FE 100%)", border: "1px solid #E9D5FF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: colours.purple, marginBottom: 4 }}>🚀 Get started — {doneCount} of {onboardingSteps.length} complete</div>
              <div style={{ fontSize: 13, color: colours.muted }}>Complete these steps to get the most out of your portal</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: colours.purple }}>{pct}%</div>
              <div style={{ fontSize: 11, color: colours.muted }}>set up</div>
            </div>
          </div>
          <div style={{ background: "#E9D5FF", borderRadius: 99, height: 8, marginBottom: 20 }}>
            <div style={{ background: colours.purple, borderRadius: 99, height: 8, width: pct + "%", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {onboardingSteps.map((step, i) => (
              <div key={i} onClick={step.done ? undefined : step.action}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
                  background: step.done ? "#F0FDF4" : "#fff",
                  border: "1px solid " + (step.done ? "#BBF7D0" : "#E9D5FF"),
                  cursor: step.done ? "default" : "pointer",
                  opacity: step.done ? 0.8 : 1 }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>{step.done ? "✅" : "⬜"}</div>
                <div style={{ fontSize: 13, fontWeight: step.done ? 400 : 600, color: step.done ? "#166534" : colours.text,
                  textDecoration: step.done ? "line-through" : "none" }}>{step.label}</div>
                {!step.done && <div style={{ marginLeft: "auto", fontSize: 11, color: colours.purple, fontWeight: 700, flexShrink: 0 }}>Go →</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {allDone && (
        <div style={{ ...cardStyle, padding: 18, background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🎉</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>You're all set up!</div>
            <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>Your portal is fully configured and ready to use.</div>
          </div>
        </div>
      )}
      <DashboardHero
        title={profile.businessName || "My Portal"}
        subtitle="Start with the actions you use most. This home view keeps invoices, quotes, expenses and financial performance in one place so you can move quickly without hunting through the portal."
        highlight={currency(totals.safeToSpend)}
      >
        <InsightChip label="Collection rate" value={`${dashboardInsights.collectionRate.toFixed(1)}%`} />
        <InsightChip label="Subscription/mo" value={currency(totals.monthlySubscriptionCost)} />
        <InsightChip label="Safe to spend" value={currency(totals.safeToSpend)} />
      </DashboardHero>

      <SectionCard title="Action hub" right={<div style={{ fontSize: 12, color: colours.muted }}>Most-used tasks first</div>}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <ActionHubCard
            icon="🧾"
            title="Create invoice"
            description="Generate a new invoice quickly and move straight into the invoice workspace."
            buttonLabel="Open invoices"
            onClick={() => setActivePage("invoices")}
            tone={colours.purple}
          />
          <ActionHubCard
            icon="💬"
            title="Create quote"
            description="Prepare a quote for a client and convert it later when work is approved."
            buttonLabel="Open quotes"
            onClick={() => setActivePage("quotes")}
            tone={colours.teal}
          />
          <ActionHubCard
            icon="💸"
            title="Add expense"
            description="Capture a business expense, upload the receipt and keep your records current."
            buttonLabel="Open expenses"
            onClick={() => setActivePage("expenses")}
            tone={colours.navy}
          />
          <ActionHubCard
            icon="📊"
            title="View insights"
            description="Review cash flow, margins, tax reserves and other performance signals."
            buttonLabel="Open insights"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Gross invoiced" value={currency(totals.totalIncome)} subtitle="All invoice values currently stored in the portal." accent={colours.navy} />
        <MetricCard title="Gross paid" value={currency(totals.paidIncome)} subtitle="Cash received from invoices marked Paid." accent={colours.teal} />
        <MetricCard title="GST payable" value={currency(totals.gstPayable)} subtitle={`Sales GST ${currency(totals.gstCollected)} less expense credits ${currency(totals.gstOnExpenses)}.`} accent={colours.purple} />
        <MetricCard title="Estimated tax reserve" value={currency(totals.estimatedTax)} subtitle="Set aside based on paid income excluding GST." accent={colours.navy} />
        <MetricCard title="Portal subscription" value={currency(totals.monthlySubscriptionCost)} subtitle={`$${safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION)}/mo — set in Settings → Financial.`} accent={colours.purple} />
        <MetricCard title="Safe to spend" value={currency(totals.safeToSpend)} subtitle={`After GST, tax, fees, expenses & $${safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION)}/mo subscription.`} accent={colours.teal} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Monthly financial momentum" right={<div style={{ fontSize: 12, color: colours.muted }}>Latest 6 months</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              {monthlyFinance.map((month) => {
                const maxValue = Math.max(...monthlyFinance.map((item) => Math.max(item.revenue, item.expenses, Math.abs(item.net))), 0);
                const revenueWidth = maxValue > 0 ? (month.revenue / maxValue) * 100 : 0;
                const expenseWidth = maxValue > 0 ? (month.expenses / maxValue) * 100 : 0;
                const netWidth = maxValue > 0 ? (Math.abs(month.net) / maxValue) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>Net {currency(month.net)}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Revenue</span><span>{currency(month.revenue)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(revenueWidth, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Expenses</span><span>{currency(month.expenses)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(expenseWidth, month.expenses ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.purple} 0%, #C084FC 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Net position</span><span>{currency(month.net)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(netWidth, month.net ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: month.net >= 0 ? `linear-gradient(90deg, ${colours.teal} 0%, ${colours.purple} 100%)` : `linear-gradient(90deg, #F59E0B 0%, ${colours.purple} 100%)` }} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices and expenses to unlock the monthly trend view.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash movement"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less estimated tax", value: -totals.estimatedTax },
            { label: "Less platform fees", value: -totals.totalFees },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: `Less subscription (${currency(totals.monthlySubscriptionCost)}/mo)`, value: -totals.monthlySubscriptionCost },
            { label: "Safe to spend", value: totals.safeToSpend },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <TrendBarsCard title="Top clients by paid revenue" subtitle="Based on invoices marked Paid" data={clientRevenueRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid invoices yet." />
        <TrendBarsCard title="Expense categories" subtitle="Largest categories from recorded expenses" data={expenseCategoryRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
        <TrendBarsCard title="Invoice status mix" subtitle="A quick collections snapshot" data={invoiceStatusRows} valueKey="value" formatValue={(value) => `${value} item${value === 1 ? "" : "s"}`} accent={colours.navy} emptyText="No invoices yet." />
      </div>

      <SectionCard title="Financial reports" right={<div style={{ fontSize: 12, color: colours.muted }}>Tap any report to open it</div>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <ActionHubCard
            icon="📈"
            title="Profit & loss"
            description="Income less expenses — operating surplus or deficit after tax reserve."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
          <ActionHubCard
            icon="💧"
            title="Cash movement"
            description="Cash received, GST deducted, tax reserved, fees and closing safe-to-spend."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.teal}
          />
          <ActionHubCard
            icon="🧾"
            title="GST position"
            description="GST collected on invoices less GST credits on expenses — net amount owing."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.navy}
          />
          <ActionHubCard
            icon="📊"
            title="Revenue summary"
            description="Client concentration, best and worst months, revenue volatility."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Reporting actions" right={<div style={{ fontSize: 12, color: colours.muted }}>Use the same SaaS data everywhere</div>}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>ATO export</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Send paid invoice and expense data straight into the tax form page with the current portal records.</div>
                <button style={{ ...buttonPrimary, marginTop: 14 }} onClick={exportToATOForm}>Export to ATO Tax Form</button>
              </div>
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Supabase sync</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Your dashboard reflects the same SaaS entities already saved in Supabase: invoices, expenses, clients, services, income sources, and documents.</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button style={buttonSecondary} onClick={restorePortalStateFromSupabase}>Load from Supabase DB</button>
                  <button style={buttonPrimary} onClick={() => saveAllCurrentStateToSupabase()}>Save to Supabase DB</button>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: colours.muted, lineHeight: 1.6 }}>
              Status: {supabaseSyncStatus}
            </div>
          </div>
        </SectionCard>

        <ActivityListCard title="Recent activity" rows={recentActivityRows} />
      </div>

      <SectionCard title="Paid invoice allocation detail" right={<div style={{ fontSize: 12, color: colours.muted }}>Live from invoices marked Paid</div>}>
        <DataTable
          columns={[
            { key: "invoiceNumber", label: "Invoice" },
            { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
            { key: "gross", label: "Paid", render: (v) => currency(v) },
            { key: "gst", label: "GST", render: (v) => currency(v) },
            { key: "estimatedTax", label: "Tax", render: (v) => currency(v) },
            { key: "fee", label: "Fee", render: (v) => currency(v) },
            { key: "netAvailable", label: "Net", render: (v) => currency(v) },
          ]}
          rows={invoiceAllocations}
        />
      </SectionCard>
    </div>
      );
    };
    const renderFinancialInsights = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="Financial Insights"
        subtitle="A lighter analysis page that keeps the current look, but focuses on interpretation instead of repeating the dashboard."
        highlight={`${financialInsights.healthScore.toFixed(0)}/100`}
      >
        <InsightChip label="Health" value={financialInsights.healthLabel} />
        <InsightChip label="Top 3 client share" value={`${financialInsights.topThreeClientShare.toFixed(1)}%`} />
        <InsightChip label="You keep" value={`${Math.max(financialInsights.usableCashRatio, 0).toFixed(1)}%`} />
      </DashboardHero>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Average monthly revenue" value={currency(financialInsights.averageMonthlyRevenue)} subtitle="Average paid revenue across the months currently shown." accent={colours.navy} />
        <MetricCard title="Revenue change" value={`${financialInsights.revenueChangePct >= 0 ? "+" : ""}${financialInsights.revenueChangePct.toFixed(1)}%`} subtitle="Movement versus the previous month." accent={colours.teal} />
        <MetricCard title="Expense ratio" value={`${financialInsights.expenseRatio.toFixed(1)}%`} subtitle="Recorded expenses as a share of paid income." accent={colours.purple} />
        <MetricCard title="Revenue volatility" value={`${financialInsights.averageVolatility.toFixed(1)}%`} subtitle="Average month-to-month movement across recent months." accent={colours.navy} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Revenue reliability" right={<div style={{ fontSize: 12, color: colours.muted }}>Best, worst, and recent movement</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Best month</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.bestMonth?.label || "—"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.bestMonth?.revenue || 0)}</div>
                </div>
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Worst month</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.worstMonth?.label || "—"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.worstMonth?.revenue || 0)}</div>
                </div>
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Average invoice</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{currency(financialInsights.averageInvoiceValue)}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>Across all invoices in the portal.</div>
                </div>
              </div>
              {monthlyFinance.map((month, index) => {
                const maxRevenue = Math.max(...monthlyFinance.map((item) => item.revenue), 0);
                const width = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                const previous = index > 0 ? monthlyFinance[index - 1].revenue : 0;
                const change = previous > 0 ? ((month.revenue - previous) / previous) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>
                        {index === 0 ? "Starting point" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prior month`}
                      </div>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: colours.bg }}>
                      <div style={{ width: `${Math.max(width, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} />
                    </div>
                    <div style={{ fontSize: 13, color: colours.text }}>{currency(month.revenue)} paid revenue</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices to see revenue reliability insights.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash efficiency"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less tax reserve", value: -totals.estimatedTax },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: "Safe to spend", value: totals.safeToSpend },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <SectionCard title="Client risk" right={<div style={{ fontSize: 12, color: colours.muted }}>Concentration view</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Top client share</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{financialInsights.topClientShare.toFixed(1)}%</div>
              </div>
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Top 3 clients</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{financialInsights.topThreeClientShare.toFixed(1)}%</div>
              </div>
            </div>
            <TrendBarsCard title="Top clients" subtitle="Highest paid revenue contributors" data={clientRevenueRows.slice(0, 4)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid client revenue yet." />
          </div>
        </SectionCard>

        <SectionCard title="Expense behaviour" right={<div style={{ fontSize: 12, color: colours.muted }}>Largest categories and recent change</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Latest expense move</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{`${financialInsights.expenseChangePct >= 0 ? "+" : ""}${financialInsights.expenseChangePct.toFixed(1)}%`}</div>
              </div>
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Largest category</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.largestExpenseCategory?.label || "—"}</div>
                <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.largestExpenseCategory?.value || 0)}</div>
              </div>
            </div>
            <TrendBarsCard title="Expense categories" subtitle="Largest recorded categories" data={expenseCategoryRows.slice(0, 5)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Simple alerts" right={<div style={{ fontSize: 12, color: colours.muted }}>Automatic observations</div>}>
        <div style={{ display: "grid", gap: 12 }}>
          {financialInsights.alerts.map((alert, index) => (
            <div key={index} style={{ ...cardStyle, padding: 14, background: colours.bg, borderLeft: `4px solid ${index === 0 && alert.includes("No immediate") ? colours.teal : colours.purple}` }}>
              <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6 }}>{alert}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
    );

    const renderClients = () => {
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
    };
    const renderInvoices = () => {
    const invLines = computeLineItemTotals(invoiceForm.lineItems || [], invoiceForm.clientId);
    const previewSubtotal = invLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const previewGst = invLines.reduce((s, l) => s + l.rowGst, 0);
    const previewTotal = previewSubtotal + previewGst;
    const invoiceClient = getClientById(invoiceForm.clientId);
    const invoiceCurrencyCode = getClientCurrencyCode(invoiceClient);
    const invoiceMoney = (value) => formatCurrencyByCode(value, invoiceCurrencyCode);
    const invoiceAdjustments = calculateAdjustmentValues({ subtotal: previewSubtotal, total: previewTotal, client: invoiceClient, profile });
    const invoiceGstStatus = clientIsGstExempt(invoiceForm.clientId) ? "GST not applicable" : previewGst > 0 ? "GST applies" : "GST free";

    const totalInvoiced = invoices.reduce((s, inv) => s + safeNumber(inv.total), 0);
    const totalPaid = invoices.filter((inv) => inv.status === "Paid").reduce((s, inv) => s + safeNumber(inv.total), 0);
    const totalOutstanding = invoices.filter((inv) => inv.status !== "Paid").reduce((s, inv) => s + safeNumber(inv.total), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date());
    const draftCount = invoices.filter((inv) => inv.status === "Draft").length;
    const recentMonths = (() => {
      const bucket = {};
      invoices.forEach((inv) => {
        const key = String(inv.invoiceDate || "").slice(0, 7);
        if (!key) return;
        bucket[key] = (bucket[key] || 0) + safeNumber(inv.total);
      });
      return Object.entries(bucket).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ label: k.slice(5), value: v }));
    })();
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero title="Invoices" subtitle="Create, send and track all your invoices. Live totals update as you add records." highlight={currency(totalPaid)}>
          <InsightChip label="Outstanding" value={currency(totalOutstanding)} />
          <InsightChip label="Overdue" value={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"}`} />
          <InsightChip label="Draft" value={`${draftCount}`} />
        </DashboardHero>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricCard title="Total invoiced" value={currency(totalInvoiced)} subtitle="All invoices in the portal." accent={colours.navy} />
          <MetricCard title="Total paid" value={currency(totalPaid)} subtitle="Invoices marked as paid." accent={colours.teal} />
          <MetricCard title="Outstanding" value={currency(totalOutstanding)} subtitle="Unpaid invoices." accent={colours.purple} />
          <MetricCard title="Overdue" value={String(overdueInvoices.length)} subtitle="Past due date, still unpaid." accent={colours.navy} />
          <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Invoice totals by month</div>
            <MiniBarChart data={recentMonths} height={90} accent={colours.teal} />
          </div>
        </div>
        <SectionCard title="Create Invoice">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Client", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = invoiceWizardStep === step;
              const done = invoiceWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setInvoiceWizardStep(step)}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13,
                      background: done ? colours.teal : active ? colours.purple : colours.border,
                      color: done || active ? "#fff" : colours.muted, transition: "all 0.2s" }}>
                      {done ? "✓" : step}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? colours.purple : done ? colours.teal : colours.muted, whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 2, background: done ? colours.teal : colours.border, margin: "0 6px", marginBottom: 18, transition: "background 0.2s" }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── Step 1: Client ── */}
          {invoiceWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Search or Select Client</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={invClientSearch}
                  onChange={(e) => { setInvClientSearch(e.target.value); if (!e.target.value) setInvoiceForm((p) => ({ ...p, clientId: "" })); }}
                  placeholder="Type client name..." />
                {invClientSearch && (
                  <div style={{ border: `1px solid ${colours.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                    {clients.filter((c) => c.name.toLowerCase().includes(invClientSearch.toLowerCase()) || (c.businessName || "").toLowerCase().includes(invClientSearch.toLowerCase()))
                      .map((c) => (
                        <div key={c.id} onClick={() => { setInvoiceForm((p) => ({ ...p, clientId: String(c.id), currencyCode: getClientCurrencyCode(c) })); setInvClientSearch(c.name); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: `1px solid ${colours.border}`, background: String(invoiceForm.clientId) === String(c.id) ? colours.lightPurple : "#fff" }}>
                          <strong>{c.name}</strong>{c.businessName ? <span style={{ color: colours.muted }}> — {c.businessName}</span> : ""}
                        </div>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(invClientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: colours.muted }}>No match — add a new client below</div>
                    )}
                  </div>
                )}
                {!invClientSearch && (
                  <select style={{ ...inputStyle, marginTop: 8 }} value={invoiceForm.clientId} onChange={(e) => {
                    const sel = getClientById(e.target.value);
                    setInvoiceForm((p) => ({ ...p, clientId: e.target.value, currencyCode: getClientCurrencyCode(sel) }));
                    setInvClientSearch(sel?.name || "");
                  }}>
                    <option value="">— or pick from list —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
                  </select>
                )}
              </div>
              {invoiceForm.clientId && (() => {
                const c = getClientById(invoiceForm.clientId);
                return c ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Client Details</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colours.text }}>{c.name}</div>
                      {c.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.businessName}</div>}
                      {c.abn && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {c.abn}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Contact</div>
                      {c.email && <div style={{ fontSize: 13, color: colours.text, marginTop: 2 }}>✉ {c.email}</div>}
                      {c.phone && <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>📞 {c.phone}</div>}
                      {c.address && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.address}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Billing</div>
                      <div style={{ fontSize: 13, color: colours.text }}>Currency: {c.defaultCurrency || "AUD $"}</div>
                      <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>GST: {clientIsGstExempt(c.id) ? "Exempt" : "Applicable"}</div>
                      {c.workType && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.workType}</div>}
                    </div>
                  </div>
                ) : null;
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setClientModalForm({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" }); setEditingClientId(null); setShowClientModal(true); }}>
                    + New Client
                  </button>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setImportType("clients"); setImportRows([]); setImportError(""); setShowImportModal(true); }}>
                    ⬆ Import
                  </button>
                </div>
                <button style={{ ...buttonPrimary, opacity: invoiceForm.clientId ? 1 : 0.4 }}
                  disabled={!invoiceForm.clientId}
                  onClick={() => setInvoiceWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Details ── */}
          {invoiceWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Invoice Date</label>
                  <input type="date" style={inputStyle} value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" style={inputStyle} value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Invoice Number</label>
                  <input style={inputStyle} value={invoiceForm.invoiceNumber || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
                <div>
                  <label style={labelStyle}>Recurring</label>
                  <select style={inputStyle} value={invoiceForm.recurs || "Never"} onChange={(e) => setInvoiceForm({ ...invoiceForm, recurs: e.target.value })}>
                    {["Never", "Weekly", "Fortnightly", "Monthly", "Quarterly", "Annually"].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {invoiceForm.recurs && invoiceForm.recurs !== "Never" && (
                    <div style={{ fontSize: 12, color: colours.purple, marginTop: 5, fontWeight: 600 }}>🔁 New draft created {invoiceForm.recurs.toLowerCase()} on login</div>
                  )}
                </div>
                {invoiceClient?.hasPurchaseOrder && (
                  <div>
                    <label style={labelStyle}>Purchase Order / Reference</label>
                    <input style={inputStyle} value={invoiceForm.purchaseOrderReference || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseOrderReference: e.target.value })} />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Comments (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={invoiceForm.comments || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, comments: e.target.value })} placeholder="Any notes to appear on the invoice..." />
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={invoiceForm.hidePhoneNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, hidePhoneNumber: e.target.checked })} />
                  Hide my phone number on this invoice
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={invoiceForm.includesUntaxedPortion} onChange={(e) => setInvoiceForm({ ...invoiceForm, includesUntaxedPortion: e.target.checked })} />
                  Includes untaxed portion
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setInvoiceWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Line Items ── */}
          {invoiceWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              {/* Service quick-add */}
              {services.length > 0 && (
                <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colours.purple, flexShrink: 0 }}>📋 Add from Services:</div>
                  <select defaultValue="" style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    onChange={(e) => {
                      const svc = services.find((s) => String(s.id) === e.target.value);
                      if (!svc) return;
                      const exempt = clientIsGstExempt(invoiceForm.clientId);
                      const newItem = {
                        id: Date.now() + Math.random(),
                        description: svc.name + (svc.description ? " — " + svc.description : ""),
                        quantity: 1,
                        unitPrice: String(svc.price ?? ""),
                        gstType: exempt ? "GST Free" : (svc.gstType || "GST on Income (10%)"),
                      };
                      setInvoiceForm((prev) => ({
                        ...prev,
                        lineItems: [...(prev.lineItems || []).filter((l) => l.description || l.unitPrice), newItem],
                      }));
                      e.target.value = "";
                    }}>
                    <option value="">— pick a service to add —</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>{svc.name}{svc.price ? " — " + currency(svc.price) : ""}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: colours.muted, flexBasis: "100%" }}>Pick as many as you need — descriptions and prices are editable without affecting saved services</div>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: colours.bg }}>
                      {["Description", "Qty", "Unit Price (ex GST)", "GST Type", "GST", "Total", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceForm.lineItems || []).map((item, idx) => {
                      const qty = Math.max(1, safeNumber(item.quantity || 1));
                      const unit = safeNumber(item.unitPrice);
                      const rowSub = unit * qty;
                      const exempt = clientIsGstExempt(invoiceForm.clientId);
                      const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                      const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 200 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 70 }}>
                            <input type="number" min="1" style={{ ...inputStyle, fontSize: 13 }} value={item.quantity}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))} />
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.unitPrice}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, unitPrice: e.target.value } : l) }))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13, background: exempt ? "#F8FAFC" : colours.white }} disabled={exempt} value={effectiveGst}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, gstType: e.target.value } : l) }))}>
                              {GST_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 90, fontSize: 13, color: colours.muted, textAlign: "right" }}>{invoiceMoney(rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 110, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{invoiceMoney(rowSub + rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {(invoiceForm.lineItems || []).length > 1 && (
                              <button onClick={() => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: colours.muted, fontSize: 18, lineHeight: 1 }}>×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setInvoiceForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), blankLineItem()] }))}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{(invoiceForm.lineItems || []).length} line{(invoiceForm.lineItems || []).length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setInvoiceWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Save ── */}
          {invoiceWizardStep === 4 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>From</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{profile.businessName}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {profile.abn || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{profile.email}</div>
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>To</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{invoiceClient?.name || "-"}</div>
                  {invoiceClient?.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{invoiceClient.businessName}</div>}
                  {invoiceClient?.email && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{invoiceClient.email}</div>}
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                  <div style={{ fontSize: 13, color: colours.text }}>Invoice: {invoiceForm.invoiceDate || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Due: {invoiceForm.dueDate || "-"}</div>
                  {invoiceForm.purchaseOrderReference && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>PO: {invoiceForm.purchaseOrderReference}</div>}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                {(invoiceForm.lineItems || []).filter(l => l.description || l.unitPrice).map((item, idx) => {
                  const qty = Math.max(1, safeNumber(item.quantity || 1));
                  const unit = safeNumber(item.unitPrice);
                  const rowSub = unit * qty;
                  const exempt = clientIsGstExempt(invoiceForm.clientId);
                  const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                  const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        <span style={{ color: colours.muted, marginLeft: 10 }}>× {qty} @ {invoiceMoney(unit)}</span>
                      </div>
                      <strong>{invoiceMoney(rowSub + rowGst)}</strong>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>Subtotal (ex GST)</span><span>{invoiceMoney(previewSubtotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST</span><span>{invoiceMoney(previewGst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.teal, marginTop: 6 }}><span>Amount Due</span><span>{invoiceMoney(previewTotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: colours.purple }}><span>Net Expected</span><span>{invoiceMoney(invoiceAdjustments.netExpected)}</span></div>
                </div>
              </div>

              {invoiceForm.comments && (
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 6 }}>Comments</div>
                  <div style={{ fontSize: 14, color: colours.text }}>{invoiceForm.comments}</div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(3)}>← Back</button>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={openInvoicePreview}>Preview PDF</button>
                  <button style={{ ...buttonSecondary, opacity: savingInvoice ? 0.6 : 1 }} disabled={savingInvoice} onClick={async () => { setInvoiceForm((prev) => ({ ...prev, status: "Draft" })); const ok = await saveInvoice(); if (ok) setInvoiceWizardStep(1); }}>Save Draft</button>
                  <button style={{ ...buttonPrimary, opacity: savingInvoice ? 0.6 : 1 }} disabled={savingInvoice} onClick={async () => { const ok = await saveInvoice(); if (ok) setInvoiceWizardStep(1); }}>{savingInvoice ? "Saving..." : "Save Invoice ✓"}</button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Invoice List">
          <DataTable
            emptyState={{ icon: "🧾", title: "No invoices yet", message: "Create your first invoice using the form above. Invoices can be emailed as a PDF with a Stripe payment link." }}
            columns={[
              { key: "invoiceNumber", label: "Invoice", render: (v, row) => <span>{v}{row.recurs && row.recurs !== "Never" ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: colours.purple, background: colours.lightPurple, padding: "2px 7px", borderRadius: 6 }}>🔁 {row.recurs}</span> : null}</span> },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "invoiceDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "dueDate", label: "Due", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status", render: (v, row) => (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: row.type === "credit_note" ? "#F5ECFB" : v === "Paid" ? "#dcfce7" : v === "Draft" ? "#f1f5f9" : "#fef9c3",
                  color: row.type === "credit_note" ? colours.purple : v === "Paid" ? "#16a34a" : v === "Draft" ? "#64748b" : "#b45309",
                }}>
                  {row.type === "credit_note" ? "CN" : v === "Paid" ? "✓ PAID" : v || "Draft"}
                </span>
              )},
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={buttonSecondary} onClick={() => openInvoiceEditor(row)}>
                      View / Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => openSavedInvoicePreview(row)}>
                      Preview
                    </button>
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendInvoiceFromPreview(row.id)}
                    >
                      Email
                    </button>

                    {row.status !== "Paid" ? (
                      <>
                        <button style={buttonSecondary} onClick={() => markInvoicePaid(row.id, "Bank Transfer")}>
                          Mark Paid (Bank)
                        </button>
                        <button style={buttonSecondary} onClick={() => markInvoicePaid(row.id, "PayPal")}>
                          Mark Paid (PayPal)
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 700, alignSelf: "center", fontSize: 13 }}>
                        ✓ Paid{row.paidVia ? ` via ${row.paidVia}` : ""}
                      </span>
                    )}

                    <button
                      style={{
                        ...buttonSecondary,
                        ...(row.status === "Paid" ? { opacity: 0.4, cursor: "not-allowed" } : {}),
                      }}
                      onClick={() => row.status !== "Paid" && deleteInvoice(row.id)}
                      title={row.status === "Paid" ? "Cannot delete a paid invoice" : "Delete invoice"}
                      disabled={row.status === "Paid"}
                    >
                      Delete
                    </button>
                    {row.type !== "credit_note" && (
                      <button style={{ ...buttonSecondary, color: colours.purple, borderColor: colours.purple }}
                        onClick={() => { setCreditNoteSource(row); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); setShowARCreditNoteModal(true); }}>
                        Credit Note
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={invoices}
          />
        </SectionCard>

        {invoiceEditorOpen && invoiceEditorForm ? (() => {
          const editorClient = getClientById(invoiceEditorForm.clientId);
          const editorComputedLines = computeLineItemTotals(invoiceEditorForm.lineItems || [], invoiceEditorForm.clientId);
          const editorSubtotal = editorComputedLines.reduce((s, l) => s + l.rowSubtotal, 0);
          const editorGst = editorComputedLines.reduce((s, l) => s + l.rowGst, 0);
          const editorTotal = editorSubtotal + editorGst;
          const editorCurrencyCode = getClientCurrencyCode(editorClient);
          const editorMoney = (value) => formatCurrencyByCode(value, editorCurrencyCode);
          const editorAdjustments = calculateAdjustmentValues({
            subtotal: editorSubtotal,
            total: editorTotal,
            client: editorClient,
            profile,
          });
          const editorGstStatus = clientIsGstExempt(invoiceEditorForm.clientId)
            ? "GST not applicable"
            : editorGst > 0
              ? "GST applies"
              : "GST free";
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
                padding: 18,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 1100,
                  maxHeight: "92vh",
                  overflowY: "auto",
                  background: colours.white,
                  borderRadius: 22,
                  border: `1px solid ${colours.border}`,
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
                  padding: 24,
                  display: "grid",
                  gap: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: colours.text }}>Invoice {invoiceEditorForm.invoiceNumber}</div>
                    <div style={{ fontSize: 14, color: colours.muted, marginTop: 4 }}>
                      View and edit the saved invoice, then save changes back to Supabase.
                    </div>
                  </div>
                  <button style={buttonSecondary} onClick={closeInvoiceEditor}>Close</button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Status</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.text, marginTop: 6 }}>{invoiceEditorForm.status}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Payment reference</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.text, marginTop: 6 }}>{invoiceEditorForm.paymentReference || "Not set"}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Amount due</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.teal, marginTop: 6 }}>{editorMoney(editorTotal)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 20 }}>
                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Invoice Details">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Client</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.clientId}
                            onChange={(e) => {
                              const selectedClient = getClientById(e.target.value);
                              setInvoiceEditorForm((prev) => ({ ...prev,
                                clientId: e.target.value,
                                currencyCode: getClientCurrencyCode(selectedClient),
                                gstType: clientIsGstExempt(e.target.value) ? "GST Free" : prev.gstType,
                                purchaseOrderReference: selectedClient?.hasPurchaseOrder ? prev.purchaseOrderReference : "",
                              }));
                            }}
                          >
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Invoice Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={invoiceEditorForm.invoiceDate}
                            onChange={(e) =>
                              setInvoiceEditorForm((prev) => ({ ...prev,
                                invoiceDate: e.target.value,
                                dueDate: addDays(e.target.value, (safeNumber(profile.paymentTermsDays) || 14)),
                              }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Due Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={invoiceEditorForm.dueDate}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Status</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.status}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, status: e.target.value }))}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Item / Service Name</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.description}
                            onChange={(e) => {
                              const selectedService = services.find((s) => s.name === e.target.value);
                              if (selectedService) {
                                setInvoiceEditorForm((prev) => ({ ...prev,
                                  serviceId: selectedService.id,
                                  description: selectedService.name,
                                  subtotal: String(selectedService.price ?? ""),
                                  gstType: clientIsGstExempt(prev.clientId)
                                    ? "GST Free"
                                    : selectedService.gstType || "GST on Income (10%)",
                                  quantity: 1,
                                }));
                              } else {
                                setInvoiceEditorForm((prev) => ({ ...prev,
                                  serviceId: "",
                                  description: e.target.value,
                                }));
                              }
                            }}
                          >
                            <option value="">Select a service...</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.name}>{service.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quantity</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={invoiceEditorForm.quantity}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, quantity: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Price (ex GST)</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={invoiceEditorForm.subtotal}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, subtotal: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>GST Type</label>
                          <select
                            style={{ ...inputStyle,
                              background: clientIsGstExempt(invoiceEditorForm.clientId) ? "#F8FAFC" : colours.white,
                            }}
                            value={clientIsGstExempt(invoiceEditorForm.clientId) ? "GST Free" : invoiceEditorForm.gstType}
                            disabled={clientIsGstExempt(invoiceEditorForm.clientId)}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, gstType: e.target.value }))}
                          >
                            {GST_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>GST Amount</label>
                          <input type="number" style={{ ...inputStyle, background: "#F8FAFC" }} readOnly value={editorGst.toFixed(2)} />
                        </div>

                        {editorClient?.hasPurchaseOrder ? (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={labelStyle}>Purchase order / reference</label>
                            <input
                              style={inputStyle}
                              value={invoiceEditorForm.purchaseOrderReference}
                              onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, purchaseOrderReference: e.target.value }))}
                            />
                          </div>
                        ) : null}

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Comments</label>
                          <textarea
                            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                            value={invoiceEditorForm.comments}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, comments: e.target.value }))}
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Invoice Summary">
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Subtotal</span><strong>{editorMoney(editorSubtotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST</span><strong>{editorMoney(editorGst)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST status</span><strong>{editorGstStatus}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less fees</span><strong>{editorMoney(editorAdjustments.feeAmount)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less tax withheld</span><strong>{editorMoney(editorAdjustments.taxWithheld)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, paddingTop: 8 }}><span style={{ color: colours.teal, fontWeight: 800 }}>Amount due</span><strong style={{ color: colours.teal }}>{editorMoney(editorTotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}><span style={{ color: colours.purple, fontWeight: 800 }}>Net expected</span><strong style={{ color: colours.purple }}>{editorMoney(editorAdjustments.netExpected)}</strong></div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Invoice Actions">
                      <div style={{ display: "grid", gap: 12 }}>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            openSavedInvoicePreview({ ...invoices.find((invoice) => invoice.id === invoiceEditorForm.id),
                              ...invoiceEditorForm,
                              subtotal: editorSubtotal,
                              gst: editorGst,
                              total: editorTotal,
                              clientId: safeNumber(invoiceEditorForm.clientId),
                            })
                          }
                        >
                          Preview Invoice
                        </button>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            setInvoiceEditorForm((prev) => ({ ...prev,
                              status: prev.status === "Paid" ? "Draft" : "Paid",
                            }))
                          }
                        >
                          {invoiceEditorForm.status === "Paid" ? "Mark as Draft" : "Mark as Paid"}
                        </button>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={invoiceEditorForm.hidePhoneNumber}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, hidePhoneNumber: e.target.checked }))}
                          />
                          Hide my phone number
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={invoiceEditorForm.includesUntaxedPortion}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, includesUntaxedPortion: e.target.checked }))}
                          />
                          Includes untaxed portion
                        </label>
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button style={buttonSecondary} onClick={closeInvoiceEditor}>Cancel</button>
                  <button style={{ ...buttonPrimary, opacity: savingInvoiceEdits ? 0.6 : 1 }} disabled={savingInvoiceEdits} onClick={saveInvoiceEdits}>{savingInvoiceEdits ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );
    };
    const renderQuotes = () => {
    const quoteLines = computeLineItemTotals(quoteForm.lineItems || [], quoteForm.clientId);
    const qSubtotal = quoteLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const qGst = quoteLines.reduce((s, l) => s + l.rowGst, 0);
    const qTotal = qSubtotal + qGst;
    const quoteClient = getClientById(quoteForm.clientId);
    const quoteCurrencyCode = getClientCurrencyCode(quoteClient);
    const quoteMoney = (value) => formatCurrencyByCode(value, quoteCurrencyCode);
    const quoteAdjustments = calculateAdjustmentValues({ subtotal: qSubtotal, total: qTotal, client: quoteClient, profile });
    const quoteGstStatus = clientIsGstExempt(quoteForm.clientId) ? "GST not applicable" : qGst > 0 ? "GST applies" : "GST free";

    const totalQuoted = quotes.reduce((s, q) => s + safeNumber(q.total), 0);
    const acceptedQuotes = quotes.filter((q) => q.status === "Accepted");
    const pendingQuotes = quotes.filter((q) => q.status === "Draft" || q.status === "Sent");
    const expiredQuotes = quotes.filter((q) => q.status === "Expired" || (q.expiryDate && new Date(q.expiryDate) < new Date() && q.status !== "Accepted"));
    const conversionRate = quotes.length > 0 ? (acceptedQuotes.length / quotes.length) * 100 : 0;
    const statusData = [
      { label: "Accepted", value: acceptedQuotes.length },
      { label: "Pending", value: pendingQuotes.length },
      { label: "Expired", value: expiredQuotes.length },
    ];
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero title="Quotes" subtitle="Create and manage quotes for clients. Track acceptance rates and convert to invoices." highlight={`${conversionRate.toFixed(0)}% accepted`}>
          <InsightChip label="Total quoted" value={currency(totalQuoted)} />
          <InsightChip label="Accepted" value={String(acceptedQuotes.length)} />
          <InsightChip label="Pending" value={String(pendingQuotes.length)} />
        </DashboardHero>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricCard title="Total quoted" value={currency(totalQuoted)} subtitle="Value of all quotes in the portal." accent={colours.navy} />
          <MetricCard title="Accepted value" value={currency(acceptedQuotes.reduce((s, q) => s + safeNumber(q.total), 0))} subtitle="Value of accepted quotes." accent={colours.teal} />
          <MetricCard title="Conversion rate" value={`${conversionRate.toFixed(1)}%`} subtitle="Quotes accepted vs total sent." accent={colours.purple} />
          <MetricCard title="Expired" value={String(expiredQuotes.length)} subtitle="Quotes past expiry date." accent={colours.navy} />
          <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Quote status breakdown</div>
            <MiniBarChart data={statusData} height={90} accent={colours.purple} />
          </div>
        </div>
        <SectionCard title="Create Quote">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Client", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = quoteWizardStep === step;
              const done = quoteWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setQuoteWizardStep(step)}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13,
                      background: done ? colours.teal : active ? colours.purple : colours.border,
                      color: done || active ? "#fff" : colours.muted, transition: "all 0.2s" }}>
                      {done ? "✓" : step}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? colours.purple : done ? colours.teal : colours.muted, whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 2, background: done ? colours.teal : colours.border, margin: "0 6px", marginBottom: 18, transition: "background 0.2s" }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── Step 1: Client ── */}
          {quoteWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Search or Select Client</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={quoteClientSearch}
                  onChange={(e) => { setQuoteClientSearch(e.target.value); if (!e.target.value) setQuoteForm((p) => ({ ...p, clientId: "" })); }}
                  placeholder="Type client name..." />
                {quoteClientSearch && (
                  <div style={{ border: `1px solid ${colours.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                    {clients.filter((c) => c.name.toLowerCase().includes(quoteClientSearch.toLowerCase()) || (c.businessName || "").toLowerCase().includes(quoteClientSearch.toLowerCase()))
                      .map((c) => (
                        <div key={c.id} onClick={() => { setQuoteForm((p) => ({ ...p, clientId: String(c.id), currencyCode: getClientCurrencyCode(c) })); setQuoteClientSearch(c.name); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: `1px solid ${colours.border}`, background: String(quoteForm.clientId) === String(c.id) ? colours.lightPurple : "#fff" }}>
                          <strong>{c.name}</strong>{c.businessName ? <span style={{ color: colours.muted }}> — {c.businessName}</span> : ""}
                        </div>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(quoteClientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: colours.muted }}>No match — add a new client below</div>
                    )}
                  </div>
                )}
                {!quoteClientSearch && (
                  <select style={{ ...inputStyle, marginTop: 8 }} value={quoteForm.clientId} onChange={(e) => {
                    const sel = getClientById(e.target.value);
                    setQuoteForm((p) => ({ ...p, clientId: e.target.value, currencyCode: getClientCurrencyCode(sel) }));
                    setQuoteClientSearch(sel?.name || "");
                  }}>
                    <option value="">— or pick from list —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
                  </select>
                )}
              </div>
              {quoteForm.clientId && (() => {
                const c = getClientById(quoteForm.clientId);
                return c ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Client Details</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colours.text }}>{c.name}</div>
                      {c.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.businessName}</div>}
                      {c.abn && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {c.abn}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Contact</div>
                      {c.email && <div style={{ fontSize: 13, color: colours.text, marginTop: 2 }}>✉ {c.email}</div>}
                      {c.phone && <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>📞 {c.phone}</div>}
                      {c.address && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.address}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Billing</div>
                      <div style={{ fontSize: 13, color: colours.text }}>Currency: {c.defaultCurrency || "AUD $"}</div>
                      <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>GST: {clientIsGstExempt(c.id) ? "Exempt" : "Applicable"}</div>
                      {c.workType && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.workType}</div>}
                    </div>
                  </div>
                ) : null;
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setClientModalForm({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" }); setEditingClientId(null); setShowClientModal(true); }}>
                    + New Client
                  </button>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setImportType("clients"); setImportRows([]); setImportError(""); setShowImportModal(true); }}>
                    ⬆ Import
                  </button>
                </div>
                <button style={{ ...buttonPrimary, opacity: quoteForm.clientId ? 1 : 0.4 }}
                  disabled={!quoteForm.clientId}
                  onClick={() => setQuoteWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Details ── */}
          {quoteWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Quote Date</label>
                  <input type="date" style={inputStyle} value={quoteForm.quoteDate} onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input type="date" style={inputStyle} value={quoteForm.expiryDate} onChange={(e) => setQuoteForm({ ...quoteForm, expiryDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Quote Number</label>
                  <input style={inputStyle} value={quoteForm.quoteNumber || ""} onChange={(e) => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Comments (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={quoteForm.comments || ""} onChange={(e) => setQuoteForm({ ...quoteForm, comments: e.target.value })} placeholder="Any notes to appear on the quote..." />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={quoteForm.hidePhoneNumber} onChange={(e) => setQuoteForm({ ...quoteForm, hidePhoneNumber: e.target.checked })} />
                  Hide my phone number on this quote
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setQuoteWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Line Items ── */}
          {quoteWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              {services.length > 0 && (
                <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colours.purple, flexShrink: 0 }}>📋 Add from Services:</div>
                  <select defaultValue="" style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    onChange={(e) => {
                      const svc = services.find((s) => String(s.id) === e.target.value);
                      if (!svc) return;
                      const exempt = clientIsGstExempt(quoteForm.clientId);
                      const newItem = {
                        id: Date.now() + Math.random(),
                        description: svc.name + (svc.description ? " — " + svc.description : ""),
                        quantity: 1,
                        unitPrice: String(svc.price ?? ""),
                        gstType: exempt ? "GST Free" : (svc.gstType || "GST on Income (10%)"),
                      };
                      setQuoteForm((prev) => ({
                        ...prev,
                        lineItems: [...(prev.lineItems || []).filter((l) => l.description || l.unitPrice), newItem],
                      }));
                      e.target.value = "";
                    }}>
                    <option value="">— pick a service to add —</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>{svc.name}{svc.price ? " — " + currency(svc.price) : ""}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: colours.muted, flexBasis: "100%" }}>Pick as many as you need — descriptions and prices are editable without affecting saved services</div>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: colours.bg }}>
                      {["Description", "Qty", "Unit Price (ex GST)", "GST Type", "GST", "Total", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(quoteForm.lineItems || []).map((item, idx) => {
                      const qty = Math.max(1, safeNumber(item.quantity || 1));
                      const unit = safeNumber(item.unitPrice);
                      const rowSub = unit * qty;
                      const exempt = clientIsGstExempt(quoteForm.clientId);
                      const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                      const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 200 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 70 }}>
                            <input type="number" min="1" style={{ ...inputStyle, fontSize: 13 }} value={item.quantity}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))} />
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.unitPrice}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, unitPrice: e.target.value } : l) }))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13, background: exempt ? "#F8FAFC" : colours.white }} disabled={exempt} value={effectiveGst}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, gstType: e.target.value } : l) }))}>
                              {GST_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 90, fontSize: 13, color: colours.muted, textAlign: "right" }}>{quoteMoney(rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 110, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{quoteMoney(rowSub + rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {(quoteForm.lineItems || []).length > 1 && (
                              <button onClick={() => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: colours.muted, fontSize: 18, lineHeight: 1 }}>×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setQuoteForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), { id: Date.now() + Math.random(), description: "", quantity: 1, unitPrice: "", gstType: "GST on Income (10%)" }] }))}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{(quoteForm.lineItems || []).length} line{(quoteForm.lineItems || []).length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setQuoteWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Save ── */}
          {quoteWizardStep === 4 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>From</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{profile.businessName}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {profile.abn || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{profile.email}</div>
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>To</div>
                  {(() => { const c = getClientById(quoteForm.clientId); return c ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{c.name}</div>
                      {c.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{c.businessName}</div>}
                      {c.email && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{c.email}</div>}
                    </>
                  ) : null; })()}
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                  <div style={{ fontSize: 13, color: colours.text }}>Quote: {quoteForm.quoteDate || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Expires: {quoteForm.expiryDate || "-"}</div>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                {(quoteForm.lineItems || []).filter(l => l.description || l.unitPrice).map((item, idx) => {
                  const qty = Math.max(1, safeNumber(item.quantity || 1));
                  const unit = safeNumber(item.unitPrice);
                  const rowSub = unit * qty;
                  const exempt = clientIsGstExempt(quoteForm.clientId);
                  const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                  const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        <span style={{ color: colours.muted, marginLeft: 10 }}>× {qty} @ {quoteMoney(unit)}</span>
                      </div>
                      <strong>{quoteMoney(rowSub + rowGst)}</strong>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>Subtotal (ex GST)</span><span>{quoteMoney(qSubtotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST</span><span>{quoteMoney(qGst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.teal, marginTop: 6 }}><span>Total Estimate</span><span>{quoteMoney(qTotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: colours.purple }}><span>Net Expected</span><span>{quoteMoney(quoteAdjustments.netExpected)}</span></div>
                </div>
              </div>

              {quoteForm.comments && (
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 6 }}>Comments</div>
                  <div style={{ fontSize: 14, color: colours.text }}>{quoteForm.comments}</div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(3)}>← Back</button>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={openQuotePreview}>Preview PDF</button>
                  <button style={{ ...buttonSecondary, opacity: savingQuote ? 0.6 : 1 }} disabled={savingQuote} onClick={async () => { setQuoteForm((prev) => ({ ...prev, status: "Draft" })); const ok = await saveQuote(); if (ok) setQuoteWizardStep(1); }}>Save Draft</button>
                  <button style={{ ...buttonPrimary, opacity: savingQuote ? 0.6 : 1 }} disabled={savingQuote} onClick={async () => { const ok = await saveQuote(); if (ok) setQuoteWizardStep(1); }}>{savingQuote ? "Saving..." : "Save Quote ✓"}</button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quote List">
          <DataTable
            emptyState={{ icon: "📋", title: "No quotes yet", message: "Create your first quote using the form above. Quotes can be converted to invoices once accepted." }}
            columns={[
              { key: "quoteNumber", label: "Quote" },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "quoteDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "expiryDate", label: "Expiry", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status", render: (v) => (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: v === "Accepted" ? "#dcfce7" : v === "Declined" ? "#fee2e2" : v === "Expired" ? "#f1f5f9" : v === "Sent" ? "#fef9c3" : "#f1f5f9",
                  color: v === "Accepted" ? "#16a34a" : v === "Declined" ? "#dc2626" : v === "Expired" ? "#64748b" : v === "Sent" ? "#b45309" : "#64748b",
                }}>
                  {v || "Draft"}
                </span>
              )},
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={buttonSecondary} onClick={() => openQuoteEditor(row)}>
                      View / Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => openSavedQuotePreview(row)}>
                      Preview
                    </button>
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendQuoteFromPreview(row.id)}
                    >
                      Email
                    </button>
                    {row.status !== "Declined" && row.status !== "Expired" && (
                      <button
                        style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                        onClick={() => convertQuoteToInvoice(row)}
                        title="Mark as Accepted and create a Draft invoice"
                      >
                        → Invoice
                      </button>
                    )}
                    <button style={buttonSecondary} onClick={() => deleteQuote(row.id)}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={quotes}
          />
        </SectionCard>
        {quoteEditorOpen && quoteEditorForm ? (() => {
          const editorClient = getClientById(quoteEditorForm.clientId);
          const editorComputedLines = computeLineItemTotals(quoteEditorForm.lineItems || [], quoteEditorForm.clientId);
          const editorSubtotal = editorComputedLines.reduce((s, l) => s + l.rowSubtotal, 0);
          const editorGst = editorComputedLines.reduce((s, l) => s + l.rowGst, 0);
          const editorTotal = editorSubtotal + editorGst;
          const editorCurrencyCode = getClientCurrencyCode(editorClient);
          const editorMoney = (value) => formatCurrencyByCode(value, editorCurrencyCode);
          const editorAdjustments = calculateAdjustmentValues({
            subtotal: editorSubtotal,
            total: editorTotal,
            client: editorClient,
            profile,
          });
          const editorGstStatus = clientIsGstExempt(quoteEditorForm.clientId)
            ? "GST not applicable"
            : editorGst > 0
              ? "GST applies"
              : "GST free";
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                zIndex: 3000,
                overflowY: "auto",
                padding: 24,
              }}
            >
              <div
                style={{
                  maxWidth: 1180,
                  margin: "0 auto",
                  background: colours.bg,
                  borderRadius: 24,
                  padding: 24,
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
                  display: "grid",
                  gap: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700, letterSpacing: 0.4 }}>
                      QUOTE
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: colours.text }}>
                      {quoteEditorForm.quoteNumber || "Quote"}
                    </div>
                  </div>
                  <button style={buttonSecondary} onClick={closeQuoteEditor}>
                    Close
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)", gap: 20 }}>
                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Quote Details">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Client</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.clientId}
                            onChange={(e) => {
                              const selectedClient = getClientById(e.target.value);
                              setQuoteEditorForm((prev) => ({ ...prev,
                                clientId: e.target.value,
                                currencyCode: getClientCurrencyCode(selectedClient),
                                gstType: clientIsGstExempt(e.target.value) ? "GST Free" : prev.gstType,
                              }));
                            }}
                          >
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quote Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={quoteEditorForm.quoteDate}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, quoteDate: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Expiry Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={quoteEditorForm.expiryDate}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Status</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.status}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, status: e.target.value }))
                            }
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Declined">Declined</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Item / Service name</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.description}
                            onChange={(e) => {
                              const selectedService = services.find((s) => s.name === e.target.value);
                              if (selectedService) {
                                setQuoteEditorForm((prev) => ({ ...prev,
                                  serviceId: selectedService.id,
                                  description: selectedService.name,
                                  subtotal: String(selectedService.price ?? ""),
                                  gstType: clientIsGstExempt(prev.clientId) ? "GST Free" : selectedService.gstType || "GST on Income (10%)",
                                  quantity: 1,
                                }));
                              } else {
                                setQuoteEditorForm((prev) => ({ ...prev,
                                  serviceId: "",
                                  description: e.target.value,
                                }));
                              }
                            }}
                          >
                            <option value="">Select a service...</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.name}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quantity</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={quoteEditorForm.quantity}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, quantity: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Price (ex GST)</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={quoteEditorForm.subtotal}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, subtotal: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>GST Type</label>
                          <select
                            style={{ ...inputStyle,
                              background: clientIsGstExempt(quoteEditorForm.clientId) ? "#F8FAFC" : colours.white,
                            }}
                            value={clientIsGstExempt(quoteEditorForm.clientId) ? "GST Free" : quoteEditorForm.gstType || "GST on Income (10%)"}
                            disabled={clientIsGstExempt(quoteEditorForm.clientId)}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, gstType: e.target.value }))
                            }
                          >
                            {GST_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>GST Amount</label>
                          <input
                            type="number"
                            style={{ ...inputStyle, background: "#F8FAFC" }}
                            readOnly
                            value={editorGst.toFixed(2)}
                          />
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Comments</label>
                          <textarea
                            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                            value={quoteEditorForm.comments}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, comments: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Quote Summary">
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Subtotal</span><strong>{editorMoney(editorSubtotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST</span><strong>{editorMoney(editorGst)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST status</span><strong>{editorGstStatus}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less fees</span><strong>{editorMoney(editorAdjustments.feeAmount)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less tax withheld</span><strong>{editorMoney(editorAdjustments.taxWithheld)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, paddingTop: 8 }}><span style={{ color: colours.teal, fontWeight: 800 }}>Total estimate</span><strong style={{ color: colours.teal }}>{editorMoney(editorTotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}><span style={{ color: colours.purple, fontWeight: 800 }}>Net expected</span><strong style={{ color: colours.purple }}>{editorMoney(editorAdjustments.netExpected)}</strong></div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Quote Actions">
                      <div style={{ display: "grid", gap: 12 }}>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            openSavedQuotePreview({ ...(quotes.find((quote) => quote.id === quoteEditorForm.id) || {}),
                              ...quoteEditorForm,
                              subtotal: editorSubtotal,
                              gst: editorGst,
                              total: editorTotal,
                              clientId: safeNumber(quoteEditorForm.clientId),
                            })
                          }
                        >
                          Preview Quote
                        </button>
                        {quoteEditorForm.status !== "Declined" && quoteEditorForm.status !== "Expired" && (
                          <button
                            style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal, fontWeight: 700 }}
                            onClick={() => {
                              const fullQuote = {
                                ...(quotes.find((q) => q.id === quoteEditorForm.id) || {}),
                                ...quoteEditorForm,
                                subtotal: editorSubtotal,
                                gst: editorGst,
                                total: editorTotal,
                                clientId: safeNumber(quoteEditorForm.clientId),
                              };
                              convertQuoteToInvoice(fullQuote);
                            }}
                          >
                            Convert to Invoice →
                          </button>
                        )}
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={quoteEditorForm.hidePhoneNumber}
                            onChange={(e) => setQuoteEditorForm((prev) => ({ ...prev, hidePhoneNumber: e.target.checked }))}
                          />
                          Hide my phone number
                        </label>
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button style={buttonSecondary} onClick={closeQuoteEditor}>Cancel</button>
                  <button style={{ ...buttonPrimary, opacity: savingQuoteEdits ? 0.6 : 1 }} disabled={savingQuoteEdits} onClick={saveQuoteEdits}>{savingQuoteEdits ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );
    };

    const renderServices = () => {
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
    };


    const renderBillsPayables = () => {
    const todayKey = todayLocal();
    const sevenDayKey = addDays(todayKey, 7);

    const billRows = expenses.map((item) => {
      const dueDate = item.dueDate || item.date || "";
      const isPaid = Boolean(item.isPaid);
      let status = "Unpaid";
      if (isPaid) status = "Paid";
      else if (dueDate && dueDate < todayKey) status = "Overdue";
      else if (dueDate && dueDate <= sevenDayKey) status = "Due soon";
      return {
        ...item,
        dueDate,
        status,
      };
    });

    const unpaidBills = billRows.filter((item) => !item.isPaid);
    const overdueBills = billRows.filter((item) => item.status === "Overdue");
    const dueSoonBills = billRows.filter((item) => item.status === "Due soon");
    const totalPayable = unpaidBills.reduce((sum, item) => sum + safeNumber(item.amount), 0);

    const supplierTotalsMap = unpaidBills.reduce((acc, item) => {
      const key = item.supplier || "Unknown supplier";
      acc[key] = (acc[key] || 0) + safeNumber(item.amount);
      return acc;
    }, {});
    const topSuppliers = Object.entries(supplierTotalsMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero
          title="Bills and payables"
          subtitle="Track supplier bills, what is due soon, what is overdue, and what is already paid using your existing expense data."
          highlight={currency(totalPayable)}
        >
          <InsightChip label="Due soon" value={`${dueSoonBills.length} bill${dueSoonBills.length === 1 ? "" : "s"}`} />
          <InsightChip label="Overdue" value={`${overdueBills.length} bill${overdueBills.length === 1 ? "" : "s"}`} />
          <InsightChip label="Paid" value={`${billRows.filter((item) => item.isPaid).length} bill${billRows.filter((item) => item.isPaid).length === 1 ? "" : "s"}`} />
        </DashboardHero>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <MetricCard title="Total payable" value={currency(totalPayable)} subtitle="All unpaid supplier bills." accent={colours.purple} />
          <MetricCard title="Due in 7 days" value={currency(dueSoonBills.reduce((sum, item) => sum + safeNumber(item.amount), 0))} subtitle="Bills requiring attention soon." accent={colours.teal} />
          <MetricCard title="Overdue" value={currency(overdueBills.reduce((sum, item) => sum + safeNumber(item.amount), 0))} subtitle="Bills past their due date." accent={colours.navy} />
          <MetricCard title="Bills recorded" value={String(billRows.length)} subtitle="All supplier bills from your expense records." accent={colours.purple} />
        </div>

        <TrendBarsCard
          title="Top suppliers"
          subtitle="Largest unpaid commitments by supplier"
          data={topSuppliers}
          valueKey="value"
          formatValue={(value) => currency(value)}
          accent={colours.teal}
          emptyText="No unpaid supplier bills yet."
        />

        <SectionCard title="Enter Supplier Bill">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Supplier", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = billWizardStep === step;
              const done = billWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setBillWizardStep(step)}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13,
                      background: done ? colours.teal : active ? colours.purple : colours.border,
                      color: done || active ? "#fff" : colours.muted, transition: "all 0.2s" }}>
                      {done ? "✓" : step}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? colours.purple : done ? colours.teal : colours.muted, whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 2, background: done ? colours.teal : colours.border, margin: "0 6px", marginBottom: 18, transition: "background 0.2s" }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step 1: Supplier */}
          {billWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Supplier Name</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={expenseForm.supplier}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = suppliers.find((s) => s.name.toLowerCase() === val.toLowerCase());
                    setExpenseForm((prev) => ({ ...prev, supplier: val,
                      supplierEmail: match?.email || prev.supplierEmail || "",
                      supplierPhone: match?.phone || prev.supplierPhone || "",
                      supplierAddress: match?.address || prev.supplierAddress || "",
                      supplierAbn: match?.abn || prev.supplierAbn || "",
                    }));
                  }}
                  placeholder="Type or select a supplier..." list="known-suppliers-list" />
                <datalist id="known-suppliers-list">
                  {knownSuppliers.map((s) => <option key={s} value={s} />)}
                </datalist>
                {knownSuppliers.length > 0 && (
                  <div style={{ fontSize: 12, color: colours.muted, marginTop: 6 }}>
                    Recent:{" "}
                    {knownSuppliers.slice(0, 5).map((s, i) => {
                      const match = suppliers.find((sup) => sup.name === s);
                      return (
                        <button key={s} onClick={() => setExpenseForm((prev) => ({ ...prev, supplier: s,
                          supplierEmail: match?.email || "",
                          supplierPhone: match?.phone || "",
                          supplierAddress: match?.address || "",
                          supplierAbn: match?.abn || "",
                        }))}
                          style={{ background: expenseForm.supplier === s ? colours.purple : colours.lightPurple, color: expenseForm.supplier === s ? "#fff" : colours.purple, border: "none", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer", marginLeft: i > 0 ? 6 : 4, fontWeight: 600 }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
                {expenseForm.supplier && suppliers.find((s) => s.name.toLowerCase() === expenseForm.supplier.toLowerCase()) && (() => {
                  const sup = suppliers.find((s) => s.name.toLowerCase() === expenseForm.supplier.toLowerCase());
                  return (
                    <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, marginTop: 12, display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 4 }}>Supplier Details</div>
                      {sup.contactPerson && <div style={{ fontSize: 13, color: colours.text }}>👤 {sup.contactPerson}</div>}
                      {sup.email && <div style={{ fontSize: 13, color: colours.text }}>✉ {sup.email}</div>}
                      {sup.phone && <div style={{ fontSize: 13, color: colours.text }}>📞 {sup.phone}</div>}
                      {sup.address && <div style={{ fontSize: 13, color: colours.muted }}>{sup.address}</div>}
                      {sup.abn && <div style={{ fontSize: 13, color: colours.muted }}>ABN: {sup.abn}</div>}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setSupplierForm({ name: expenseForm.supplier, email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" }); setEditingSupplierId(null); setShowSupplierModal(true); }}>
                  + Save supplier details
                </button>
                <button style={{ ...buttonPrimary, opacity: expenseForm.supplier.trim() ? 1 : 0.4 }}
                  disabled={!expenseForm.supplier.trim()}
                  onClick={() => setBillWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {billWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 4 }}>Supplier</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: colours.text }}>{expenseForm.supplier}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Bill Date</label>
                  <input type="date" style={inputStyle} value={expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value, dueDate: addDaysEOM(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date (EOM + 30 days)</label>
                  <input type="date" style={inputStyle} value={expenseForm.dueDate || expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setBillWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setBillWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* Step 3: Line Items */}
          {billWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: colours.bg }}>
                      {["Description", "Category", "Amount (incl GST)", "GST Incl?", "GST Credit", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billLineItems.map((item, idx) => {
                      const amt = safeNumber(item.amount);
                      const gstCredit = item.gstIncl === "yes" ? amt / 11 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 180 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13 }} value={item.category}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, category: e.target.value } : l))}>
                              <option value="">Select...</option>
                              {expenseCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.amount}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 90 }}>
                            <select style={{ ...inputStyle, fontSize: 13 }} value={item.gstIncl}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, gstIncl: e.target.value } : l))}>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 100, fontSize: 13, color: colours.muted, textAlign: "right" }}>{currency(gstCredit)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {billLineItems.length > 1 && (
                              <button onClick={() => setBillLineItems((prev) => prev.filter((_, i) => i !== idx))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: colours.muted, fontSize: 18, lineHeight: 1 }}>×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setBillLineItems((prev) => [...prev, blankBillLine()])}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{billLineItems.length} line{billLineItems.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setBillWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setBillWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Save */}
          {billWizardStep === 4 && (() => {
            const totalAmt = billLineItems.reduce((s, l) => s + safeNumber(l.amount), 0);
            const totalGst = billLineItems.reduce((s, l) => s + (l.gstIncl === "yes" ? safeNumber(l.amount) / 11 : 0), 0);
            return (
              <div style={{ display: "grid", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Supplier</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: colours.text }}>{expenseForm.supplier}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                    <div style={{ fontSize: 13, color: colours.text }}>Bill date: {formatDateAU(expenseForm.date)}</div>
                    <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Due: {formatDateAU(expenseForm.dueDate)}</div>
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                  {billLineItems.filter(l => l.description || l.amount).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        {item.category && <span style={{ color: colours.muted, marginLeft: 8, fontSize: 12 }}>{item.category}</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{currency(safeNumber(item.amount))}</strong>
                        {item.gstIncl === "yes" && <div style={{ fontSize: 11, color: colours.teal }}>GST: {currency(safeNumber(item.amount) / 11)}</div>}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST credit (claimable)</span><span style={{ color: colours.teal, fontWeight: 700 }}>{currency(totalGst)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.purple, marginTop: 6 }}><span>Total Bill</span><span>{currency(totalAmt)}</span></div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  <button style={buttonSecondary} onClick={() => setBillWizardStep(3)}>← Back</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={buttonSecondary} onClick={() => {
                      setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
                      setBillLineItems([blankBillLine()]);
                      setBillWizardStep(1);
                    }}>Clear</button>
                    <button style={buttonPrimary} disabled={savingBill} onClick={async () => {
                      if (!expenseForm.supplier) { toast.warning("Supplier name is required"); return; }
                      if (totalAmt <= 0) { toast.warning("Add at least one line with an amount"); return; }
                      setSavingBill(true);
                      const primaryCategory = billLineItems.find((l) => l.category)?.category || "Other";
                      const combinedDesc = billLineItems.map((l) => l.description).filter(Boolean).join("; ");
                      const payload = {
                        ...expenseForm,
                        category: primaryCategory,
                        description: combinedDesc,
                        amount: totalAmt,
                        gst: totalGst,
                        billLineItems,
                        expenseType: "Bill / Payable",
                      };
                      try {
                        const saved = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);
                        setExpenses((prev) => [...prev, saved]);
                        toast.success("Bill saved!");
                        setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
                        setBillLineItems([blankBillLine()]);
                        setBillWizardStep(1);
                      } catch (err) {
                        toast.error(err.message || "Save failed");
                      } finally {
                        setSavingBill(false);
                      }
                    }}>{savingBill ? "Saving..." : "Save Bill ✓"}</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </SectionCard>


        <SectionCard title="Supplier Directory" right={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonSecondary} onClick={() => { setImportType("suppliers"); setImportRows([]); setImportError(""); setShowImportModal(true); }}>⬆ Import</button>
            <button style={buttonPrimary} onClick={() => { setSupplierForm({ name: "", email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" }); setEditingSupplierId(null); setShowSupplierModal(true); }}>+ Add Supplier</button>
          </div>
        }>
          <DataTable
            emptyState={{ icon: "🏢", title: "No suppliers yet", message: "Save supplier details here so they auto-fill when you enter bills. Name, email, phone, address and ABN all stored." }}
            columns={[
              { key: "name", label: "Supplier" },
              { key: "contactPerson", label: "Contact" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "abn", label: "ABN" },
              { key: "actions", label: "", render: (_, row) => (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={buttonSecondary} onClick={() => { setSupplierForm({ name: row.name || "", email: row.email || "", phone: row.phone || "", address: row.address || "", abn: row.abn || "", contactPerson: row.contactPerson || "", notes: row.notes || "" }); setEditingSupplierId(row.id); setShowSupplierModal(true); }}>Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteSupplier(row.id)}>Delete</button>
                </div>
              )},
            ]}
            rows={suppliers}
          />
        </SectionCard>

        <SectionCard title="Bills list" right={<div style={{ fontSize: 12, color: colours.muted }}>Based on expense records</div>}>
          <DataTable
            emptyState={{ icon: "📄", title: "No bills yet", message: "Bills and payables you record will appear here. Use the form above to add your first bill." }}
            columns={[
              { key: "supplier", label: "Supplier" },
              { key: "category", label: "Category" },
              { key: "date", label: "Bill date", render: (value) => formatDateAU(value) },
              { key: "dueDate", label: "Due date", render: (value) => formatDateAU(value) },
              { key: "amount", label: "Amount", render: (value) => currency(value) },
              { key: "status", label: "Status", render: (v, row) => (
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: row.type === "credit_note" ? "#F5ECFB" : v === "Paid" ? "#dcfce7" : v === "Overdue" ? "#FEF2F2" : v === "Due soon" ? "#FFF7ED" : "#f1f5f9",
                  color: row.type === "credit_note" ? colours.purple : v === "Paid" ? "#16a34a" : v === "Overdue" ? "#991B1B" : v === "Due soon" ? "#92400E" : "#64748b",
                }}>
                  {row.type === "credit_note" ? "CN" : v}
                </span>
              )},
              {
                key: "actions",
                label: "Actions",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {row.isPaid ? (
                      <button style={buttonSecondary} onClick={() => markBillUnpaid(row)}>Mark Unpaid</button>
                    ) : (
                      <button style={buttonPrimary} onClick={() => markBillPaid(row)}>Mark Paid</button>
                    )}
                    <button style={buttonSecondary} onClick={() => openExpenseEditor(row)}>View / Edit</button>
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendExpenseDirect(row)}
                    >
                      Email
                    </button>
                    {row.type !== "credit_note" && (
                      <button style={{ ...buttonSecondary, color: colours.purple, borderColor: colours.purple }}
                        onClick={() => { setCreditNoteSource(row); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); setShowAPCreditNoteModal(true); }}>
                        Credit Note
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={billRows}
          />
        </SectionCard>
      </div>
    );
    };

    const renderExpenses = () => {
    const totalExpenseAmt = expenses.reduce((s, e) => s + safeNumber(e.amount), 0);
    const totalGstCredit = expenses.reduce((s, e) => s + safeNumber(e.gst), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthExpenses = expenses.filter((e) => String(e.date || "").slice(0, 7) === thisMonth).reduce((s, e) => s + safeNumber(e.amount), 0);
    const categoryTotals = expenses.reduce((acc, e) => { const cat = e.category || "Other"; acc[cat] = (acc[cat] || 0) + safeNumber(e.amount); return acc; }, {});
    const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.slice(0, 8), value }));
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Expenses" subtitle="Record and categorise all business expenses. GST credits are calculated automatically." highlight={currency(totalExpenseAmt)}>
        <InsightChip label="This month" value={currency(thisMonthExpenses)} />
        <InsightChip label="GST credits" value={currency(totalGstCredit)} />
        <InsightChip label="Categories" value={String(Object.keys(categoryTotals).length)} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Total expenses" value={currency(totalExpenseAmt)} subtitle="All recorded expenses." accent={colours.navy} />
        <MetricCard title="This month" value={currency(thisMonthExpenses)} subtitle="Expenses recorded this calendar month." accent={colours.teal} />
        <MetricCard title="GST credits" value={currency(totalGstCredit)} subtitle="Claimable input tax credits." accent={colours.purple} />
        <MetricCard title="Categories used" value={String(Object.keys(categoryTotals).length)} subtitle="Distinct expense categories." accent={colours.navy} />
        <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Top expense categories</div>
          <MiniBarChart data={topCategories} height={90} accent={colours.purple} />
        </div>
      </div>
      <SectionCard
        title="Expense Details"
        right={
          <button
            style={buttonPrimary}
            onClick={() => {
              setExpenseModalOpen(true);
              setExpenseTypeStep(1);
            }}
          >
            Add Expense
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value, dueDate: addDaysEOM(e.target.value) })}
            />
          </div>


          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              style={inputStyle}
              value={expenseForm.dueDate || expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Supplier</label>
            <input
              style={inputStyle}
              value={expenseForm.supplier}
              onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <input
              style={inputStyle}
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              style={inputStyle}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Upload Receipt</label>
            <input
              type="file"
              accept="image/*,.pdf"
              style={inputStyle}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReceiptFile(file);
                setExpenseForm((prev) => ({ ...prev,
                  receiptFileName: file.name,
                }));
              }}
            />
          </div>
        </div>

        {expenseForm.receiptFileName ? (
          <div style={{ marginTop: 12, fontSize: 14, color: colours.muted }}>
            Selected receipt: {expenseForm.receiptFileName}
          </div>
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

        {receiptFile ? (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={buttonSecondary}
              onClick={() => {
                const previewUrl = URL.createObjectURL(receiptFile);
                window.open(previewUrl, "_blank");
              }}
            >
              Preview Receipt
            </button>

            <button
              type="button"
              style={buttonSecondary}
              onClick={() => {
                setReceiptFile(null);
                setExpenseForm((prev) => ({ ...prev,
                  receiptFileName: "",
                  receiptUrl: "",
                }));
              }}
            >
              Remove Receipt
            </button>
          </div>
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

        <div style={{ marginTop: 18 }}>
          <button style={buttonPrimary} onClick={saveExpense}>
            Save Expense
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Expense List">
        <DataTable
          emptyState={{ icon: "💸", title: "No expenses yet", message: "Record your first expense using the form above. GST credits are calculated automatically and your Safe to Spend updates in real time." }}
          columns={[
            { key: "date", label: "Date", render: (v) => formatDateAU(v) },
            { key: "dueDate", label: "Due Date", render: (v, row) => formatDateAU(v || row.date) },
            { key: "supplier", label: "Supplier" },
            { key: "category", label: "Category" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", render: (v) => currency(v) },
            { key: "gst", label: "GST", render: (v) => currency(v) },
            { key: "expenseType", label: "Type" },
            { key: "workType", label: "Work Type" },
            {
              key: "actions",
              label: "Actions",
              render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {row.receiptUrl ? (
                    <button
                      style={buttonPrimary}
                      onClick={() => window.open(row.receiptUrl, "_blank")}
                    >
                      View Receipt
                    </button>
                  ) : (
                    <span style={{ color: colours.muted }}>No receipt</span>
                  )}

                  <button
                    style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                    onClick={() => sendExpenseDirect(row)}
                  >
                    Email
                  </button>

                  <button style={buttonSecondary} onClick={() => deleteExpense(row.id)}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={expenses}
        />
      </SectionCard>
    </div>
    );
    };
    const renderIncomeSources = () => {
    const totalBeforeTax = incomeSources.reduce((s, src) => s + safeNumber(src.beforeTax), 0);
    const annualised = incomeSources.reduce((s, src) => {
      const freq = src.frequency || "";
      const amt = safeNumber(src.beforeTax);
      const mult = freq === "Weekly" ? 52 : freq === "Fortnightly" ? 26 : freq === "Monthly" ? 12 : freq === "Quarterly" ? 4 : 1;
      return s + amt * mult;
    }, 0);
    const typeBreakdown = incomeSources.reduce((acc, src) => { const t = src.incomeType || "Other"; acc[t] = (acc[t] || 0) + safeNumber(src.beforeTax); return acc; }, {});
    const typeData = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.slice(0, 10), value }));
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Income Sources" subtitle="Track all personal and business income streams for tax reporting. Feeds directly into your ATO export." highlight={currency(annualised)}>
        <InsightChip label="Sources recorded" value={String(incomeSources.length)} />
        <InsightChip label="Total before tax" value={currency(totalBeforeTax)} />
        <InsightChip label="Annualised est." value={currency(annualised)} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Sources recorded" value={String(incomeSources.length)} subtitle="All income sources in the portal." accent={colours.navy} />
        <MetricCard title="Total before tax" value={currency(totalBeforeTax)} subtitle="Sum of all recorded before-tax amounts." accent={colours.teal} />
        <MetricCard title="Annualised estimate" value={currency(annualised)} subtitle="Projected annual income based on frequency." accent={colours.purple} />
        <MetricCard title="Income types" value={String(Object.keys(typeBreakdown).length)} subtitle="Distinct income type categories." accent={colours.navy} />
        <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Income by type</div>
          <MiniBarChart data={typeData} height={90} accent={colours.teal} />
        </div>
      </div>
      <SectionCard title="Income Sources" right={<button style={buttonPrimary} onClick={() => setShowIncomeSourceModal(true)}>New Income Source</button>}>
        <DataTable
          emptyState={{ icon: "💰", title: "No income sources yet", message: "Add your income sources for your ATO export — employment, freelance, rental income and other earnings.", action: { label: "Add income source", onClick: () => {} } }}
          columns={[
            { key: "name", label: "Name" },
            { key: "incomeType", label: "Income Type" },
            { key: "beforeTax", label: "Before Tax", render: (v) => currency(v) },
            { key: "frequency", label: "Frequency" },
            {
              key: "startedAfterDate",
              label: "Started After 1 Jul 2025",
              render: (v) => (v ? "Yes" : "No"),
            },
            { key: "hasEndDate", label: "Fixed End Date", render: (v) => (v ? "Yes" : "No") },
            {
              key: "actions",
              label: "",
              render: (_, row) => (
                <button style={buttonSecondary} onClick={() => deleteIncomeSource(row.id)}>
                  Delete
                </button>
              ),
            },
          ]}
          rows={incomeSources}
        />
      </SectionCard>
    </div>
    );
    };
    
    const renderDocuments = () => {
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
        <MetricCard title="Total documents" value={String(documents.length)} subtitle="All files stored in the portal." accent={colours.navy} />
        <MetricCard title="Last uploaded" value={lastUploaded} subtitle="Most recently added document." accent={colours.teal} />
        <MetricCard title="File types" value={String(Object.keys(docTypes).length)} subtitle="Distinct file extensions stored." accent={colours.purple} />
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Files by type</div>
          <MiniBarChart data={typeData.length ? typeData : [{ label: "None", value: 0 }]} height={70} accent={colours.navy} />
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
              { key: "url", label: "Open", render: (v) => <a href={v} target="_blank" rel="noreferrer">Open</a> },
              { key: "actions", label: "", render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={() => openDocumentEditor(row)}>View / Edit</button>
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
              <div><label style={labelStyle}>URL</label><input style={inputStyle} value={documentEditorForm.url || ""} onChange={(e) => setDocumentEditorForm((prev) => ({ ...prev, url: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
              <button style={buttonSecondary} onClick={closeDocumentEditor}>Cancel</button>
              <button style={buttonPrimary} onClick={saveDocumentEdits}>Save Changes</button>
            </div>
          </div>
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}
      </SectionCard>
    </div>
    );
    };
    const renderSetupWizard = () => (
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
    );

    const renderAuthScreen = () => (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${colours.bg} 0%, #EEF4FF 100%)`, padding: 24 }}>
      {showResetSentModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 36, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#14202B", marginBottom: 12 }}>Check your email</div>
            <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 8 }}>A password reset link has been sent to</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6A1B9A", marginBottom: 20 }}>{authForm.email}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.7, marginBottom: 28 }}>
              Click the link in the email to set a new password. Check your spam folder if it doesn't arrive within a few minutes.
            </div>
            <button
              onClick={() => setShowResetSentModal(false)}
              style={{ background: "#6A1B9A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: colours.purple }}>
            {profile.businessName || "Sharon's Accounting Service"}
          </div>
          <a
            href="#portal-login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: colours.purple,
              color: "#fff",
              textDecoration: "none",
              borderRadius: 12,
              padding: "12px 20px",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: "0 10px 24px rgba(106,27,154,0.18)",
            }}
          >
            Login to Portal
          </a>
        </div>

        <div
          className="sas-auth-landing"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 460px)",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${colours.navy} 0%, ${colours.purple} 58%, ${colours.teal} 100%)`,
              borderRadius: 28,
              padding: 32,
              color: "#fff",
              boxShadow: "0 24px 60px rgba(43,47,107,0.18)",
              display: "grid",
              gap: 20,
              alignContent: "space-between",
              minHeight: 520,
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.14)", padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: 0.3, width: "fit-content" }}>
                Client portal access
              </div>
              <div style={{ fontSize: 44, lineHeight: 1.05, fontWeight: 900, maxWidth: 560 }}>
                Login to your portal from the landing page
              </div>
              <div style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.92, maxWidth: 620 }}>
                View invoices, quotes, expenses, documents and financial reports from one secure portal. This page now gives you a proper landing section with a visible login call-to-action so you can check how it looks on desktop and mobile.
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {[
                ["Invoices & quotes", "Create, send and review client billing documents."],
                ["Financial reporting", "View live insights, receivables, cash flow and BAS support."],
                ["Secure access", "Supabase sign-in with password reset and account setup flow."],
              ].map(([title, copy]) => (
                <div key={title} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 18, padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, marginTop: 4 }}>{copy}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="portal-login"
            style={{
              ...cardStyle,
              padding: 28,
              borderRadius: 28,
              boxShadow: "0 24px 60px rgba(15,23,42,0.10)",
              display: "grid",
              gap: 18,
              alignContent: "start",
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: colours.text, marginBottom: 8 }}>
                {authMode === "signup" ? "Create your portal account" : "Portal login"}
              </div>
              <div style={{ fontSize: 14, color: colours.muted, lineHeight: 1.7 }}>
                Sign in with Supabase Auth to access invoices, quotes, expenses, reports and client records.
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  value={authForm.email}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={authForm.password}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                />
              </div>
              {authMode === "signup" ? (
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input
                    type="password"
                    style={inputStyle}
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Repeat your password"
                  />
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button style={{ ...buttonPrimary, width: "100%", justifyContent: "center" }} onClick={handleAuthSubmit} disabled={authLoading}>
                {authLoading ? "Working..." : authMode === "signup" ? "Create Account" : "Login to Portal"}
              </button>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{ ...buttonSecondary, flex: 1, minWidth: 150 }}
                  onClick={() => setAuthMode((prev) => (prev === "signup" ? "signin" : "signup"))}
                >
                  {authMode === "signup" ? "Use Sign In" : "Create Account"}
                </button>
                <button style={{ ...buttonSecondary, flex: 1, minWidth: 150 }} onClick={handlePasswordReset}>
                  Reset Password
                </button>
              </div>
            </div>

            <div style={{ background: colours.bg, borderRadius: 16, padding: 16, fontSize: 13, color: colours.muted, lineHeight: 1.7 }}>
              <strong style={{ color: colours.text }}>Preview note:</strong> this login card is now part of the landing experience, so you can see the portal entry point immediately instead of having it hidden.
            </div>
          </div>
        </div>
      </div>
    </div>
    );
    const renderBASReport = () => {
      const quarterOptions = [
        { value: "0", label: "All activity" },
        { value: "1", label: "Quarter 1 (Jul-Sep)" },
        { value: "2", label: "Quarter 2 (Oct-Dec)" },
        { value: "3", label: "Quarter 3 (Jan-Mar)" },
        { value: "4", label: "Quarter 4 (Apr-Jun)" },
      ];
      return (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard title="BAS Report">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Quarter</label>
                <select style={inputStyle} value={basQuarter} onChange={(e) => setBasQuarter(e.target.value)}>
                  {quarterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Lodged date</label>
                <input type="date" style={inputStyle} value={basNotes.lodgedDate} onChange={(e) => setBasNotes((prev) => ({ ...prev, lodgedDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Reference number</label>
                <input style={inputStyle} value={basNotes.referenceNumber} onChange={(e) => setBasNotes((prev) => ({ ...prev, referenceNumber: e.target.value }))} placeholder="ATO reference" />
              </div>
            </div>
          </SectionCard>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <SummaryBox title="G1 Total sales" value={currency(totals.totalIncome)} subtitle="Gross sales from invoices" />
            <SummaryBox title="1A GST on sales" value={currency(totals.gstCollected)} subtitle="GST collected from income" />
            <SummaryBox title="1B GST on purchases" value={currency(totals.gstOnExpenses)} subtitle="GST credits on expenses" />
            <SummaryBox title="Net GST" value={currency(totals.gstPayable)} subtitle="1A less 1B" />
          </div>
          <SectionCard title="BAS notes">
            <textarea
              style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
              value={basNotes.notes}
              onChange={(e) => setBasNotes((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Add BAS working notes, assumptions and lodgement details here."
            />
          </SectionCard>
        </div>
      );
    };

    const renderSettings = () => (
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
              <label style={labelStyle}>PayPal Payment Link</label>
              <input
                style={inputStyle}
                value={profile.paypalPaymentLink || ""}
                onChange={(e) => setProfile({ ...profile, paypalPaymentLink: e.target.value })}
                placeholder="https://www.paypal.com/paypalme/yourname"
              />
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
    if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colours.bg,
          display: "grid",
          placeItems: "center",
          color: colours.text,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading portal...
      </div>
    );
    }

    if (!authUser) {
    return renderAuthScreen();
    }

    if (isResettingPassword) {
      return (
        <div style={{ minHeight: "100vh", background: colours.bg, display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ ...cardStyle, width: "100%", maxWidth: 440, padding: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: colours.text, marginBottom: 8 }}>Set New Password</div>
            <div style={{ fontSize: 14, color: colours.muted, marginBottom: 24 }}>Enter your new password below.</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input type="password" style={inputStyle} value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Repeat new password" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={buttonPrimary} onClick={async () => {
                if (!newPassword || newPassword.length < 8) { toast.warning("Password must be at least 8 characters"); return; }
                if (newPassword !== newPasswordConfirm) { toast.warning("Passwords do not match"); return; }
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) throw error;
                  toast.success("Password updated! Signing you in...");
                  setIsResettingPassword(false);
                  setNewPassword("");
                  setNewPasswordConfirm("");
                } catch (err) { toast.error(err.message || "Failed to update password"); }
              }}>Update Password</button>
            </div>
          </div>
        </div>
      );
    }

    if (isSupabaseRestoring || !hasLoadedUserProfile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colours.bg,
          display: "grid",
          placeItems: "center",
          color: colours.text,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading your profile.
      </div>
    );
    }

    if (!setupComplete) {
    return renderSetupWizard();
    }

    if (profile?.accountStatus === "closed") {
    return (
      <div style={{ minHeight: "100vh", background: colours.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colours.text, marginBottom: 10 }}>Account closed</div>
          <div style={{ fontSize: 15, color: colours.muted, lineHeight: 1.7, marginBottom: 28 }}>
            Your account has been closed. Your data is safe and your account can be reactivated at any time.
          </div>
          <a href="mailto:info@sharonogier.com" style={{ display: "inline-block", background: colours.purple, color: "#fff", borderRadius: 12, padding: "12px 28px", fontWeight: 700, textDecoration: "none", fontSize: 15, marginBottom: 16 }}>
            Contact us to reactivate
          </a>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSignOut} style={{ background: "none", border: "none", color: colours.muted, cursor: "pointer", fontSize: 13 }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
    }

    const subscriptionAccess = getSubscriptionAccess(profile);
    if (!subscriptionAccess.allowed) {
      return <PaywallScreen profile={profile} serverBaseUrl={getApiBaseUrl(profile.stripeServerUrl)} />;
    }

    return (
    <div
      style={{
        minHeight: "100vh",
        background: colours.bg,
        color: colours.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <style>{`
        .sas-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
        .sas-sidebar { background: #fff; border-right: 1px solid #E2E8F0; padding: 20px; position: relative; z-index: 100; }
        .sas-overlay { display: none; }
        .sas-hamburger { display: none; }
        .sas-main { padding: 24px; overflow-x: auto; }
        .sas-page-wrap { width: 100%; overflow-x: auto; }
        .sas-page-inner { min-width: 0; }
        .sas-dashboard-hero .sas-hero-title { word-break: break-word; overflow-wrap: anywhere; }
        .sas-dashboard-hero .sas-hero-subtitle { word-break: break-word; }
        @media (max-width: 768px) {
          .sas-layout { grid-template-columns: 1fr; }
          .sas-sidebar { position: fixed; top: 0; left: -260px; width: 240px; height: 100vh; overflow-y: auto; transition: left 0.25s ease; z-index: 200; box-shadow: 4px 0 20px rgba(0,0,0,0.12); }
          .sas-sidebar.open { left: 0; }
          .sas-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 199; }
          .sas-hamburger { display: flex; align-items: center; gap: 12px; background: #fff; border-bottom: 1px solid #E2E8F0; padding: 14px 16px; position: sticky; top: 0; z-index: 100; }
          .sas-hamburger-btn { background: none; border: none; cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 5px; }
          .sas-hamburger-btn span { display: block; width: 22px; height: 2px; background: #6A1B9A; border-radius: 2px; }
          .sas-main { padding: 16px; overflow-x: auto; }
          .sas-page-wrap { overflow-x: auto; }
          .sas-dashboard-hero.sas-hero-grid { grid-template-columns: 1fr !important; gap: 16px !important; padding: 20px !important; border-radius: 18px !important; }
          .sas-dashboard-hero .sas-hero-title { font-size: 28px !important; line-height: 1.15 !important; }
          .sas-dashboard-hero .sas-hero-subtitle { font-size: 14px !important; line-height: 1.55 !important; }
          .sas-dashboard-hero .sas-hero-focus-card { padding: 18px !important; min-height: auto !important; }
          .sas-dashboard-hero .sas-hero-focus-value { font-size: 24px !important; line-height: 1.1 !important; word-break: break-word; }
        }
        @media (max-width: 480px) {
          .sas-main { padding: 12px; }
          .sas-dashboard-hero .sas-hero-title { font-size: 24px !important; }
        }
      `}</style>

      <div className="sas-hamburger">
        <button className="sas-hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <span /><span /><span />
        </button>
        <span style={{ fontSize: 16, fontWeight: 900, color: colours.purple }}>{profile.businessName || "My Portal"}</span>
      </div>

      {sidebarOpen && <div className="sas-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="sas-layout">
        <aside className={`sas-sidebar${sidebarOpen ? " open" : ""}`}>
          <div style={{ fontSize: 20, fontWeight: 900, color: colours.purple, marginBottom: 20 }}>
            {profile.businessName || "My Portal"}
          </div>

          <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16 }}>
            Signed in as {authUser.email || "user"}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {navSections.map((section) => (
              <div key={section.title} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: colours.muted, padding: "0 6px" }}>
                  {section.title}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {section.items.map((item) => (
                    <button
                      key={item}
                      onClick={() => { setActivePage(item); setSidebarOpen(false); }}
                      style={{
                        textAlign: "left",
                        border: "none",
                        borderRadius: 12,
                        padding: "12px 14px",
                        cursor: "pointer",
                        fontWeight: 700,
                        background: activePage === item ? colours.lightPurple : "transparent",
                        color: activePage === item ? colours.purple : colours.text,
                      }}
                    >
                      {navLabels[item] || (item.charAt(0).toUpperCase() + item.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSignOut}
            style={{ ...buttonSecondary, width: "100%", marginTop: 16 }}
          >
            Log out
          </button>
        </aside>

        <main className="sas-main">
          <div className="sas-page-wrap">
            <div className="sas-page-inner" style={{ maxWidth: 1400, margin: "0 auto" }}>
            {activePage === "dashboard" && renderDashboard()}
            {activePage === "financial insights" && renderFinancialInsights()}
            {activePage === "invoices" && renderInvoices()}
            {activePage === "quotes" && renderQuotes()}
            {activePage === "clients" && renderClients()}
            {activePage === "services" && renderServices()}
            {activePage === "expenses" && renderExpenses()}
            {activePage === "bills / payables" && renderBillsPayables()}
            {activePage === "income sources" && renderIncomeSources()}
            {activePage === "documents" && renderDocuments()}
            {activePage === "bas report" && renderBASReport()}
            {activePage === "settings" && renderSettings()}
            </div>
          </div>
        </main>
      </div>

      <div style={{ position: "fixed", right: 20, bottom: isMobileViewport ? 20 : 24, zIndex: 1000 }}>
        {showQuickAddMenu && !isMobileViewport && (
          <div style={{ ...cardStyle, width: 220, padding: 10, marginBottom: 10, boxShadow: "0 16px 40px rgba(15,23,42,0.18)" }}>
            {[
              { label: "New Invoice", action: () => { setActivePage("invoices"); setShowQuickAddMenu(false); } },
              { label: "New Quote", action: () => { setActivePage("quotes"); setShowQuickAddMenu(false); } },
              { label: "New Expense", action: () => { setActivePage("expenses"); setShowQuickAddMenu(false); } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 10, padding: "12px 12px", fontWeight: 700, color: colours.text, cursor: "pointer" }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (isMobileViewport) {
              setShowMobileWizard(true);
            } else {
              setShowQuickAddMenu((prev) => !prev);
            }
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            background: colours.purple,
            color: "#fff",
            fontSize: 30,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 14px 34px rgba(106,27,154,0.32)",
          }}
          aria-label="Quick add"
        >
          +
        </button>
      </div>

      {showMobileWizard && (
        <MobileWizard
          profile={profile}
          clients={clients}
          invoices={invoices}
          quotes={quotes}
          expenses={expenses}
          services={services}
          onSaveInvoice={(savedInvoice) => {
            setInvoices((prev) => [...prev, savedInvoice]);
          }}
          onSaveQuote={(savedQuote) => {
            setQuotes((prev) => [...prev, savedQuote]);
          }}
          onSaveExpense={(savedExpense) => {
            setExpenses((prev) => [...prev, savedExpense]);
          }}
          onEmailDocument={sendSavedDocumentEmail}
          upsertRecord={upsertRecordInDatabase}
          uploadReceipt={uploadReceiptToSupabase}
          toast={toast}
          onClose={() => setShowMobileWizard(false)}
        />
      )}

      <ExpenseTypeModal
        isOpen={expenseModalOpen}
        onClose={resetExpenseModal}
        expenseTypeStep={expenseTypeStep}
        setExpenseTypeStep={setExpenseTypeStep}
        expenseTypeSelection={expenseTypeSelection}
        setExpenseTypeSelection={setExpenseTypeSelection}
        expenseWorkType={expenseWorkType}
        setExpenseWorkType={setExpenseWorkType}
        expenseCategorySelection={expenseCategorySelection}
        setExpenseCategorySelection={setExpenseCategorySelection}
        expenseWorkTypes={expenseWorkTypes}
        setExpenseWorkTypes={setExpenseWorkTypes}
        searchExpenseCategory={searchExpenseCategory}
        setSearchExpenseCategory={setSearchExpenseCategory}
        expenseForm={expenseForm}
        setExpenseForm={setExpenseForm}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        onNext={nextExpenseModalStep}
        toast={toast}
      />

      <IncomeSourceModal
        isOpen={showIncomeSourceModal}
        onClose={() => setShowIncomeSourceModal(false)}
        incomeSourceForm={incomeSourceForm}
        setIncomeSourceForm={setIncomeSourceForm}
        onSave={saveIncomeSource}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmModal}

      {/* ── Password Reset Sent Modal ── */}
      {showResetSentModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 36, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#14202B", marginBottom: 12 }}>Check your email</div>
            <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 8 }}>
              A password reset link has been sent to
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6A1B9A", marginBottom: 20 }}>
              {authForm.email}
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.7, marginBottom: 28 }}>
              Click the link in the email to set a new password. Check your spam folder if it doesn't arrive within a few minutes.
            </div>
            <button onClick={() => setShowResetSentModal(false)}
              style={{ background: "#6A1B9A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99993, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 6 }}>
              Import {importType === "clients" ? "Clients" : "Suppliers"}
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["clients", "suppliers"].map((t) => (
                <button key={t} onClick={() => { setImportType(t); setImportRows([]); setImportError(""); }}
                  style={{ background: importType === t ? colours.purple : "#F1F5F9", color: importType === t ? "#fff" : colours.text, border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            {/* How to section */}
            <div style={{ background: colours.lightPurple, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: colours.purple, marginBottom: 10 }}>📋 How to import</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colours.text, lineHeight: 2 }}>
                <li>Click <strong>Download Template</strong> below to get the Excel/CSV file</li>
                <li>Open it in Excel or Google Sheets</li>
                <li>Fill in your {importType} — <strong>Name is required</strong>, all other columns are optional</li>
                <li>Save as <strong>CSV</strong> (File → Save As → CSV)</li>
                <li>Click <strong>Choose File</strong> below and select your saved CSV</li>
                <li>Review the preview, then click <strong>Confirm Import</strong></li>
              </ol>
              <div style={{ marginTop: 12, fontSize: 12, color: colours.muted }}>
                ℹ️ Duplicates are skipped automatically — existing {importType} with the same name won't be overwritten.
              </div>
            </div>

            {/* Column headings reference */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Required columns in your CSV</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(importType === "clients"
                  ? ["Name *", "Business Name", "Email", "Phone", "Address", "ABN", "Currency", "Work Type"]
                  : ["Name *", "Contact Person", "Email", "Phone", "Address", "ABN", "Notes"]
                ).map((col) => (
                  <span key={col} style={{ background: col.includes("*") ? colours.purple : "#F1F5F9", color: col.includes("*") ? "#fff" : colours.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Download template button */}
            <button onClick={() => downloadTemplate(importType)}
              style={{ ...buttonSecondary, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              ⬇ Download {importType === "clients" ? "Clients" : "Suppliers"} Template
            </button>

            {/* File upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Upload your filled CSV</label>
              <input type="file" accept=".csv,.txt" style={{ ...inputStyle, padding: 8 }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const { rows, error } = parseImportCSV(ev.target.result, importType);
                    setImportRows(rows);
                    setImportError(error);
                  };
                  reader.readAsText(file);
                }} />
            </div>

            {/* Error */}
            {importError && (
              <div style={{ background: "#FEF2F2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{importError}</div>
            )}

            {/* Preview */}
            {importRows.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: colours.text, marginBottom: 8 }}>Preview — {importRows.length} row{importRows.length !== 1 ? "s" : ""} ready to import</div>
                <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${colours.border}`, borderRadius: 10 }}>
                  {importRows.slice(0, 10).map((row, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${colours.border}`, fontSize: 13 }}>
                      <strong>{row.name}</strong>
                      {row.businessName && <span style={{ color: colours.muted }}> — {row.businessName}</span>}
                      {row.email && <span style={{ color: colours.muted }}> · {row.email}</span>}
                      {row.phone && <span style={{ color: colours.muted }}> · {row.phone}</span>}
                    </div>
                  ))}
                  {importRows.length > 10 && <div style={{ padding: "8px 14px", fontSize: 12, color: colours.muted }}>...and {importRows.length - 10} more</div>}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportError(""); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              {importRows.length > 0 && (
                <button onClick={confirmImport}
                  style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  Confirm Import ({importRows.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Client Modal ── */}
      {showClientModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99994, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 20 }}>{editingClientId ? "Edit Client" : "Add New Client"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Client Name *</label>
                <input style={inputStyle} value={clientModalForm.name} onChange={(e) => setClientModalForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. John Smith" />
              </div>
              <div>
                <label style={labelStyle}>Business Name</label>
                <input style={inputStyle} value={clientModalForm.businessName} onChange={(e) => setClientModalForm((p) => ({ ...p, businessName: e.target.value }))} placeholder="e.g. Smith Farms Pty Ltd" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={clientModalForm.email} onChange={(e) => setClientModalForm((p) => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={clientModalForm.phone} onChange={(e) => setClientModalForm((p) => ({ ...p, phone: e.target.value }))} placeholder="04XX XXX XXX" />
              </div>
              <div>
                <label style={labelStyle}>ABN</label>
                <input style={inputStyle} value={clientModalForm.abn} onChange={(e) => setClientModalForm((p) => ({ ...p, abn: e.target.value }))} placeholder="12 345 678 901" />
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <select style={inputStyle} value={clientModalForm.defaultCurrency} onChange={(e) => setClientModalForm((p) => ({ ...p, defaultCurrency: e.target.value }))}>
                  <option value="AUD $">AUD $</option>
                  <option value="USD $">USD $</option>
                  <option value="NZD $">NZD $</option>
                  <option value="GBP £">GBP £</option>
                  <option value="EUR €">EUR €</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={clientModalForm.address} onChange={(e) => setClientModalForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Farm Rd, Dubbo NSW 2830" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => { setShowClientModal(false); setClientModalForm({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" }); setEditingClientId(null); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={async () => {
                await saveClientFromModal();
                const saved = clients.find((c) => c.name === clientModalForm.name);
                if (saved) { setInvClientSearch(saved.name); setInvoiceForm((p) => ({ ...p, clientId: String(saved.id) })); setQuoteClientSearch(saved.name); setQuoteForm((p) => ({ ...p, clientId: String(saved.id) })); }
              }}
                style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editingClientId ? "Update Client" : "Save Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Modal ── */}
      {showSupplierModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99995, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 20 }}>{editingSupplierId ? "Edit Supplier" : "Add Supplier"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Supplier Name *</label>
                <input style={inputStyle} value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. AGL Energy" />
              </div>
              <div>
                <label style={labelStyle}>Contact Person</label>
                <input style={inputStyle} value={supplierForm.contactPerson} onChange={(e) => setSupplierForm((p) => ({ ...p, contactPerson: e.target.value }))} placeholder="e.g. John Smith" />
              </div>
              <div>
                <label style={labelStyle}>ABN</label>
                <input style={inputStyle} value={supplierForm.abn} onChange={(e) => setSupplierForm((p) => ({ ...p, abn: e.target.value }))} placeholder="e.g. 12 345 678 901" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={supplierForm.email} onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))} placeholder="accounts@supplier.com.au" />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} placeholder="02 1234 5678" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Sydney NSW 2000" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={supplierForm.notes} onChange={(e) => setSupplierForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Payment terms, account numbers, etc." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => { setShowSupplierModal(false); setSupplierForm({ name: "", email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" }); setEditingSupplierId(null); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={saveSupplier}
                style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editingSupplierId ? "Update Supplier" : "Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AR Credit Note Modal ── */}
      {showARCreditNoteModal && creditNoteSource && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99996, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 4 }}>AR Credit Note</div>
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 20 }}>
              Against invoice <strong>{creditNoteSource.invoiceNumber || creditNoteSource.id}</strong> — {getClientName(creditNoteSource.clientId)}
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Credit Note Date</label>
                <input type="date" style={inputStyle} value={creditNoteForm.date}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Amount (ex GST)</label>
                <input type="number" min="0" step="0.01" style={inputStyle} value={creditNoteForm.amount}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input style={inputStyle} value={creditNoteForm.reason}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Returned goods, overcharge adjustment..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => { setShowARCreditNoteModal(false); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={saveARCreditNote}
                style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Save Credit Note</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AP Credit Note Modal ── */}
      {showAPCreditNoteModal && creditNoteSource && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99996, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 4 }}>AP Credit Note</div>
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 20 }}>
              Against bill from <strong>{creditNoteSource.supplier}</strong> dated {formatDateAU(creditNoteSource.date)}
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Credit Note Date</label>
                <input type="date" style={inputStyle} value={creditNoteForm.date}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Amount (incl GST)</label>
                <input type="number" min="0" step="0.01" style={inputStyle} value={creditNoteForm.amount}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input style={inputStyle} value={creditNoteForm.reason}
                  onChange={(e) => setCreditNoteForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Returned goods, overcharge adjustment..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => { setShowAPCreditNoteModal(false); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={saveAPCreditNote}
                style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Save Credit Note</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Recurring Invoices Modal ── */}
      {showRecurringModal && recurringDue.length > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99996, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 28 }}>🔁</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#14202B" }}>Recurring Invoices Due</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{recurringDue.length} invoice{recurringDue.length !== 1 ? "s" : ""} ready to be created</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              {recurringDue.map((inv) => (
                <div key={inv.id} onClick={() => setRecurringSelected((prev) => prev.includes(inv.id) ? prev.filter((x) => x !== inv.id) : [...prev, inv.id])}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    background: recurringSelected.includes(inv.id) ? colours.lightPurple : "#F8FAFC",
                    border: "1px solid " + (recurringSelected.includes(inv.id) ? colours.purple : colours.border) }}>
                  <input type="checkbox" checked={recurringSelected.includes(inv.id)}
                    onChange={() => setRecurringSelected((prev) => prev.includes(inv.id) ? prev.filter((x) => x !== inv.id) : [...prev, inv.id])}
                    onClick={(e) => e.stopPropagation()} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{inv.clientName}</div>
                    <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>
                      {inv.recurs} · Due {formatDateAU(inv.dueRecurDate)} · {currency(safeNumber(inv.total))}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colours.purple, background: colours.lightPurple, padding: "2px 8px", borderRadius: 6 }}>
                    {inv.recurs}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowRecurringModal(false); setRecurringDue([]); setRecurringSelected([]); }}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Skip
              </button>
              <button onClick={confirmRecurring} disabled={recurringSelected.length === 0}
                style={{ background: recurringSelected.length === 0 ? "#9CA3AF" : colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: recurringSelected.length === 0 ? "not-allowed" : "pointer", fontSize: 14 }}>
                Create {recurringSelected.length} Invoice{recurringSelected.length !== 1 ? "s" : ""} as Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceAlerts && invoiceAlerts.length > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99997, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 28 }}>🔔</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#14202B" }}>Bills & Payables Reminders</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                  {invoiceAlerts.length} bill{invoiceAlerts.length !== 1 ? "s" : ""} need{invoiceAlerts.length === 1 ? "s" : ""} your attention
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              {invoiceAlerts.map((alert) => (
                <div key={alert.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                  background: alert.type === "overdue" ? "#FEF2F2" : alert.type === "today" ? "#FFF7ED" : "#FEFCE8",
                  border: `1px solid ${alert.type === "overdue" ? "#FECACA" : alert.type === "today" ? "#FED7AA" : "#FDE68A"}`,
                }}>
                  <div style={{ fontSize: 18 }}>{alert.type === "overdue" ? "🔴" : alert.type === "today" ? "🟠" : "🟡"}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: alert.type === "overdue" ? "#991B1B" : alert.type === "today" ? "#92400E" : "#78350F" }}>
                    {alert.label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowInvoiceAlerts(false); setActivePage("bills / payables"); }}
                style={{ background: colours.purple, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                View Bills
              </button>
              <button onClick={() => setShowInvoiceAlerts(false)}
                style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div> 
    );
}
