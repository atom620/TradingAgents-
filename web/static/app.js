const form = document.querySelector("#analysisForm");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submitButton");
const tradeDate = document.querySelector("#tradeDate");
const reports = document.querySelector("#reports");

tradeDate.value = new Date().toISOString().slice(0, 10);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  status.hidden = false;
  result.hidden = true;

  const payload = {
    ticker: document.querySelector("#ticker").value,
    trade_date: tradeDate.value,
    analysts: [...form.querySelectorAll("[name=analyst]:checked")].map((item) => item.value),
    debate_rounds: Number(document.querySelector("#debateRounds").value),
    checkpoint: document.querySelector("#checkpoint").checked,
  };

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "分析失败");
    showResult(data);
  } catch (error) {
    reports.replaceChildren();
    result.hidden = false;
    document.querySelector("#rating").textContent = "ERROR";
    document.querySelector("#resultMeta").textContent = error.message;
  } finally {
    status.hidden = true;
    submitButton.disabled = false;
  }
});

function showResult(data) {
  document.querySelector("#rating").textContent = data.decision;
  document.querySelector("#resultMeta").textContent =
    `${data.ticker} · ${data.trade_date} · ${data.asset_type}`;
  reports.replaceChildren();

  const titles = {
    market_report: "市场分析",
    sentiment_report: "情绪分析",
    news_report: "新闻分析",
    fundamentals_report: "基本面分析",
    investment_plan: "研究团队决策",
    trader_investment_plan: "交易计划",
    final_trade_decision: "最终决策",
  };

  for (const [key, text] of Object.entries(data.reports)) {
    const section = document.createElement("article");
    section.className = "report";
    const heading = document.createElement("h2");
    heading.textContent = titles[key] || key;
    const body = document.createElement("pre");
    body.textContent = text;
    section.append(heading, body);
    reports.append(section);
  }
  result.hidden = false;
}

let installPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#installButton").hidden = false;
});

document.querySelector("#installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelector("#installButton").hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
