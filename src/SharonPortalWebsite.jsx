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


// --- Page components ----------------------------------------------------------
import DashboardPage        from "./pages/DashboardPage";
import FinancialInsightsPage from "./pages/FinancialInsightsPage";
import ClientsPage          from "./pages/ClientsPage";
import InvoicesPage         from "./pages/InvoicesPage";
import QuotesPage           from "./pages/QuotesPage";
import ServicesPage         from "./pages/ServicesPage";
import BillsPage            from "./pages/BillsPage";
import ExpensesPage         from "./pages/ExpensesPage";
import IncomeSourcesPage    from "./pages/IncomeSourcesPage";
import DocumentsPage        from "./pages/DocumentsPage";
import SetupWizardPage      from "./pages/SetupWizardPage";
import AuthPage             from "./pages/AuthPage";
import BASReportPage        from "./pages/BASReportPage";
import SettingsPage         from "./pages/SettingsPage";
import ATOTaxFormPage       from "./ATOTaxFormPage";
// -----------------------------------------------------------------------------


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
  const [clientForm, setClientForm] = useState({ ...blankClient, sendToMe: true });

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
          // Email confirmation is on -- ask them to confirm
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
      // Strip base64 logo before saving -- too large for Supabase row
      const { logoDataUrl: _logo, ...profileToSave } = profilePayload || {};
      const savedProfile = await upsertRecordInDatabase(SUPABASE_TABLES.profile, {
        ...profileToSave,
        id: profileToSave?.id || getStableProfileRowId(),
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
        console.error("SUPABASE BULK SAVE -- partial failure:", summary);
        setSupabaseSyncStatus(`Saved with errors -- ${summary}`);
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

  // Always send to the client's email (if valid) and the logged-in user's email.
  // We don't gate on sendToClient/sendToMe flags -- those are never set in the client form.
  const recipientList = Array.from(
    new Set(
      [
        isValidEmail(client?.email) ? String(client.email).trim() : "",
        isValidEmail(profile?.email) ? String(profile.email).trim() : "",
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

  // Build self-contained HTML email body -- no logo, no interactive buttons
  const emailClient = getClientById(emailDocumentRecord?.clientId);
  const emailLineItems = emailDocumentRecord?.lineItems || [];
  const hasLines = emailLineItems.length > 0;
  const isInvoice = documentType === "invoice";
  const docNumber = isInvoice ? emailDocumentRecord?.invoiceNumber : emailDocumentRecord?.quoteNumber;
  const docDate = isInvoice ? emailDocumentRecord?.invoiceDate : emailDocumentRecord?.quoteDate;
  const docDueLabel = isInvoice ? "Due Date" : "Expiry Date";
  const docDueValue = isInvoice ? emailDocumentRecord?.dueDate : emailDocumentRecord?.expiryDate;
  const emailCurrency = emailDocumentRecord?.currencyCode || "AUD";
  const fmt = (v) => formatCurrencyByCode(safeNumber(v), emailCurrency);

  const lineRowsHtml = hasLines
    ? emailLineItems.map((item) => {
        const qty = Math.max(1, safeNumber(item.quantity || 1));
        const unit = safeNumber(item.unitPrice);
        const rowSub = unit * qty;
        const rowGst = (item.gstType === "GST on Income (10%)") ? rowSub * 0.1 : 0;
        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;">${item.description || ""}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:center;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:right;">${fmt(unit)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:right;">${fmt(rowGst)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">${fmt(rowSub + rowGst)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="5" style="padding:12px;color:#64748B;text-align:center;">No line items</td></tr>`;

  const emailBodyHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isInvoice ? "Invoice" : "Quote"} ${docNumber || ""}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#14202B;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">

      <!-- Header -->
      <tr style="background:#6A1B9A;">
        <td style="padding:28px 32px;">
          <div style="font-size:26px;font-weight:900;color:#ffffff;">${isInvoice ? "INVOICE" : "QUOTE"}</div>
          <div style="font-size:14px;color:#E9D5FF;margin-top:4px;">${docNumber || ""}</div>
        </td>
        <td style="padding:28px 32px;text-align:right;">
          <div style="font-size:13px;color:#E9D5FF;">${profile?.businessName || ""}</div>
          ${profile?.abn ? `<div style="font-size:12px;color:#C4B5FD;margin-top:2px;">ABN: ${profile.abn}</div>` : ""}
          ${profile?.email ? `<div style="font-size:12px;color:#C4B5FD;margin-top:2px;">${profile.email}</div>` : ""}
          ${profile?.phone ? `<div style="font-size:12px;color:#C4B5FD;margin-top:2px;">${profile.phone}</div>` : ""}
        </td>
      </tr>

      <!-- From / To / Dates -->
      <tr>
        <td colspan="2" style="padding:24px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="33%" style="vertical-align:top;padding-right:16px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6A1B9A;margin-bottom:8px;">${isInvoice ? "Bill To" : "Quote To"}</div>
                <div style="font-size:14px;font-weight:700;">${emailClient?.name || ""}</div>
                ${emailClient?.businessName ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${emailClient.businessName}</div>` : ""}
                ${emailClient?.email ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${emailClient.email}</div>` : ""}
                ${emailClient?.abn ? `<div style="font-size:12px;color:#94A3B8;margin-top:2px;">ABN: ${emailClient.abn}</div>` : ""}
              </td>
              <td width="33%" style="vertical-align:top;padding-right:16px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6A1B9A;margin-bottom:8px;">Date</div>
                <div style="font-size:13px;">${formatDateAU(docDate)}</div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6A1B9A;margin-bottom:4px;margin-top:12px;">${docDueLabel}</div>
                <div style="font-size:13px;">${formatDateAU(docDueValue)}</div>
              </td>
              <td width="33%" style="vertical-align:top;text-align:right;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6A1B9A;margin-bottom:8px;">${isInvoice ? "Amount Due" : "Total Estimate"}</div>
                <div style="font-size:28px;font-weight:900;color:#006D6D;">${fmt(resolvedTotal)}</div>
                ${emailDocumentRecord?.purchaseOrderReference ? `<div style="font-size:12px;color:#94A3B8;margin-top:6px;">PO: ${emailDocumentRecord.purchaseOrderReference}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Line Items -->
      <tr>
        <td colspan="2" style="padding:24px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#F8FAFC;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Description</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Unit Price</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">GST</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Total</th>
              </tr>
            </thead>
            <tbody>${lineRowsHtml}</tbody>
          </table>
        </td>
      </tr>

      <!-- Totals -->
      <tr>
        <td colspan="2" style="padding:16px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td></td>
              <td width="260" style="border-top:2px solid #E2E8F0;padding-top:12px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Subtotal (ex GST)</td>
                    <td style="padding:4px 0;font-size:13px;text-align:right;">${fmt(safeNumber(emailDocumentRecord?.subtotal))}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">GST</td>
                    <td style="padding:4px 0;font-size:13px;text-align:right;">${fmt(safeNumber(emailDocumentRecord?.gst))}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0 4px;font-size:16px;font-weight:800;color:#006D6D;">${isInvoice ? "Total Due" : "Total Estimate"}</td>
                    <td style="padding:10px 0 4px;font-size:16px;font-weight:800;color:#006D6D;text-align:right;">${fmt(resolvedTotal)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Payment Details (invoices only) -->
      ${isInvoice && (profile?.bankName || profile?.bsb || profile?.accountNumber || profile?.payId || profile?.stripePaymentLink || profile?.paypalPaymentLink || stripeCheckoutUrl || emailDocumentRecord?.paymentReference) ? `
      <tr>
        <td colspan="2" style="padding:16px 32px 0;">
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:18px 20px;">
            <div style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:12px;">How to Pay</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${emailDocumentRecord?.paymentReference ? `<tr>
                <td style="padding:4px 0;font-size:13px;color:#166534;font-weight:700;width:140px;">Payment Reference</td>
                <td style="padding:4px 0;font-size:14px;font-weight:800;color:#14532D;">${emailDocumentRecord.paymentReference}</td>
              </tr>` : ""}
              ${profile?.bankName ? `<tr>
                <td style="padding:4px 0;font-size:13px;color:#374151;width:140px;">Bank</td>
                <td style="padding:4px 0;font-size:13px;color:#14532D;font-weight:600;">${profile.bankName}</td>
              </tr>` : ""}
              ${profile?.accountNumber ? `<tr>
                <td style="padding:4px 0;font-size:13px;color:#374151;width:140px;">Account Number</td>
                <td style="padding:4px 0;font-size:13px;color:#14532D;font-weight:600;">${profile.accountNumber}</td>
              </tr>` : ""}
              ${profile?.bsb ? `<tr>
                <td style="padding:4px 0;font-size:13px;color:#374151;width:140px;">BSB</td>
                <td style="padding:4px 0;font-size:13px;color:#14532D;font-weight:600;">${profile.bsb}</td>
              </tr>` : ""}
              ${profile?.payId ? `<tr>
                <td style="padding:4px 0;font-size:13px;color:#374151;width:140px;">PayID</td>
                <td style="padding:4px 0;font-size:13px;color:#14532D;font-weight:600;">${profile.payId}</td>
              </tr>` : ""}
            </table>
            ${(stripeCheckoutUrl || profile?.stripePaymentLink || profile?.paypalPaymentLink) ? `
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid #BBF7D0;">
              ${(stripeCheckoutUrl || profile?.stripePaymentLink) ? `<a href="${stripeCheckoutUrl || profile.stripePaymentLink}" style="display:inline-block;background:#6A1B9A;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 28px;border-radius:8px;margin-right:10px;">Pay with Card</a>` : ""}
              ${profile?.paypalPaymentLink ? `<a href="${profile.paypalPaymentLink}" style="display:inline-block;background:#003087;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 28px;border-radius:8px;">Pay with PayPal</a>` : ""}
            </div>` : ""}
          </div>
        </td>
      </tr>` : ""}


      <!-- Comments -->
      ${emailDocumentRecord?.comments ? `
      <tr>
        <td colspan="2" style="padding:16px 32px 0;">
          <div style="background:#F8FAFC;border-radius:10px;padding:14px 18px;">
            <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:6px;">Notes</div>
            <div style="font-size:13px;color:#475569;line-height:1.6;">${emailDocumentRecord.comments}</div>
          </div>
        </td>
      </tr>` : ""}

      <!-- Footer -->
      <tr>
        <td colspan="2" style="padding:24px 32px;text-align:center;border-top:1px solid #E2E8F0;margin-top:24px;">
          <div style="font-size:12px;color:#94A3B8;">
            ${profile?.businessName || ""} ${profile?.abn ? "| ABN: " + profile.abn : ""} ${profile?.email ? "| " + profile.email : ""}
          </div>
          ${profile?.address ? `<div style="font-size:11px;color:#CBD5E1;margin-top:4px;">${profile.address}</div>` : ""}
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const payload = {
    to: recipientList,
    subject: isInvoice
      ? `Invoice ${docNumber || ""} from ${profile?.businessName || "Your Business"}`
      : `Quote ${docNumber || ""} from ${profile?.businessName || "Your Business"}`,
    html: emailBodyHtml,
    text: isInvoice
      ? `Please find your invoice ${docNumber || ""} from ${profile?.businessName || "Your Business"} for ${fmt(resolvedTotal)}.`
      : `Please find your quote ${docNumber || ""} from ${profile?.businessName || "Your Business"} for ${fmt(resolvedTotal)}.`,
    replyTo: profile?.email || "",
    documentType,
    invoiceNumber: emailDocumentRecord?.invoiceNumber || "",
    quoteNumber: emailDocumentRecord?.quoteNumber || "",
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
      setClientForm({ ...blankClient, sendToMe: true });
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

      // 2. Build the invoice payload from the quote -- preserve all line items, amounts, client
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
        toast.success(result.message || "Invoice emailed successfully!");
      } else {
        const failMsg = result?.message || "Could not send invoice.";
        setStatus(failMsg, "#B42318");
        toast.error(failMsg);
      }
    } catch (error) {
      console.error("PREVIEW INVOICE EMAIL ERROR:", error);
      const errMsg = `Email failed: ${error.message || "Unknown error"}`;
      setStatus(errMsg, "#B42318");
      toast.error(errMsg);
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
        toast.success(result.message || "Quote emailed successfully!");
      } else {
        const failMsg = result?.message || "Could not send quote.";
        setStatus(failMsg, "#B42318");
        toast.error(failMsg);
      }
    } catch (error) {
      console.error("PREVIEW QUOTE EMAIL ERROR:", error);
      const errMsg = `Email failed: ${error.message || "Unknown error"}`;
      setStatus(errMsg, "#B42318");
      toast.error(errMsg);
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

    const saveBill = async ({ totalAmt, totalGst, clear } = {}) => {
    if (clear) {
      setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
      setBillLineItems([blankBillLine()]);
      setBillWizardStep(1);
      return;
    }
    if (!expenseForm.supplier) { toast.warning("Supplier name is required"); return; }
    if (!totalAmt || totalAmt <= 0) { toast.warning("Add at least one line item with an amount"); return; }
    setSavingBill(true);
    try {
      const primaryCategory = billLineItems.find((l) => l.category)?.category || "Other";
      const combinedDesc = billLineItems.map((l) => l.description).filter(Boolean).join("; ");
      const payload = {
        ...expenseForm,
        category: primaryCategory,
        description: combinedDesc,
        amount: totalAmt,
        gst: totalGst || 0,
        billLineItems,
        expenseType: "Bill / Payable",
        isPaid: false,
        paidAt: "",
      };
      const saved = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);
      setExpenses((prev) => [...prev, saved]);
      toast.success("Bill saved!");
      setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
      setBillLineItems([blankBillLine()]);
      setBillWizardStep(1);
    } catch (err) {
      console.error("BILL SAVE ERROR:", err);
      toast.error(err.message || "Bill save failed");
    } finally {
      setSavingBill(false);
    }
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
      setActivePage("ato tax form");
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
        label: `${invoice.invoiceNumber || "Invoice"} . ${getClientName(invoice.clientId)}`,
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


    ;
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
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authLoading={authLoading}
        handleAuthSubmit={handleAuthSubmit}
        handlePasswordReset={handlePasswordReset}
        colours={colours}
        cardStyle={cardStyle}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
        buttonPrimary={buttonPrimary}
        buttonSecondary={buttonSecondary}
      />
    );
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
    return (
      <SetupWizardPage
        wizardForm={wizardForm}
        setWizardForm={setWizardForm}
        wizardSaving={wizardSaving}
        completeSetupWizard={completeSetupWizard}
        authUser={authUser}
        colours={colours}
        cardStyle={cardStyle}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
        buttonPrimary={buttonPrimary}
        buttonSecondary={buttonSecondary}
      />
    );
    }

    if (profile?.accountStatus === "closed") {
    return (
      <div style={{ minHeight: "100vh", background: colours.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>[locked]</div>
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
        * { box-sizing: border-box; }
        .sas-layout { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
        .sas-sidebar {
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(12px);
          border-right: 1px solid #E2E8F0;
          padding: 22px 18px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          z-index: 100;
        }
        .sas-sidebar button { transition: all 0.18s ease; }
        .sas-sidebar button:hover { transform: translateX(2px); }
        .sas-overlay { display: none; }
        .sas-hamburger { display: none; }
        .sas-main {
          padding: 28px;
          overflow-x: auto;
          background:
            radial-gradient(circle at top right, rgba(106, 27, 154, 0.06), transparent 22%),
            linear-gradient(180deg, #F8FAFC 0%, #F4F7FB 100%);
        }
        .sas-page-wrap { width: 100%; overflow-x: auto; }
        .sas-page-inner { min-width: 0; }
        .sas-page-panel {
          display: grid;
          gap: 22px;
          width: 100%;
        }
        .sas-inline-page-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 22px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
          padding: 22px;
        }
        .sas-inline-page-card h1,
        .sas-inline-page-card h2,
        .sas-inline-page-card h3 { overflow-wrap: anywhere; }
        .sas-section-card,
        .sas-summary-box,
        .sas-metric-card,
        .sas-action-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .sas-section-card:hover,
        .sas-summary-box:hover,
        .sas-metric-card:hover,
        .sas-action-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
        }
        .sas-section-card { overflow: hidden; }
        .sas-summary-box { min-height: 124px; }
        .sas-dashboard-hero .sas-hero-title { word-break: break-word; overflow-wrap: anywhere; }
        .sas-dashboard-hero .sas-hero-subtitle { word-break: break-word; }
        .sas-dashboard-hero .sas-insight-chip { backdrop-filter: blur(6px); }
        .sas-table-wrap {
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          background: #FFFFFF;
        }
        .sas-data-table th {
          background: #F8FAFC;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sas-data-table th,
        .sas-data-table td {
          padding: 14px 16px !important;
          border-bottom: 1px solid #E2E8F0;
          vertical-align: top;
        }
        .sas-data-table tbody tr:hover td { background: #FCFCFD; }
        input, select, textarea, button { font-family: inherit; }
        input, select, textarea {
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #6A1B9A !important;
          box-shadow: 0 0 0 3px rgba(106, 27, 154, 0.12);
        }
        button { transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease; }
        button:hover { box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
        button:active { transform: translateY(1px); }
        @media (max-width: 1080px) {
          .sas-layout { grid-template-columns: 230px minmax(0, 1fr); }
          .sas-main { padding: 22px; }
        }
        @media (max-width: 768px) {
          .sas-layout { grid-template-columns: 1fr; }
          .sas-sidebar {
            position: fixed;
            top: 0;
            left: -272px;
            width: 248px;
            height: 100vh;
            overflow-y: auto;
            transition: left 0.25s ease;
            z-index: 200;
            box-shadow: 10px 0 30px rgba(15, 23, 42, 0.18);
          }
          .sas-sidebar.open { left: 0; }
          .sas-overlay { display: block; position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 199; }
          .sas-hamburger {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255,255,255,0.96);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid #E2E8F0;
            padding: 14px 16px;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .sas-hamburger-btn { background: none; border: none; cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 5px; box-shadow: none !important; }
          .sas-hamburger-btn span { display: block; width: 22px; height: 2px; background: #6A1B9A; border-radius: 2px; }
          .sas-main { padding: 16px; }
          .sas-page-wrap { overflow-x: auto; }
          .sas-page-inner { max-width: 100% !important; }
          .sas-inline-page-card { padding: 16px; border-radius: 18px; }
          .sas-dashboard-hero.sas-hero-grid { grid-template-columns: 1fr !important; gap: 16px !important; padding: 20px !important; border-radius: 20px !important; }
          .sas-dashboard-hero .sas-hero-title { font-size: 28px !important; line-height: 1.15 !important; }
          .sas-dashboard-hero .sas-hero-subtitle { font-size: 14px !important; line-height: 1.55 !important; }
          .sas-dashboard-hero .sas-hero-focus-card { padding: 18px !important; min-height: auto !important; }
          .sas-dashboard-hero .sas-hero-focus-value { font-size: 24px !important; line-height: 1.1 !important; word-break: break-word; }
          .sas-data-table { min-width: 680px !important; }
          .sas-summary-box, .sas-metric-card, .sas-action-card { min-height: auto !important; }
        }
        @media (max-width: 480px) {
          .sas-main { padding: 12px; }
          .sas-inline-page-card { padding: 14px; }
          .sas-dashboard-hero .sas-hero-title { font-size: 24px !important; }
          .sas-section-card, .sas-summary-box, .sas-metric-card, .sas-action-card { border-radius: 18px !important; }
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
            <div className="sas-page-inner sas-page-panel" style={{ maxWidth: 1480, margin: "0 auto" }}>
            {activePage === "dashboard" && <DashboardPage
              profile={profile} clients={clients} invoices={invoices} quotes={quotes}
              expenses={expenses} documents={documents} services={services}
              totals={totals} invoiceAllocations={invoiceAllocations}
              monthlyFinance={monthlyFinance} clientRevenueRows={clientRevenueRows}
              expenseCategoryRows={expenseCategoryRows} invoiceStatusRows={invoiceStatusRows}
              recentActivityRows={recentActivityRows} dashboardInsights={dashboardInsights}
              financialInsights={financialInsights}
              setActivePage={setActivePage} setActiveSettingsTab={setActiveSettingsTab}
              cardStyle={cardStyle} colours={colours} currency={currency}
              formatDateAU={formatDateAU} safeNumber={safeNumber}
              DEFAULT_MONTHLY_SUBSCRIPTION={DEFAULT_MONTHLY_SUBSCRIPTION}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              ActionHubCard={ActionHubCard} TrendBarsCard={TrendBarsCard}
              WaterfallCard={WaterfallCard} ActivityListCard={ActivityListCard}
              SectionCard={SectionCard} DataTable={DataTable}
              exportToATOForm={exportToATOForm}
              restorePortalStateFromSupabase={restorePortalStateFromSupabase}
              saveAllCurrentStateToSupabase={saveAllCurrentStateToSupabase}
              supabaseSyncStatus={supabaseSyncStatus} getClientName={getClientName}
            />}
            {activePage === "financial insights" && <FinancialInsightsPage
              profile={profile} totals={totals} invoiceAllocations={invoiceAllocations}
              monthlyFinance={monthlyFinance} clientRevenueRows={clientRevenueRows}
              expenseCategoryRows={expenseCategoryRows} financialInsights={financialInsights}
              setActivePage={setActivePage} cardStyle={cardStyle} colours={colours}
              currency={currency} formatDateAU={formatDateAU} safeNumber={safeNumber}
              todayLocal={todayLocal}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              TrendBarsCard={TrendBarsCard} WaterfallCard={WaterfallCard}
              SectionCard={SectionCard} ActionHubCard={ActionHubCard} DataTable={DataTable}
            />}
            {activePage === "invoices" && <InvoicesPage
              profile={profile} clients={clients} invoices={invoices} services={services}
              invoiceForm={invoiceForm} setInvoiceForm={setInvoiceForm}
              invoiceWizardStep={invoiceWizardStep} setInvoiceWizardStep={setInvoiceWizardStep}
              invoiceEditorOpen={invoiceEditorOpen} invoiceEditorForm={invoiceEditorForm}
              setInvoiceEditorForm={setInvoiceEditorForm}
              savingInvoice={savingInvoice} savingInvoiceEdits={savingInvoiceEdits}
              invClientSearch={invClientSearch} setInvClientSearch={setInvClientSearch}
              showARCreditNoteModal={showARCreditNoteModal} setShowARCreditNoteModal={setShowARCreditNoteModal}
              creditNoteSource={creditNoteSource} setCreditNoteSource={setCreditNoteSource}
              creditNoteForm={creditNoteForm} setCreditNoteForm={setCreditNoteForm}
              setActivePage={setActivePage} confirm={confirm}
              cardStyle={cardStyle} colours={colours} currency={currency}
              formatDateAU={formatDateAU} safeNumber={safeNumber} todayLocal={todayLocal}
              addDays={addDays} formatCurrencyByCode={formatCurrencyByCode}
              getClientCurrencyCode={getClientCurrencyCode}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle} GST_TYPE_OPTIONS={GST_TYPE_OPTIONS}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              saveInvoice={saveInvoice} saveInvoiceEdits={saveInvoiceEdits}
              openInvoiceEditor={openInvoiceEditor} closeInvoiceEditor={closeInvoiceEditor}
              deleteInvoice={deleteInvoice} markInvoicePaid={markInvoicePaid}
              openSavedInvoicePreview={openSavedInvoicePreview} openInvoicePreview={openInvoicePreview}
              saveARCreditNote={saveARCreditNote}
              createStripeCheckoutForInvoice={createStripeCheckoutForInvoice}
              payInvoiceWithStripe={payInvoiceWithStripe}
              getClientName={getClientName} getClientById={getClientById}
              clientIsGstExempt={clientIsGstExempt} gstAppliesToClient={gstAppliesToClient}
              calculateFormGst={calculateFormGst} computeLineItemTotals={computeLineItemTotals}
              getDocumentBusinessName={getDocumentBusinessName} getDocumentAddress={getDocumentAddress}
              invoiceAllocations={invoiceAllocations} totals={totals}
              calculateAdjustmentValues={calculateAdjustmentValues}
              sendInvoiceFromPreview={sendInvoiceFromPreview}
              setClientModalForm={setClientModalForm} setEditingClientId={setEditingClientId}
              setShowClientModal={setShowClientModal} setImportType={setImportType}
              setImportRows={setImportRows} setImportError={setImportError}
              setShowImportModal={setShowImportModal}
            />}
            {activePage === "quotes" && <QuotesPage
              profile={profile} clients={clients} invoices={invoices}
              quotes={quotes} services={services}
              quoteForm={quoteForm} setQuoteForm={setQuoteForm}
              quoteWizardStep={quoteWizardStep} setQuoteWizardStep={setQuoteWizardStep}
              quoteEditorOpen={quoteEditorOpen} quoteEditorForm={quoteEditorForm}
              setQuoteEditorForm={setQuoteEditorForm}
              savingQuote={savingQuote} savingQuoteEdits={savingQuoteEdits}
              quoteClientSearch={quoteClientSearch} setQuoteClientSearch={setQuoteClientSearch}
              setActivePage={setActivePage} confirm={confirm}
              cardStyle={cardStyle} colours={colours} currency={currency}
              formatDateAU={formatDateAU} safeNumber={safeNumber} todayLocal={todayLocal}
              addDays={addDays} formatCurrencyByCode={formatCurrencyByCode}
              getClientCurrencyCode={getClientCurrencyCode}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle} GST_TYPE_OPTIONS={GST_TYPE_OPTIONS}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              saveQuote={saveQuote} saveQuoteEdits={saveQuoteEdits}
              openQuoteEditor={openQuoteEditor} closeQuoteEditor={closeQuoteEditor}
              deleteQuote={deleteQuote} openSavedQuotePreview={openSavedQuotePreview}
              getClientName={getClientName} getClientById={getClientById}
              clientIsGstExempt={clientIsGstExempt} gstAppliesToClient={gstAppliesToClient}
              calculateFormGst={calculateFormGst} computeLineItemTotals={computeLineItemTotals}
              calculateAdjustmentValues={calculateAdjustmentValues}
              sendQuoteFromPreview={sendQuoteFromPreview}
              convertQuoteToInvoice={convertQuoteToInvoice}
              openQuotePreview={openQuotePreview}
              setClientModalForm={setClientModalForm} setEditingClientId={setEditingClientId}
              setShowClientModal={setShowClientModal} setImportType={setImportType}
              setImportRows={setImportRows} setImportError={setImportError}
              setShowImportModal={setShowImportModal}
            />}
            {activePage === "clients" && <ClientsPage
              profile={profile} clients={clients} invoices={invoices}
              setActivePage={setActivePage} confirm={confirm}
              cardStyle={cardStyle} colours={colours} currency={currency}
              safeNumber={safeNumber} buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              showClientModal={showClientModal} setShowClientModal={setShowClientModal}
              showImportModal={showImportModal} setShowImportModal={setShowImportModal}
              editingClientId={editingClientId} setEditingClientId={setEditingClientId}
              clientModalForm={clientModalForm} setClientModalForm={setClientModalForm}
              importType={importType} setImportType={setImportType}
              importRows={importRows} setImportRows={setImportRows}
              importError={importError} setImportError={setImportError}
              invClientSearch={invClientSearch} setInvClientSearch={setInvClientSearch}
              saveClientFromModal={saveClientFromModal} deleteClient={deleteClient}
              confirmImport={confirmImport} downloadTemplate={downloadTemplate}
              parseImportCSV={parseImportCSV} openClientEditor={openClientEditor}
              blankClient={blankClient}
              clientForm={clientForm} setClientForm={setClientForm}
              saveClient={saveClient}
              clientEditorOpen={clientEditorOpen} clientEditorForm={clientEditorForm}
              setClientEditorForm={setClientEditorForm}
              closeClientEditor={closeClientEditor} saveClientEdits={saveClientEdits}
              todayLocal={todayLocal}
            />}
            {activePage === "services" && <ServicesPage
              services={services} serviceSearch={serviceSearch} setServiceSearch={setServiceSearch}
              showServiceModal={showServiceModal} setShowServiceModal={setShowServiceModal}
              editingServiceId={editingServiceId}
              serviceForm={serviceForm} setServiceForm={setServiceForm} savingService={savingService}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              safeNumber={safeNumber} currency={currency}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              GST_TYPE_OPTIONS={GST_TYPE_OPTIONS}
              openNewServiceModal={openNewServiceModal} openEditServiceModal={openEditServiceModal}
              saveService={saveService} deleteService={deleteService}
              handleServiceFormChange={handleServiceFormChange}
            />}
            {activePage === "expenses" && <ExpensesPage
              expenses={expenses} expenseForm={expenseForm} setExpenseForm={setExpenseForm}
              savingExpense={savingExpense} receiptFile={receiptFile} setReceiptFile={setReceiptFile}
              expenseEditorOpen={expenseEditorOpen} expenseEditorForm={expenseEditorForm}
              setExpenseEditorForm={setExpenseEditorForm}
              expenseModalOpen={expenseModalOpen} setExpenseModalOpen={setExpenseModalOpen}
              expenseTypeStep={expenseTypeStep} setExpenseTypeStep={setExpenseTypeStep}
              expenseTypeSelection={expenseTypeSelection} setExpenseTypeSelection={setExpenseTypeSelection}
              expenseWorkType={expenseWorkType} setExpenseWorkType={setExpenseWorkType}
              expenseWorkTypes={expenseWorkTypes} setExpenseWorkTypes={setExpenseWorkTypes}
              expenseCategorySelection={expenseCategorySelection}
              setExpenseCategorySelection={setExpenseCategorySelection}
              searchExpenseCategory={searchExpenseCategory}
              setSearchExpenseCategory={setSearchExpenseCategory}
              confirm={confirm} setActivePage={setActivePage}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              currency={currency} formatDateAU={formatDateAU} safeNumber={safeNumber}
              todayLocal={todayLocal} expenseCategories={expenseCategories}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              ExpenseTypeModal={ExpenseTypeModal}
              saveExpense={saveExpense} deleteExpense={deleteExpense}
              openExpenseEditor={openExpenseEditor} closeExpenseEditor={closeExpenseEditor}
              saveExpenseEdits={saveExpenseEdits}
              resetExpenseModal={resetExpenseModal} nextExpenseModalStep={nextExpenseModalStep}
              totals={totals} uploadReceiptToSupabase={uploadReceiptToSupabase}
            />}
            {activePage === "bills / payables" && <BillsPage
              profile={profile} expenses={expenses} suppliers={suppliers} clients={clients}
              expenseForm={expenseForm} setExpenseForm={setExpenseForm}
              billLineItems={billLineItems} setBillLineItems={setBillLineItems}
              billWizardStep={billWizardStep} setBillWizardStep={setBillWizardStep}
              savingBill={savingBill} receiptFile={receiptFile} setReceiptFile={setReceiptFile}
              showSupplierModal={showSupplierModal} setShowSupplierModal={setShowSupplierModal}
              supplierForm={supplierForm} setSupplierForm={setSupplierForm}
              editingSupplierId={editingSupplierId} setEditingSupplierId={setEditingSupplierId}
              showAPCreditNoteModal={showAPCreditNoteModal} setShowAPCreditNoteModal={setShowAPCreditNoteModal}
              creditNoteSource={creditNoteSource} setCreditNoteSource={setCreditNoteSource}
              creditNoteForm={creditNoteForm} setCreditNoteForm={setCreditNoteForm}
              setActivePage={setActivePage} confirm={confirm}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              currency={currency} formatDateAU={formatDateAU} safeNumber={safeNumber}
              todayLocal={todayLocal} addDaysEOM={addDaysEOM}
              expenseCategories={expenseCategories} GST_TYPE_OPTIONS={GST_TYPE_OPTIONS}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              saveExpense={saveExpense} deleteExpense={deleteExpense}
              markBillPaid={markBillPaid} markBillUnpaid={markBillUnpaid}
              sendExpenseDirect={sendExpenseDirect}
              saveSupplier={saveSupplier} deleteSupplier={deleteSupplier}
              saveAPCreditNote={saveAPCreditNote}
              getClientName={getClientName} totals={totals}
              blankBillLine={blankBillLine} saveBill={saveBill}
              openExpenseEditor={openExpenseEditor}
              setImportType={setImportType} setImportRows={setImportRows}
              setImportError={setImportError} setShowImportModal={setShowImportModal}
            />}
            {activePage === "income sources" && <IncomeSourcesPage
              incomeSources={incomeSources}
              showIncomeSourceModal={showIncomeSourceModal}
              setShowIncomeSourceModal={setShowIncomeSourceModal}
              incomeSourceForm={incomeSourceForm} setIncomeSourceForm={setIncomeSourceForm}
              savingIncomeSource={savingIncomeSource}
              incomeSourceEditorOpen={incomeSourceEditorOpen}
              incomeSourceEditorForm={incomeSourceEditorForm}
              setIncomeSourceEditorForm={setIncomeSourceEditorForm}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              currency={currency} safeNumber={safeNumber}
              incomeTypeOptions={incomeTypeOptions} incomeFrequencyOptions={incomeFrequencyOptions}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              MiniBarChart={MiniBarChart} IncomeSourceModal={IncomeSourceModal}
              saveIncomeSource={saveIncomeSource} deleteIncomeSource={deleteIncomeSource}
            />}
            {activePage === "documents" && <DocumentsPage
              documents={documents} documentFile={documentFile} setDocumentFile={setDocumentFile}
              documentEditorOpen={documentEditorOpen} documentEditorForm={documentEditorForm}
              setDocumentEditorForm={setDocumentEditorForm}
              savingDocumentEdits={savingDocumentEdits}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              formatDateAU={formatDateAU} safeNumber={safeNumber}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable} EmptyState={EmptyState}
              MiniBarChart={MiniBarChart}
              uploadDocument={uploadDocument} deleteDocument={deleteDocument}
              openDocumentEditor={openDocumentEditor} closeDocumentEditor={closeDocumentEditor}
              saveDocumentEdits={saveDocumentEdits}
            />}
            {activePage === "ato tax form" && (
              <div className="sas-inline-page-card">
                <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: colours.muted }}>Admin workspace</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: colours.text }}>ATO Tax Form</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: colours.muted }}>Review income, expenses and tax values in the same clean card layout used across the rest of your portal.</div>
                </div>
                <ATOTaxFormPage
                  profile={profile} invoices={invoices} expenses={expenses}
                  incomeSources={incomeSources} getClientById={getClientById}
                />
              </div>
            )}
            {activePage === "bas report" && (
              <div className="sas-inline-page-card">
                <BASReportPage
                  profile={profile} invoices={invoices} expenses={expenses}
                  invoiceAllocations={invoiceAllocations} totals={totals}
                  basQuarter={basQuarter} setBasQuarter={setBasQuarter}
                  basNotes={basNotes} setBasNotes={setBasNotes}
                  colours={colours} cardStyle={cardStyle}
                  buttonPrimary={buttonPrimary} inputStyle={inputStyle} labelStyle={labelStyle}
                  currency={currency} formatDateAU={formatDateAU} safeNumber={safeNumber}
                  DashboardHero={DashboardHero} InsightChip={InsightChip}
                  SectionCard={SectionCard} SummaryBox={SummaryBox}
                  setActivePage={setActivePage}
                />
              </div>
            )}
            {activePage === "settings" && <SettingsPage
              profile={profile} setProfile={setProfile}
              activeSettingsTab={activeSettingsTab} setActiveSettingsTab={setActiveSettingsTab}
              savingClient={savingClient}
              newPassword={newPassword} setNewPassword={setNewPassword}
              newPasswordConfirm={newPasswordConfirm} setNewPasswordConfirm={setNewPasswordConfirm}
              isResettingPassword={isResettingPassword} setIsResettingPassword={setIsResettingPassword}
              colours={colours} cardStyle={cardStyle}
              buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
              inputStyle={inputStyle} labelStyle={labelStyle}
              currency={currency} safeNumber={safeNumber} isValidEmail={isValidEmail}
              DEFAULT_MONTHLY_SUBSCRIPTION={DEFAULT_MONTHLY_SUBSCRIPTION}
              settingsTabs={settingsTabs}
              DashboardHero={DashboardHero} InsightChip={InsightChip} MetricCard={MetricCard}
              SectionCard={SectionCard} DataTable={DataTable}
              saveProfileToSupabase={saveProfileToSupabase}
              handleCloseAccount={handleCloseAccount} handleSignOut={handleSignOut}
              toast={toast}
            />}
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

      {/* -- Password Reset Sent Modal -- */}
      {showResetSentModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 36, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>[email]</div>
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

      {/* -- Import Modal -- */}
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
              <div style={{ fontSize: 13, fontWeight: 800, color: colours.purple, marginBottom: 10 }}>[clipboard] How to import</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colours.text, lineHeight: 2 }}>
                <li>Click <strong>Download Template</strong> below to get the Excel/CSV file</li>
                <li>Open it in Excel or Google Sheets</li>
                <li>Fill in your {importType} -- <strong>Name is required</strong>, all other columns are optional</li>
                <li>Save as <strong>CSV</strong> (File - Save As - CSV)</li>
                <li>Click <strong>Choose File</strong> below and select your saved CSV</li>
                <li>Review the preview, then click <strong>Confirm Import</strong></li>
              </ol>
              <div style={{ marginTop: 12, fontSize: 12, color: colours.muted }}>
                (i) Duplicates are skipped automatically -- existing {importType} with the same name won't be overwritten.
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
              Download {importType === "clients" ? "Clients" : "Suppliers"} Template
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
                <div style={{ fontSize: 13, fontWeight: 800, color: colours.text, marginBottom: 8 }}>Preview -- {importRows.length} row{importRows.length !== 1 ? "s" : ""} ready to import</div>
                <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${colours.border}`, borderRadius: 10 }}>
                  {importRows.slice(0, 10).map((row, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${colours.border}`, fontSize: 13 }}>
                      <strong>{row.name}</strong>
                      {row.businessName && <span style={{ color: colours.muted }}> -- {row.businessName}</span>}
                      {row.email && <span style={{ color: colours.muted }}> . {row.email}</span>}
                      {row.phone && <span style={{ color: colours.muted }}> . {row.phone}</span>}
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

      {/* -- Client Modal -- */}
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
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
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

      {/* -- Supplier Modal -- */}
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

      {/* -- AR Credit Note Modal -- */}
      {showARCreditNoteModal && creditNoteSource && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99996, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 4 }}>AR Credit Note</div>
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 20 }}>
              Against invoice <strong>{creditNoteSource.invoiceNumber || creditNoteSource.id}</strong> -- {getClientName(creditNoteSource.clientId)}
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

      {/* -- AP Credit Note Modal -- */}
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
      {/* -- Recurring Invoices Modal -- */}
      {showRecurringModal && recurringDue.length > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99996, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 28 }}>[repeat]</div>
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
                      {inv.recurs} . Due {formatDateAU(inv.dueRecurDate)} . {currency(safeNumber(inv.total))}
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
              <div style={{ fontSize: 28 }}>[bell]</div>
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
                  <div style={{ fontSize: 18 }}>{alert.type === "overdue" ? "[red]" : alert.type === "today" ? "[orange]" : "[yellow]"}</div>
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
