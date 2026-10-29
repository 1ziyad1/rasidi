// رصيدي — سكربت لتطبيق Scriptable
// يفتح والكيبورد جاهز: اكتب المبلغ واضغط + أو −
// للخروج: اترك الخانة فاضية واضغط أي زر
// الرصيد ينقص ٣٠ كل يوم من ٢٩ أكتوبر ٢٠٢٦، والبيانات على الجوال بس

const START = [2026, 10, 29]; // أول يوم ينخصم
const DAILY = 30;

const fm = FileManager.local();
const FILE = fm.joinPath(fm.documentsDirectory(), "rasidi.json");

let NF;
try { NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }); }
catch (e) { NF = { format: (n) => String(n) }; }

/* ---------- الحسابات ---------- */
function dayNum(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }

function chargedDays(now) {
  const n = dayNum(now.getFullYear(), now.getMonth() + 1, now.getDate()) - dayNum(START[0], START[1], START[2]) + 1;
  return n > 0 ? n : 0;
}

// المبلغ بدون إشارة: أرقام عربية أو إنجليزية، والفاصلة العشرية ٫ أو . أو ,
function parseAmount(raw) {
  const s = String(raw == null ? "" : raw)
    .replace(/[‎‏؜‪-‮⁦-⁩\s+\-−]/g, "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫٬،,]/g, ".");
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const v = Math.round(parseFloat(s) * 100) / 100;
  return isFinite(v) && v > 0 && v < 1e9 ? v : null;
}

function balanceCents(entries) {
  let c = 0;
  for (const e of entries) c += Math.round(e.a * 100);
  return c - chargedDays(new Date()) * DAILY * 100;
}

function fmt(cents) {
  const r = Math.round(cents) / 100;
  const s = NF.format(Math.abs(r));
  return "‪" + (r < 0 ? "−" + s : s) + "‬"; // يخلي الإشارة يسار الرقم
}

function entry(a) {
  const t = Date.now();
  return { id: "e" + t.toString(36) + Math.random().toString(36).slice(2, 7), a: Math.round(a * 100) / 100, t };
}

/* ---------- الحفظ على الجوال ---------- */
function load() {
  if (!fm.fileExists(FILE)) return null;
  try {
    const o = JSON.parse(fm.readString(FILE));
    if (o && Array.isArray(o.entries)) {
      return o.entries.filter((e) => e && typeof e.id === "string" && typeof e.a === "number" && isFinite(e.a) && typeof e.t === "number");
    }
  } catch (e) {}
  return [];
}

function save(entries) {
  try {
    fm.writeString(FILE, JSON.stringify({ entries }));
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- النافذة ---------- */
async function ask(title, message) {
  const a = new Alert();
  a.title = title;
  if (message) a.message = message;
  const tf = a.addTextField("", "");
  tf.setDecimalPadKeyboard();
  tf.centerAlignText();
  a.addAction("+");
  a.addAction("−");
  const i = await a.presentAlert();
  return { sign: i === 1 ? -1 : 1, raw: String(a.textFieldValue(0) || "").trim() };
}

async function runApp() {
  let entries = load();
  let note = "";

  // أول مرة: تكتب رصيدك الحالي، و − لو كان بالسالب
  if (entries === null) {
    while (true) {
      const r = await ask("رصيدك الحين كم؟", note);
      entries = [];
      if (!r.raw) break;
      const v = parseAmount(r.raw);
      if (v == null) { note = "اكتب رقم صحيح"; continue; }
      const diff = Math.round(r.sign * v * 100) - balanceCents([]);
      if (diff !== 0) entries.push(entry(diff / 100));
      break;
    }
    note = save(entries) ? "" : "ما قدرت أحفظ، حاول مرة ثانية";
  }

  while (true) {
    const r = await ask(fmt(balanceCents(entries)), note);
    note = "";
    if (!r.raw) break;
    const v = parseAmount(r.raw);
    if (v == null) { note = "اكتب رقم صحيح"; continue; }
    entries.push(entry(r.sign * v));
    if (!save(entries)) {
      entries.pop();
      note = "ما قدرت أحفظ، حاول مرة ثانية";
    }
  }
}

/* ---------- الويدجت ---------- */
function buildWidget(entries) {
  const cents = balanceCents(entries || []);
  const w = new ListWidget();
  w.backgroundColor = new Color("#000000");
  w.setPadding(12, 12, 12, 12);
  w.addSpacer();
  const t = w.addText(fmt(cents));
  t.font = Font.boldSystemFont(44);
  t.textColor = new Color(cents < 0 ? "#ff7b72" : cents > 0 ? "#6fd99a" : "#f2f2f3");
  t.minimumScaleFactor = 0.3;
  t.lineLimit = 1;
  t.centerAlignText();
  w.addSpacer();
  const next = new Date();
  next.setHours(24, 0, 5, 0); // يتحدث بعد نص الليل
  w.refreshAfterDate = next;
  return w;
}

/* ---------- التشغيل ---------- */
if (config.runsInWidget) {
  Script.setWidget(buildWidget(load()));
} else {
  await runApp();
}
Script.complete();
