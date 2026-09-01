import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import "./styles.css";

const DEFAULT_ENDPOINT = "https://sec.bpi.ir/prls/api/v1/inquiry/chequeStatus";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const STATUS_META = {
  VALID_SUCCESS: { label: "موفق", tone: "success", icon: "check" },
  SUCCESS_NO_BALANCES: { label: "موفق، بدون مانده", tone: "success", icon: "check" },
  NOT_FOUND: { label: "یافت نشد", tone: "warning", icon: "question" },
  RATE_LIMITED: { label: "محدودیت نرخ", tone: "warning", icon: "clock" },
  AUTH_REQUIRED: { label: "نیاز به احراز", tone: "danger", icon: "lock" },
  CORS_OR_AUTH_REQUIRED: { label: "نیاز به دسترسی", tone: "danger", icon: "lock" },
  ENDPOINT_ERROR: { label: "خطای نشانی", tone: "danger", icon: "alert" },
  UNRESOLVED: { label: "حل‌نشده", tone: "muted", icon: "question" },
  PENDING: { label: "در راه", tone: "info", icon: "clock" },
};

const STATUS_ALIASES = {
  success: ["valid_success", "success", "successful", "موفق", "با موفقیت", "تسویه شده", "تسویه"],
  notFound: ["not_found", "not found", "notfound", "عدم وجود", "یافت نشد", "نامعتبر"],
  rate: ["rate_limited", "429", "محدودیت", "too many"],
  auth: ["auth_required", "unauthorized", "forbidden", "احراز", "ورود", "captcha"],
  unresolved: ["unresolved", "حل نشده", "حل‌نشده"],
};

const BALANCE_ALIASES = {
  ongoing: ["ongoing", "current", "در جریان", "جاری", "مبالغ ongoing", "مبلغ جاری"],
  blocked: ["blocked", "مسدود", "مبالغ blocked", "مبلغ مسدود"],
  bounced: ["bounced", "برگشتی", "مبالغ bounced", "مبلغ برگشتی"],
  cleared: ["cleared", "تسویه", "تسویه شده", "مبالغ cleared", "مبلغ تسویه"],
};

const NAV_ITEMS = [
  { key: "dashboard", label: "داشبورد", icon: "home" },
  { key: "inquiries", label: "استعلام‌ها", icon: "search" },
  { key: "files", label: "فایل‌ها", icon: "folder" },
  { key: "reports", label: "گزارش‌ها", icon: "chart" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    folder: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></>,
    chart: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-8" /><path d="M22 19V3" /></>,
    settings: <><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" /><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2A2 2 0 0 0 5.8 18l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12H1.5a2 2 0 0 1 0-4h.2A2 2 0 0 0 3 4.6l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A2 2 0 0 0 9.2.4V.2a2 2 0 0 1 4 0v.2A2 2 0 0 0 16.6 3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A2 2 0 0 0 20.8 9h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.4 2Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9.2a2.5 2.5 0 1 1 3.9 2.1c-1 .6-1.7 1-1.7 2.2" /><path d="M12 17h.01" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    question: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9.2a2.5 2.5 0 1 1 3.9 2.1c-1 .6-1.7 1-1.7 2.2" /><path d="M12 17h.01" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    alert: <><path d="M12 3 2.8 19a1.6 1.6 0 0 0 1.4 2.4h15.6a1.6 1.6 0 0 0 1.4-2.4z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>,
    play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
    stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-3.9L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.7 3.9L20 15" /><path d="M20 20v-5h-5" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  };
  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function normalizeText(value) {
  return normalizeDigits(value)
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\u200c/g, " ")
    .trim();
}

function compactLabel(value) {
  return normalizeText(value).toLowerCase().replace(/[\s\-_:/|\\(){}\[\]؛،,.`'"؟?]+/g, "");
}

function digitsOnly(value) {
  return normalizeText(value).replace(/[,٬\s]/g, "").replace(/\.0+$/, "");
}

function parseNid(value) {
  const text = digitsOnly(value);
  return /^\d{10}$/.test(text) && !/^0{10}$/.test(text) ? text : "";
}

function parseSayad(value) {
  const text = digitsOnly(value);
  if (/^\d{16}$/.test(text)) return text;
  const match = text.match(/(?<!\d)(\d{16})(?!\d)/);
  return match?.[1] || "";
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const text = normalizeText(value).replace(/[,٬\s]/g, "");
  return /^\d+(?:\.0+)?$/.test(text) ? Number(text) : null;
}

function formatAmount(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("fa-IR").format(Number(value));
}

function formatCount(value) {
  return new Intl.NumberFormat("fa-IR").format(value || 0);
}

function formatDateTime(value = new Date()) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function headerMatch(header, aliases) {
  const compact = compactLabel(header);
  return aliases.some((alias) => compact === compactLabel(alias));
}

const HEADER_ALIASES = {
  sayad: ["شماره صیادی", "شناسه صیادی", "شناسه صیاد", "sayad id", "sayadid", "cheque id", "کد صیاد", "چک|شرح", "شرح چک", "شرح"],
  amount: ["مبلغ چک", "چک|مبلغ", "مبلغ", "cheque amount", "amount"],
  issuerNid: ["کد ملی صادرکننده", "شناسه صادرکننده", "کدملی صادرکننده", "issuer nid", "issuer national id", "شناسه ملی صادرکننده"],
  holderNid: ["کد ملی holder", "کد ملی دارنده", "کدملی دارنده", "شناسه دارنده", "holder nid", "holder national id", "idcode"],
  name: ["نام صادرکننده", "نام مشتری", "نام دارنده", "issuer name", "customer name", "نام"],
  chequeNo: ["شماره چک", "شماره", "cheque number", "check number"],
  status: ["وضعیت", "status", "نتیجه", "classification"],
  ongoing: ["مبالغ ongoing", "ongoing", "مبلغ جاری"],
  blocked: ["blocked", "مبالغ blocked", "مبلغ مسدود"],
  bounced: ["bounced", "مبالغ bounced", "مبلغ برگشتی"],
  cleared: ["cleared", "مبالغ cleared", "مبلغ تسویه"],
};

function findHeaderRow(matrix) {
  let best = { index: -1, score: 0 };
  matrix.slice(0, 12).forEach((row, index) => {
    const score = Object.values(HEADER_ALIASES).reduce((total, aliases) => total + (row.some((cell) => headerMatch(cell, aliases)) ? 1 : 0), 0);
    if (score > best.score) best = { index, score };
  });
  return best.index >= 0 && best.score >= 1 ? best.index : 0;
}

function findColumns(headers) {
  const columns = {};
  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    const index = headers.findIndex((header) => headerMatch(header, aliases));
    if (index >= 0) columns[key] = index;
  });
  return columns;
}

function cell(row, columns, key) {
  return columns[key] === undefined ? "" : row[columns[key]] ?? "";
}

function normalizeStatus(value) {
  const text = normalizeText(value);
  const compact = compactLabel(text);
  if (!text) return "PENDING";
  if (STATUS_ALIASES.success.some((item) => compact.includes(compactLabel(item)))) return "VALID_SUCCESS";
  if (STATUS_ALIASES.rate.some((item) => compact.includes(compactLabel(item)))) return "RATE_LIMITED";
  if (STATUS_ALIASES.auth.some((item) => compact.includes(compactLabel(item)))) return "AUTH_REQUIRED";
  if (STATUS_ALIASES.notFound.some((item) => compact.includes(compactLabel(item)))) return "NOT_FOUND";
  if (STATUS_ALIASES.unresolved.some((item) => compact.includes(compactLabel(item)))) return "UNRESOLVED";
  if (STATUS_META[text]) return text;
  return "UNRESOLVED";
}

async function parseWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
  const parsedRows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    if (!matrix.length) return;
    const headerIndex = findHeaderRow(matrix);
    const headers = matrix[headerIndex] || [];
    const columns = findColumns(headers);
    matrix.slice(headerIndex + 1).forEach((row, offset) => {
      const allText = row.map(normalizeText).join(" | ");
      const sayad = parseSayad(cell(row, columns, "sayad")) || parseSayad(allText);
      if (!sayad) return;
      const amount = parseAmount(cell(row, columns, "amount"));
      const issuerNid = parseNid(cell(row, columns, "issuerNid"));
      const holderNid = parseNid(cell(row, columns, "holderNid"));
      const current = {
        sequence: parsedRows.length + 1,
        sourceRow: headerIndex + offset + 2,
        sourceSheet: sheetName,
        chequeNo: normalizeText(cell(row, columns, "chequeNo")),
        issuerName: normalizeText(cell(row, columns, "name")),
        amount,
        sayadId: sayad,
        issuerNid,
        holderNid,
        status: normalizeStatus(cell(row, columns, "status")),
        ongoing: parseAmount(cell(row, columns, "ongoing")),
        blocked: parseAmount(cell(row, columns, "blocked")),
        bounced: parseAmount(cell(row, columns, "bounced")),
        cleared: parseAmount(cell(row, columns, "cleared")),
        attempts: Number(cell(row, columns, "attempts")) || 0,
        error: "",
      };
      parsedRows.push(current);
    });
  });

  const candidateMap = new Map();
  parsedRows.forEach((row) => {
    if (!candidateMap.has(row.sayadId)) {
      candidateMap.set(row.sayadId, { sayadId: row.sayadId, amount: row.amount, issuerName: row.issuerName, issuerNid: row.issuerNid, holderNids: new Set(), rowCount: 0 });
    }
    const candidate = candidateMap.get(row.sayadId);
    candidate.rowCount += 1;
    if (row.holderNid) candidate.holderNids.add(row.holderNid);
    if (row.amount !== null && candidate.amount === null) candidate.amount = row.amount;
    if (!candidate.issuerName && row.issuerName) candidate.issuerName = row.issuerName;
    if (!candidate.issuerNid && row.issuerNid) candidate.issuerNid = row.issuerNid;
  });
  const candidates = [...candidateMap.values()].map((candidate) => ({ ...candidate, holderNids: [...candidate.holderNids] }));
  return { rows: parsedRows, candidates, sheets: workbook.SheetNames, size: file.size };
}

function flattenPayload(value, path = "", output = []) {
  if (value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenPayload(item, `${path}[${index}]`, output));
    return output;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      const nextPath = path ? `${path}.${key}` : key;
      output.push({ key, path: nextPath, value: item });
      flattenPayload(item, nextPath, output);
    });
    return output;
  }
  output.push({ key: path.split(".").pop() || "value", path, value });
  return output;
}

function optionalAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return parseAmount(value);
}

function classifyPayload(httpStatus, payload, body) {
  const entries = flattenPayload(payload);
  const textBlob = `${entries.map((item) => `${item.key} ${item.value}`).join(" ")} ${body.slice(0, 4000)}`.toLowerCase();
  const compactBlob = compactLabel(textBlob);
  if (httpStatus === 401 || httpStatus === 403 || STATUS_ALIASES.auth.some((item) => compactBlob.includes(compactLabel(item)))) return { kind: "auth_required", reason: `http_${httpStatus || "unknown"}`, bankStatus: String(httpStatus || "") };
  if (httpStatus === 429) return { kind: "rate_limited", reason: "http_429", bankStatus: "429" };
  if (httpStatus === 404) return { kind: "endpoint_not_found", reason: "http_404", bankStatus: "404" };
  if (textBlob.includes("524") || compactBlob.includes("status524")) return { kind: "holder_mismatch", reason: "status_524", bankStatus: "524" };
  if (httpStatus >= 500) return { kind: "transient", reason: `http_${httpStatus}`, bankStatus: String(httpStatus) };
  if (STATUS_ALIASES.notFound.some((item) => compactBlob.includes(compactLabel(item)))) return { kind: "not_found", reason: "not_found", bankStatus: "" };

  const balances = {};
  let foundCount = 0;
  Object.entries(BALANCE_ALIASES).forEach(([name, aliases]) => {
    const entry = entries.find((item) => aliases.some((alias) => compactLabel(item.key).includes(compactLabel(alias)) || compactLabel(item.path).includes(compactLabel(alias))));
    const amount = entry ? optionalAmount(entry.value) : null;
    balances[name] = amount;
    if (entry && amount !== null) foundCount += 1;
  });
  const success = entries.some((item) => {
    const compact = compactLabel(item.value);
    return compact === "200" || compact === "success" || compact === "successful" || compact === "ok" || compact.includes("validsuccess") || compact.includes("موفق");
  }) || compactBlob.includes("validsuccess");
  if (foundCount) return { kind: "success", reason: "balance_fields_found", bankStatus: "", balances };
  if (success || (httpStatus >= 200 && httpStatus < 300 && entries.length > 0)) return { kind: "success_no_balances", reason: "success_without_balance_fields", bankStatus: "", balances };
  return { kind: "not_found", reason: "unrecognised_success_payload", bankStatus: "", balances };
}

async function fetchInquiry(endpoint, sayadId, holderNid, signal) {
  const url = new URL(endpoint);
  url.searchParams.set("IdCode", holderNid);
  url.searchParams.set("IdType", "1");
  url.searchParams.set("SayadId", sayadId);
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json, text/plain, */*" }, mode: "cors", signal });
  const body = await response.text();
  const trimmedBody = body.slice(0, MAX_BODY_BYTES);
  let payload = {};
  try { payload = trimmedBody ? JSON.parse(trimmedBody) : {}; } catch { payload = {}; }
  const parsed = classifyPayload(response.status, payload, trimmedBody);
  return { response, body: trimmedBody, parsed };
}

function buildResult(candidate, parsed, holderNid, attempts, error = "") {
  return {
    sayadId: candidate.sayadId,
    issuerName: candidate.issuerName || "",
    issuerNid: candidate.issuerNid || "",
    amount: candidate.amount ?? null,
    holderNid: holderNid || "",
    status: parsed?.status || "UNRESOLVED",
    ongoing: parsed?.balances?.ongoing ?? null,
    blocked: parsed?.balances?.blocked ?? null,
    bounced: parsed?.balances?.bounced ?? null,
    cleared: parsed?.balances?.cleared ?? null,
    attempts,
    error,
    bankStatus: parsed?.bankStatus || "",
    fetchedAt: new Date().toISOString(),
  };
}

function mergeResultIntoRows(rows, result) {
  return rows.map((row) => row.sayadId === result.sayadId ? { ...row, ...result } : row);
}

function parseHolderList(text) {
  return [...new Set(normalizeDigits(text).split(/[\s,،;؛|]+/).map(parseNid).filter(Boolean))];
}

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.UNRESOLVED;
}

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <span className={`status-badge tone-${meta.tone}`}><Icon name={meta.icon} size={15} />{meta.label}</span>;
}

function MetricCard({ title, value, percent, tone, icon }) {
  return <article className={`metric-card metric-${tone}`}>
    <div className="metric-icon"><Icon name={icon} size={23} /></div>
    <div className="metric-copy"><span>{title}</span><strong>{formatCount(value)}</strong><small>{percent}</small></div>
  </article>;
}

function EmptyTable({ hasFile }) {
  return <div className="empty-state">
    <div className="empty-icon"><Icon name={hasFile ? "refresh" : "file"} size={26} /></div>
    <strong>{hasFile ? "فایل برای استعلام آماده است" : "هنوز فایلی انتخاب نشده"}</strong>
    <span>{hasFile ? "شناسه‌های صیادی را بررسی کنید و استعلام تازه را شروع کنید." : "یک فایل Excel یا CSV از چک‌ها بارگذاری کنید."}</span>
  </div>;
}

function App() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [fileHolders, setFileHolders] = useState([]);
  const [holderText, setHolderText] = useState("");
  const [holdersConfirmed, setHoldersConfirmed] = useState(false);
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [rpm, setRpm] = useState(20);
  const [inquiryResults, setInquiryResults] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);
  const lastRequestRef = useRef(0);

  const displayRows = inquiryResults.length ? inquiryResults : parsedRows;
  const metrics = useMemo(() => {
    const total = displayRows.length;
    const count = (predicate) => displayRows.filter((row) => predicate(normalizeStatus(row.status))).length;
    const success = count((value) => value === "VALID_SUCCESS" || value === "SUCCESS_NO_BALANCES");
    const pending = count((value) => value === "PENDING");
    const unresolved = count((value) => ["UNRESOLVED", "NOT_FOUND", "AUTH_REQUIRED", "CORS_OR_AUTH_REQUIRED", "ENDPOINT_ERROR", "RATE_LIMITED"].includes(value));
    const bounced = displayRows.filter((row) => Number(row.bounced || 0) > 0 || normalizeText(row.status).includes("برگشتی")).length;
    const percent = (value) => total ? `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format((value / total) * 100)}٪` : "۰٪";
    return { total, success, pending, unresolved, bounced, successPercent: percent(success), pendingPercent: percent(pending), unresolvedPercent: percent(unresolved), bouncedPercent: percent(bounced) };
  }, [displayRows]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function showNotice(type, message) {
    setNotice({ type, message });
  }

  async function handleFile(file) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(extension)) {
      showNotice("error", "فرمت فایل پشتیبانی نمی‌شود؛ فایل xlsx، xls یا csv انتخاب کنید.");
      return;
    }
    setStatus("parsing");
    setNotice({ type: "info", message: "در حال خواندن فایل و پیدا کردن شناسه‌های صیادی…" });
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.rows.length) throw new Error("هیچ شناسهٔ صیادی ۱۶ رقمی در فایل پیدا نشد.");
      const inferredHolders = [...new Set(parsed.rows.map((row) => row.holderNid).filter(Boolean))];
      setSelectedFile(file);
      setFileInfo({ name: file.name, size: file.size, sheets: parsed.sheets, rowCount: parsed.rows.length, candidateCount: parsed.candidates.length });
      setParsedRows(parsed.rows);
      setCandidates(parsed.candidates);
      setInquiryResults([]);
      setAttempts([]);
      setFileHolders(inferredHolders);
      setHolderText(inferredHolders.join("\n"));
      setHoldersConfirmed(false);
      setProgress({ done: 0, total: parsed.candidates.length });
      setStatus("ready");
      showNotice("success", `${formatCount(parsed.rows.length)} ردیف و ${formatCount(parsed.candidates.length)} شناسهٔ یکتا آماده شد.`);
    } catch (error) {
      setStatus("idle");
      showNotice("error", error.message || "خواندن فایل ناموفق بود.");
    }
  }

  function onFileInput(event) {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function confirmHolders() {
    const holders = parseHolderList(holderText);
    if (!holders.length) {
      showNotice("error", "حداقل یک کد ملی ۱۰ رقمی دارنده ثبت کنید.");
      return;
    }
    setHolderText(holders.join("\n"));
    setHoldersConfirmed(true);
    showNotice("success", `${formatCount(holders.length)} شناسهٔ دارنده برای همین اجرا ثبت شد.`);
  }

  async function waitForRateLimit() {
    const interval = 60000 / Math.max(1, Number(rpm) || 20);
    const now = Date.now();
    const wait = Math.max(0, interval - (now - lastRequestRef.current));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestRef.current = Date.now();
  }

  async function runCandidate(candidate, globalHolders) {
    // The confirmed list is the source of truth. File-derived holder IDs are
    // only suggestions in the form; never send an ID the user removed.
    const holders = globalHolders;
    if (!holders.length) return { result: buildResult(candidate, { status: "UNRESOLVED" }, "", 0, "no_registered_holder"), logs: [] };
    const logs = [];
    let lastParsed = { status: "UNRESOLVED", bankStatus: "" };
    let lastError = "";
    let lastHolder = holders[holders.length - 1];
    for (const holder of holders) {
      lastHolder = holder;
      for (let retry = 0; retry < 3; retry += 1) {
        if (cancelledRef.current) return { result: buildResult(candidate, { status: "UNRESOLVED" }, holder, logs.length, "cancelled"), logs };
        await waitForRateLimit();
        const started = Date.now();
        let classification = null;
        let body = "";
        let httpStatus = null;
        try {
          const response = await fetchInquiry(endpoint, candidate.sayadId, holder, abortRef.current.signal);
          httpStatus = response.response.status;
          body = response.body;
          classification = response.parsed;
          lastParsed = classification;
          lastError = classification.reason || "";
        } catch (error) {
          if (error.name === "AbortError") throw error;
          classification = { kind: "cors_or_auth", reason: "cors_or_auth_required", bankStatus: "" };
          lastParsed = classification;
          lastError = "CORS یا احراز هویت مرورگر اجازهٔ اتصال نداد.";
        }
        logs.push({ sayadId: candidate.sayadId, holderNid: holder, retryIndex: retry, httpStatus, classification: classification.kind, error: classification.reason || "", responseExcerpt: body.slice(0, 500), elapsedMs: Date.now() - started, timestamp: new Date().toISOString() });
        if (classification.kind === "success" || classification.kind === "success_no_balances") {
          return { result: buildResult(candidate, { status: classification.kind === "success" ? "VALID_SUCCESS" : "SUCCESS_NO_BALANCES", balances: classification.balances, bankStatus: classification.bankStatus }, holder, logs.length), logs };
        }
        if (classification.kind === "auth_required" || classification.kind === "cors_or_auth") {
          return { result: buildResult(candidate, { status: classification.kind === "cors_or_auth" ? "CORS_OR_AUTH_REQUIRED" : "AUTH_REQUIRED", bankStatus: classification.bankStatus }, holder, logs.length, lastError), logs };
        }
        if (["holder_mismatch", "not_found", "endpoint_not_found"].includes(classification.kind)) break;
        if (retry < 2) await new Promise((resolve) => setTimeout(resolve, Math.min(60000, 1000 * (2 ** retry))));
      }
    }
    let finalStatus = "UNRESOLVED";
    if (logs.length && logs.every((log) => log.classification === "rate_limited")) finalStatus = "RATE_LIMITED";
    else if (logs.some((log) => log.classification === "endpoint_not_found")) finalStatus = "ENDPOINT_ERROR";
    else if (logs.length && logs.every((log) => ["holder_mismatch", "not_found"].includes(log.classification))) finalStatus = "NOT_FOUND";
    return { result: buildResult(candidate, { ...lastParsed, status: finalStatus }, lastHolder, logs.length, lastError), logs };
  }

  async function startInquiry() {
    if (status === "running") return;
    if (!candidates.length) {
      showNotice("error", "ابتدا فایل دارای شناسهٔ صیادی را بارگذاری کنید.");
      return;
    }
    const globalHolders = parseHolderList(holderText);
    if (!holdersConfirmed || !globalHolders.length) {
      showNotice("error", "برای جلوگیری از ارسال اشتباه، ابتدا شناسه‌های دارنده را بررسی و تأیید کنید.");
      return;
    }
    let parsedEndpoint;
    try { parsedEndpoint = new URL(endpoint); } catch { showNotice("error", "نشانی endpoint معتبر نیست."); return; }
    if (!/^https?:$/.test(parsedEndpoint.protocol)) { showNotice("error", "endpoint باید با http یا https شروع شود."); return; }
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    lastRequestRef.current = 0;
    setStatus("running");
    setInquiryResults(parsedRows.map((row) => ({ ...row, status: "PENDING", error: "" })));
    setAttempts([]);
    setProgress({ done: 0, total: candidates.length });
    setLastRun(new Date());
    setNotice({ type: "info", message: "استعلام تازه آغاز شد؛ نتیجه‌ها بدون صفرکردن مانده‌های نامشخص ثبت می‌شوند." });
    try {
      for (let index = 0; index < candidates.length; index += 1) {
        if (cancelledRef.current) break;
        const candidate = candidates[index];
        const { result, logs } = await runCandidate(candidate, globalHolders);
        setInquiryResults((previous) => mergeResultIntoRows(previous, result));
        setAttempts((previous) => [...previous, ...logs]);
        setProgress({ done: index + 1, total: candidates.length });
      }
      if (cancelledRef.current) {
        setStatus("ready");
        showNotice("info", "استعلام متوقف شد؛ نتیجه‌های دریافت‌شده قابل دانلود هستند.");
      } else {
        setStatus("done");
        setLastRun(new Date());
        showNotice("success", "استعلام به پایان رسید؛ پاسخ‌های نامشخص با مقدار خالی نگه داشته شدند.");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("ready");
        showNotice("info", "استعلام متوقف شد؛ نتیجه‌های دریافت‌شده قابل دانلود هستند.");
      } else {
        setStatus("ready");
        showNotice("error", `استعلام متوقف شد: ${error.message || "خطای ناشناخته"}`);
      }
    } finally {
      abortRef.current = null;
    }
  }

  function stopInquiry() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  function downloadWorkbook() {
    if (!displayRows.length) {
      showNotice("error", "برای ساخت Excel ابتدا فایل را بارگذاری کنید.");
      return;
    }
    const workbook = XLSX.utils.book_new();
    const resultRows = displayRows.map((row, index) => ({
      "ردیف": index + 1,
      "نام صادرکننده": row.issuerName || "",
      "مبلغ چک": row.amount ?? "",
      "شماره صیادی": row.sayadId || "",
      "کد ملی صادرکننده": row.issuerNid || "",
      "کد ملی دارنده": row.holderNid || "",
      "وضعیت": row.status || "",
      "مبالغ ongoing": row.ongoing ?? "",
      "blocked": row.blocked ?? "",
      "bounced": row.bounced ?? "",
      "cleared": row.cleared ?? "",
      "تعداد تلاش": row.attempts || 0,
      "خطا": row.error || "",
      "زمان پاسخ": row.fetchedAt || "",
    }));
    const summaryMap = new Map();
    displayRows.forEach((row) => {
      const key = row.issuerNid || row.issuerName || "بدون صادرکننده";
      if (!summaryMap.has(key)) summaryMap.set(key, { "کد ملی صادرکننده": row.issuerNid || "", "نام صادرکننده": row.issuerName || "", "تعداد چک": 0, "جمع مبلغ": 0, "موفق": 0, "حل‌نشده": 0, "برگشتی": 0 });
      const summary = summaryMap.get(key);
      summary["تعداد چک"] += 1;
      summary["جمع مبلغ"] += Number(row.amount || 0);
      const normalized = normalizeStatus(row.status);
      if (["VALID_SUCCESS", "SUCCESS_NO_BALANCES"].includes(normalized)) summary["موفق"] += 1;
      if (["UNRESOLVED", "NOT_FOUND", "AUTH_REQUIRED", "CORS_OR_AUTH_REQUIRED", "ENDPOINT_ERROR", "RATE_LIMITED"].includes(normalized)) summary["حل‌نشده"] += 1;
      if (Number(row.bounced || 0) > 0) summary["برگشتی"] += 1;
    });
    const auditRows = [{
      "زمان شروع/آخرین اجرا": lastRun ? lastRun.toISOString() : "",
      "زمان ساخت فایل": new Date().toISOString(),
      "endpoint": endpoint,
      "تعداد ردیف": displayRows.length,
      "شناسه یکتا": candidates.length,
      "تلاش‌ها": attempts.length,
      "وضعیت اجرا": status,
      "نکته": "این فایل فقط نتیجه‌های دریافت‌شده را دارد؛ مقدار خالی به معنی صفر نیست.",
    }];
    const attemptRows = attempts.map((attempt, index) => ({ "ردیف": index + 1, "شناسه صیادی": attempt.sayadId, "کد ملی دارنده": attempt.holderNid, "HTTP": attempt.httpStatus || "", "طبقه‌بندی": attempt.classification, "تلاش مجدد": attempt.retryIndex, "مدت (ms)": attempt.elapsedMs, "خطا": attempt.error, "پاسخ کوتاه": attempt.responseExcerpt, "زمان": attempt.timestamp }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resultRows), "نتایج استعلام");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...summaryMap.values()]), "خلاصه صادرکننده");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(attemptRows), "گزارش تلاش‌ها");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resultRows.filter((row) => !["VALID_SUCCESS", "SUCCESS_NO_BALANCES"].includes(normalizeStatus(row["وضعیت"]))),), "حل‌نشده");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditRows), "ممیزی اجرا");
    const datePart = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `sayad_pasargad_inquiry_${datePart}.xlsx`);
    showNotice("success", "فایل Excel با برگه‌های نتایج، خلاصه، تلاش‌ها و ممیزی ساخته شد.");
  }

  const progressPercent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const currentNav = NAV_ITEMS.find((item) => item.key === activeNav) || NAV_ITEMS[0];

  return <div className="app-shell">
    <aside className="side-rail" aria-label="ناوبری اصلی">
      <div className="brand-mark" aria-label="آریا"><span>A</span></div>
      <div className="rail-nav">
        {NAV_ITEMS.map((item) => <button key={item.key} type="button" className={`rail-item ${activeNav === item.key ? "is-active" : ""}`} onClick={() => setActiveNav(item.key)} title={item.label}>
          <Icon name={item.icon} size={22} /><span>{item.label}</span>
        </button>)}
      </div>
      <button className="rail-help" type="button" onClick={() => showNotice("info", "فقط شناسه‌های دارندهٔ ثبت‌شده را تأیید کنید؛ اطلاعات بانکی در این صفحه ذخیره نمی‌شود.")}><Icon name="help" size={21} /><span>راهنما</span></button>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="topbar-copy"><span className="eyebrow">درگاه کنترل چک</span><h1>استعلام صیادی پاسارگاد</h1></div>
        <div className="topbar-meta"><span className="live-dot" /> <span>اتصال مرورگر</span><div className="avatar">ک</div></div>
      </header>

      <div className="content-wrap">
        <div className="page-intro"><div><p className="section-kicker">{currentNav.label}</p><h2>استعلام تازه را آماده کنید</h2><p>فایل چک‌ها را وارد کنید، دارنده‌های مجاز را تأیید کنید و خروجی ممیزی‌پذیر بگیرید.</p></div><div className="updated-copy">{lastRun ? `آخرین اجرا: ${formatDateTime(lastRun)}` : "هنوز اجرایی ثبت نشده"}</div></div>

        {notice && <div className={`notice notice-${notice.type}`} role="status"><Icon name={notice.type === "error" ? "alert" : notice.type === "success" ? "check" : "help"} size={18} /><span>{notice.message}</span><button type="button" aria-label="بستن پیام" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button></div>}

        <section className="workspace-grid" aria-label="ورود فایل و تنظیمات">
          <article className={`panel upload-panel ${isDragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFile(event.dataTransfer.files?.[0]); }}>
            <div className="panel-heading"><div><h3>بارگذاری فایل Excel</h3><p>فایل اصلی چک‌ها را برای استخراج شناسهٔ صیادی انتخاب کنید.</p></div><span className="file-type">XLSX</span></div>
            <label className="drop-zone" htmlFor="file-input">
              <input id="file-input" type="file" accept=".xlsx,.xls,.csv" onChange={onFileInput} />
              <div className="drop-icon"><Icon name="upload" size={28} /></div>
              <strong>{selectedFile ? selectedFile.name : "فایل را اینجا بکشید یا انتخاب کنید"}</strong>
              <span>{selectedFile ? `${formatCount(fileInfo?.rowCount || 0)} ردیف · ${formatCount(fileInfo?.candidateCount || 0)} شناسه یکتا` : "فرمت‌های مجاز: .xlsx، .xls، .csv"}</span>
              <em>انتخاب فایل</em>
            </label>
          </article>

          <article className="panel holder-panel">
            <div className="panel-heading"><div><h3>شناسه‌های دارنده</h3><p>فقط کد ملی دارنده‌ای که مجاز به استعلام است.</p></div><span className="secure-mark"><Icon name="lock" size={16} /> محلی</span></div>
            <textarea value={holderText} onChange={(event) => { setHolderText(event.target.value); setHoldersConfirmed(false); }} placeholder="هر کد ملی در یک خط، مثل ۰۰۱۲۳۴۵۶۷۸" aria-label="کدهای ملی دارنده" />
            <div className="holder-footer"><span>{fileHolders.length ? `${formatCount(fileHolders.length)} شناسه از فایل کشف شد` : "از فایل شناسه‌ای کشف نشد"}</span><button type="button" className={`text-button ${holdersConfirmed ? "confirmed" : ""}`} onClick={confirmHolders}><Icon name={holdersConfirmed ? "check" : "lock"} size={16} />{holdersConfirmed ? "تأیید شد" : "تأیید شناسه‌ها"}</button></div>
          </article>
        </section>

        <section className="action-row">
          <div className="action-copy"><span className={`status-dot ${status}`} /><span>{status === "running" ? `در حال استعلام ${formatCount(progress.done)} از ${formatCount(progress.total)}` : status === "done" ? "آخرین استعلام کامل شد" : "برای شروع، فایل و دارنده را تأیید کنید"}</span>{status === "running" && <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>}</div>
          <div className="action-buttons">{status === "running" ? <button type="button" className="secondary-button" onClick={stopInquiry}><Icon name="stop" size={16} /> توقف</button> : <button type="button" className="primary-button" onClick={() => void startInquiry()} disabled={!candidates.length}><Icon name="play" size={16} /> شروع استعلام تازه</button>}<button type="button" className="secondary-button" onClick={downloadWorkbook} disabled={!displayRows.length}><Icon name="download" size={17} /> دانلود Excel</button></div>
        </section>

        <details className="settings-panel"><summary><span><Icon name="settings" size={17} /> تنظیمات اتصال و نرخ درخواست</span><small>در GitHub Pages، CORS یا ورود بانک ممکن است اتصال زنده را محدود کند.</small></summary><div className="settings-grid"><label>نشانی endpoint<input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} /></label><label>حداکثر درخواست در دقیقه<input type="number" min="1" max="120" value={rpm} onChange={(event) => setRpm(event.target.value)} /></label></div></details>

        <section className="metrics-grid" aria-label="خلاصه نتایج"><MetricCard title="تعداد چک" value={metrics.total} percent={fileInfo ? `${formatCount(candidates.length)} شناسه یکتا` : "—"} tone="total" icon="file" /><MetricCard title="موفق" value={metrics.success} percent={metrics.successPercent} tone="success" icon="check" /><MetricCard title="حل‌نشده" value={metrics.unresolved} percent={metrics.unresolvedPercent} tone="warning" icon="question" /><MetricCard title="در راه" value={metrics.pending} percent={metrics.pendingPercent} tone="info" icon="clock" /><MetricCard title="برگشتی" value={metrics.bounced} percent={metrics.bouncedPercent} tone="danger" icon="close" /></section>

        <section className="panel results-panel"><div className="results-heading"><div><h3>نتایج استعلام</h3><p>{displayRows.length ? `${formatCount(displayRows.length)} ردیف از ${formatCount(candidates.length || displayRows.length)} شناسه` : "نتایج پس از بارگذاری فایل اینجا نمایش داده می‌شود"}</p></div><div className="results-actions"><span className="last-updated"><Icon name="refresh" size={15} /> {lastRun ? formatDateTime(lastRun) : "به‌روزرسانی نشده"}</span><button type="button" className="outline-button" onClick={downloadWorkbook} disabled={!displayRows.length}><Icon name="download" size={16} /> دانلود Excel</button></div></div>
          {displayRows.length ? <div className="table-wrap"><table><thead><tr><th>ردیف</th><th>شماره صیادی</th><th>صادرکننده</th><th>مبلغ (ریال)</th><th>دارنده</th><th>وضعیت</th><th>توضیحات</th></tr></thead><tbody>{displayRows.slice(0, 80).map((row, index) => <tr key={`${row.sayadId}-${index}`}><td>{formatCount(index + 1)}</td><td className="mono-cell">{row.sayadId}</td><td><strong>{row.issuerName || "بدون نام"}</strong><small>{row.issuerNid || "کد ملی ثبت نشده"}</small></td><td>{formatAmount(row.amount)}</td><td className="mono-cell">{row.holderNid || "—"}</td><td><StatusBadge status={normalizeStatus(row.status)} /></td><td className="muted-cell">{row.error || (normalizeStatus(row.status) === "PENDING" ? "در انتظار استعلام" : normalizeStatus(row.status) === "VALID_SUCCESS" ? "پاسخ معتبر دریافت شد" : "نیاز به بررسی")}</td></tr>)}</tbody></table>{displayRows.length > 80 && <div className="table-foot">نمایش ۸۰ ردیف اول برای سرعت بیشتر؛ همهٔ ردیف‌ها در Excel خروجی می‌آیند.</div>}</div> : <EmptyTable hasFile={Boolean(selectedFile)} />}
        </section>

        <div className="mobile-safety-note"><Icon name="lock" size={16} /><span>این صفحه فقط در مرورگر اجرا می‌شود؛ هیچ توکن، کوکی یا پاسخ خام بانک در localStorage ذخیره نمی‌شود.</span></div>
      </div>

      <nav className="bottom-nav" aria-label="ناوبری موبایل">{NAV_ITEMS.map((item) => <button key={item.key} type="button" className={activeNav === item.key ? "is-active" : ""} onClick={() => setActiveNav(item.key)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</nav>
    </main>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
