// رصيدي — سكربت لتطبيق Scriptable
// نفس الشاشة السوداء: الرصيد، وتحته الخانة و + و −، والكيبورد يفتح لحاله
// الرصيد ينقص ٣٠ كل يوم من ٢٩ أكتوبر ٢٠٢٦، والبيانات على الجوال بس
// أول مرة يطلع ؟ مكان الرصيد: اكتب رصيدك الحالي واضغط + أو −

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

function balanceCents(entries) {
  let c = 0;
  for (const e of entries) c += Math.round(e.a * 100);
  return c - chargedDays(new Date()) * DAILY * 100;
}

function fmt(cents) {
  const r = Math.round(cents) / 100;
  const s = NF.format(Math.abs(r));
  return r < 0 ? "−" + s : s;
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

function sleep(ms) { return new Promise((r) => Timer.schedule(ms, false, r)); }

/* ---------- الشاشة ---------- */
function pageHTML(text, cents) {
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
'<style>' +
':root{--bg:#000;--fg:#f2f2f3;--line:#1e1e22;--field:#0f0f12;--key:#18181c;--key-down:#2a2a30;--neg:#ff7b72;--pos:#6fd99a;color-scheme:dark}' +
'html,body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,"SF Arabic",system-ui,sans-serif;-webkit-text-size-adjust:100%}' +
'[hidden]{display:none!important}' +
'.app{box-sizing:border-box;max-width:440px;margin:0 auto;min-height:100vh;min-height:100dvh;padding:16px 16px 22vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:56px;container-type:inline-size}' +
'.bal{font-size:clamp(44px,16vw,88px);font-size:min(96px,calc(100cqi / (var(--len,3) * 0.62)));font-weight:600;line-height:1.1;white-space:nowrap;font-variant-numeric:tabular-nums}' +
'.bal.neg{color:var(--neg)}.bal.pos{color:var(--pos)}' +
'.entry{width:100%;max-width:340px;display:flex;flex-direction:column;gap:10px}' +
'#amt{box-sizing:border-box;display:block;width:200px;max-width:100%;height:60px;margin:0 auto;padding:0 12px;font:inherit;font-size:30px;text-align:center;background:var(--field);color:var(--fg);border:1px solid var(--line);border-radius:12px;outline:none;font-variant-numeric:tabular-nums}' +
'.signs{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:200px;max-width:100%;margin:0 auto}' +
'.signs button{font:inherit;font-size:34px;font-weight:500;line-height:1;height:58px;border:0;border-radius:12px;background:var(--key);-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
'.signs button:active{background:var(--key-down)}#minus{color:var(--neg)}#plus{color:var(--pos)}' +
'.hint{margin:0;text-align:center;color:var(--neg);font-size:13px}' +
'</style></head><body><main class="app">' +
'<div id="bal" class="bal" dir="ltr"></div>' +
'<div class="entry">' +
'<input id="amt" type="text" inputmode="decimal" dir="ltr" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
'<div class="signs"><button type="button" id="plus">+</button><button type="button" id="minus">−</button></div>' +
'<p id="hint" class="hint" role="status" hidden></p>' +
'</div></main>' +
'<script>(function(){' +
'var waiting=false,hintTimer=0;' +
'var balEl=document.getElementById("bal"),amtEl=document.getElementById("amt"),hintEl=document.getElementById("hint");' +
'function parseAmount(raw){var s=String(raw==null?"":raw)' +
'.replace(/[\\u200e\\u200f\\u061c\\u202a-\\u202e\\u2066-\\u2069\\s+\\-\\u2212]/g,"")' +
'.replace(/[\\u0660-\\u0669]/g,function(c){return String(c.charCodeAt(0)-0x0660)})' +
'.replace(/[\\u06f0-\\u06f9]/g,function(c){return String(c.charCodeAt(0)-0x06f0)})' +
'.replace(/[\\u066b\\u066c\\u060c,]/g,".");' +
'if(!/^(\\d+(\\.\\d*)?|\\.\\d+)$/.test(s))return null;' +
'var v=Math.round(parseFloat(s)*100)/100;return isFinite(v)&&v>0&&v<1e9?v:null}' +
'function showHint(t){hintEl.textContent=t;hintEl.hidden=false;clearTimeout(hintTimer);hintTimer=setTimeout(function(){hintEl.hidden=true},2500)}' +
'window.setBalance=function(text,cents,note){balEl.textContent=text;balEl.className="bal"+(cents<0?" neg":cents>0?" pos":"");balEl.style.setProperty("--len",Math.max(3,text.length));if(note)showHint(note)};' +
'window.waitEntry=function(){waiting=true};' +
'window.focusField=function(){if(document.activeElement!==amtEl)amtEl.focus();return document.activeElement===amtEl};' +
'function apply(sign){' +
'if(!amtEl.value.trim()){amtEl.focus();return}' +
'var v=parseAmount(amtEl.value);' +
'if(v==null){showHint("اكتب رقم صحيح");return}' +
'if(!waiting||typeof completion!=="function")return;' +
'waiting=false;amtEl.value="";hintEl.hidden=true;amtEl.blur();completion(String(sign*v))}' +
'document.getElementById("plus").addEventListener("click",function(){apply(1)});' +
'document.getElementById("minus").addEventListener("click",function(){apply(-1)});' +
'amtEl.addEventListener("input",function(){hintEl.hidden=true});' +
'function tapFocus(ev){var t=ev.target;if(t&&t.closest&&t.closest("button, input"))return;if(document.activeElement!==amtEl)amtEl.focus()}' +
'document.addEventListener("touchend",tapFocus,{passive:true});document.addEventListener("click",tapFocus);' +
'window.setBalance(' + JSON.stringify(text) + ',' + cents + ');' +
'})();</script></body></html>';
}

async function runApp() {
  let entries = load();
  let setup = entries === null; // أول مرة: الرقم اللي تكتبه يصير رصيدك
  if (setup) entries = [];

  const wv = new WebView();
  await wv.loadHTML(setup ? pageHTML("؟", 0) : pageHTML(fmt(balanceCents(entries)), balanceCents(entries)));

  let closed = false;
  const shown = wv.present(true).then(() => { closed = true; return null; });

  // يفتح الكيبورد أول ما تطلع الشاشة
  for (const wait of [350, 400, 600]) {
    await sleep(wait);
    if (closed) break;
    try { if (await wv.evaluateJavaScript("focusField()")) break; } catch (e) {}
  }

  while (!closed) {
    let res;
    try { res = await Promise.race([wv.evaluateJavaScript("waitEntry()", true), shown]); }
    catch (e) { break; }
    if (res == null || closed) break;
    const a = Math.round(Number(res) * 100) / 100;
    if (!isFinite(a) || a === 0) continue;

    const before = entries.slice();
    if (setup) {
      const diff = Math.round(a * 100) - balanceCents([]);
      entries = diff !== 0 ? [entry(diff / 100)] : [];
    } else {
      entries.push(entry(a));
    }
    let note = "";
    if (save(entries)) setup = false;
    else { entries = before; note = "ما قدرت أحفظ، حاول مرة ثانية"; }

    const c = balanceCents(entries);
    const text = setup ? "؟" : fmt(c);
    try { await wv.evaluateJavaScript("setBalance(" + JSON.stringify(text) + "," + (setup ? 0 : c) + "," + JSON.stringify(note) + ")"); }
    catch (e) {}
  }
}

/* ---------- الويدجت ---------- */
function buildWidget(entries) {
  const cents = balanceCents(entries || []);
  const w = new ListWidget();
  w.backgroundColor = new Color("#000000");
  w.setPadding(12, 12, 12, 12);
  w.addSpacer();
  const t = w.addText("‪" + fmt(cents) + "‬");
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
