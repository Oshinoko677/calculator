const clickSound = new Audio("sounds/click.mp3");
clickSound.volume = 0.5;

function playClick() {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});
}
const mainEl = document.getElementById("current");
const histEl = document.getElementById("history");
const keys = document.querySelector(".keys");

let expr = "";
let lastExpr = "";
let justEvaluated = false;
let errored = false;

/* ---------- Expression parser (no eval) ---------- */
function evaluate(src) {
  const tokens = src.match(/\d+\.?\d*|\.\d+|[+−×÷()√π%]/g) || [];
  if (tokens.join("") !== src) throw new Error("Invalid input");
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const startsPrimary = (t) => t !== undefined && (/^[\d.]/.test(t) || t === "(" || t === "√" || t === "π");

  function parseExpression() {
    let v = parseTerm();
    while (peek() === "+" || peek() === "−") {
      const op = next();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      const t = peek();
      if (t === "×" || t === "÷") {
        next();
        const r = parseUnary();
        if (t === "÷") {
          if (r === 0) throw new Error("Can't divide by 0");
          v /= r;
        } else v *= r;
      } else if (startsPrimary(t)) {
        v *= parseUnary(); // implicit multiplication: 2π, 3(4), (2)(3)
      } else break;
    }
    return v;
  }

  function parseUnary() {
    const t = peek();
    if (t === "−") { next(); return -parseUnary(); }
    if (t === "+") { next(); return parseUnary(); }
    return parsePostfix();
  }

  function parsePostfix() {
    let v = parsePrimary();
    while (peek() === "%") { next(); v /= 100; }
    return v;
  }

  function parsePrimary() {
    const t = next();
    if (t === undefined) throw new Error("Incomplete");
    if (t === "π") return Math.PI;
    if (t === "(") {
      const v = parseExpression();
      if (next() !== ")") throw new Error("Incomplete");
      return v;
    }
    if (t === "√") {
      const v = parsePostfix();
      if (v < 0) throw new Error("Invalid input");
      return Math.sqrt(v);
    }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    throw new Error("Invalid input");
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error("Invalid input");
  if (!isFinite(result)) throw new Error("Invalid input");
  return result;
}

/* ---------- Helpers ---------- */
function format(n) {
  return String(parseFloat(n.toPrecision(12))).replace("-", "−");
}

function autoClose(src) {
  const open = (src.match(/\(/g) || []).length;
  const close = (src.match(/\)/g) || []).length;
  return src + ")".repeat(Math.max(0, open - close));
}

function glue() {
  // add × automatically: 2( , π√ , )π ...
  if (/[0-9π)%.]$/.test(expr)) expr += "×";
}

function startFresh() {
  if (justEvaluated) { expr = ""; justEvaluated = false; }
}

function preview() {
  if (!expr) return "";
  try {
    const r = format(evaluate(autoClose(expr)));
    if (r !== expr) return "= " + r;
  } catch (e) { /* incomplete expression */ }
  return "";
}

function render() {
  const text = expr || "0";
  mainEl.textContent = text;
  histEl.textContent = justEvaluated ? lastExpr + " =" : errored ? "" : preview();
  mainEl.style.fontSize = text.length > 16 ? "1.5rem" : text.length > 10 ? "2rem" : "";
  mainEl.scrollLeft = mainEl.scrollWidth;
}

/* ---------- Button logic ---------- */
function press(action, value) {
  if (errored && action !== "clear") { expr = ""; errored = false; justEvaluated = false; }

  switch (action) {
    case "number":
      startFresh();
      if (expr.length >= 40) break;
      if (/[π)%]$/.test(expr)) expr += "×";
      if (/(^|[^0-9.])0$/.test(expr)) expr = expr.slice(0, -1);
      expr += value;
      break;

    case "decimal": {
      startFresh();
      const seg = expr.match(/[0-9.]*$/)[0];
      if (seg.includes(".")) break;
      if (seg === "") { glue(); expr += "0."; } else expr += ".";
      break;
    }

    case "operator": {
      justEvaluated = false;
      if (expr === "") { if (value === "−") expr = "−"; break; }
      if (/[+−×÷]$/.test(expr)) {
        const base = expr.slice(0, -1);
        if (base === "" || base.endsWith("(")) break;
        expr = base + value;
      } else if (expr.endsWith("(")) {
        if (value === "−") expr += "−";
      } else if (!expr.endsWith("√")) {
        expr += value;
      }
      break;
    }

    case "open":
      startFresh(); glue(); expr += "(";
      break;

    case "close": {
      const open = (expr.match(/\(/g) || []).length;
      const close = (expr.match(/\)/g) || []).length;
      if (open > close && /[0-9π)%.]$/.test(expr)) expr += ")";
      justEvaluated = false;
      break;
    }

    case "sqrt":
      startFresh(); glue(); expr += "√";
      break;

    case "pi":
      startFresh(); glue(); expr += "π";
      break;

    case "percent":
      if (/[0-9π)]$/.test(expr)) { expr += "%"; justEvaluated = false; }
      break;

    case "equals":
      if (!expr || justEvaluated) break;
      try {
        const closed = autoClose(expr);
        const result = format(evaluate(closed));
        lastExpr = closed;
        expr = result;
        justEvaluated = true;
      } catch (e) {
        if (e.message === "Can't divide by 0" || e.message === "Invalid input") {
          expr = e.message; errored = true; justEvaluated = false;
        }
      }
      break;

    case "clear":
      expr = ""; lastExpr = ""; justEvaluated = false; errored = false;
      break;

    case "delete":
      if (justEvaluated || errored) { expr = ""; justEvaluated = false; errored = false; }
      else expr = expr.slice(0, -1);
      break;
  }
  render();
}

keys.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (btn) {
    playClick();
    press(btn.dataset.action, btn.dataset.value);
  }
});

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k)) press("number", k);
  else if (k === ".") press("decimal");
  else if (k === "+") press("operator", "+");
  else if (k === "-") press("operator", "−");
  else if (k === "*" || k === "x" || k === "X") press("operator", "×");
  else if (k === "/") { e.preventDefault(); press("operator", "÷"); }
  else if (k === "(") press("open");
  else if (k === ")") press("close");
  else if (k === "%") press("percent");
  else if (k === "p" || k === "P") press("pi");
  else if (k === "r" || k === "R") press("sqrt");
  else if (k === "Enter" || k === "=") { e.preventDefault(); press("equals"); }
  else if (k === "Backspace") press("delete");
  else if (k === "Escape") press("clear");
});

render();

