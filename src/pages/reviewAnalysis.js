import { metricCard } from "../components/cards.js";
import { getReviewDetailData, runAiReview } from "../services/chartService.js";
import { getMarketAnalysisHistory, updateMarketAnalysisReview } from "../services/historyService.js";

let selectedReviewDate = null;
const tradeReviewKey = "ai-investment-trade-review-records";

function bar(value) {
  const width = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return `<div class="mini-bar"><span style="width:${width}%"></span></div>`;
}

function accuracyCard(label, stat) {
  return metricCard({
    label,
    value: `${stat?.accuracy ?? 0}%`,
    change: `${stat?.count ?? 0}条样本`,
  });
}

export async function renderReviewAnalysis() {
  const [data, marketAnalysisHistory] = await Promise.all([
    getReviewDetailData(selectedReviewDate),
    getMarketAnalysisHistory(),
  ]);
  const detail = data.detail;
  const tradeRecords = loadTradeRecords();
  const tradeStats = summarizeTrades(tradeRecords);

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>复盘分析</h2>
          <span>来源：${data.source} · 样本：${data.stats.sampleSize}条</span>
        </div>
        <button id="run-ai-review-button" type="button">执行AI复盘</button>
      </div>
      <form class="stock-search review-date-form">
        <select name="date">
          ${data.dates.map((date) => `<option value="${date}" ${date === data.selectedDate ? "selected" : ""}>${date}</option>`).join("")}
        </select>
        <button type="submit">查看日期</button>
      </form>
      <div class="metrics">
        ${[
          { label: "市场判断准确率", value: `${data.stats.marketAccuracy}%`, change: "综合样本" },
          { label: "风险提醒有效率", value: `${data.stats.riskAccuracy}%`, change: `${data.riskCount}次提醒` },
          { label: "AI综合可信度", value: `${data.stats.credibilityScore ?? 0}分`, change: `信心等级：${data.stats.confidenceLevel ?? "低"}` },
          { label: "历史样本数量", value: `${data.stats.sampleSize}条`, change: "AI判断记录" },
        ].map(metricCard).join("")}
      </div>
      <p id="ai-review-message" class="form-message">选择日期查看当天市场、板块、自选股表现和AI观点。</p>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI市场判断历史</h2>
          <span>记录首页DeepSeek/fallback市场分析，供后续复盘验证</span>
        </div>
      </div>
      <div class="detail-grid">
        ${marketAnalysisHistory.slice(0, 8).map(marketAnalysisHistoryCard).join("") || `<article class="data-card"><strong>暂无市场判断记录</strong><p>打开首页生成AI市场分析后，这里会保存当天判断。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>交易复盘记录</h2>
          <span>只记录个人买入、卖出和盈亏，不做自动交易</span>
        </div>
      </div>
      <form class="stock-search trade-review-form">
        <input name="stock" placeholder="股票/ETF，例如 600176" />
        <select name="type">
          <option value="买入">买入记录</option>
          <option value="卖出">卖出记录</option>
          <option value="盈亏">盈亏记录</option>
        </select>
        <input name="price" type="number" step="0.001" placeholder="价格" />
        <input name="quantity" type="number" step="1" placeholder="数量" />
        <input name="reason" placeholder="交易原因 / 复盘备注" />
        <button type="submit">保存记录</button>
      </form>
      <div class="metrics">
        ${[
          { label: "买入记录", value: `${tradeStats.buyCount}条`, change: "手动记录" },
          { label: "卖出记录", value: `${tradeStats.sellCount}条`, change: "手动记录" },
          { label: "已记录盈亏", value: `${tradeStats.pnl.toFixed(2)}元`, change: tradeStats.pnl >= 0 ? "盈利" : "亏损" },
          { label: "AI复盘入口", value: "已开启", change: "结合下方AI复盘" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid">
        ${tradeRecords.slice(0, 8).map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.stock}</strong><span>${item.type} · ${item.time}</span></div>
            <p><b>价格</b>${item.price || "未填"} · <b>数量</b>${item.quantity || "未填"} · <b>金额</b>${item.amount.toFixed(2)}元</p>
            <p><b>复盘备注</b>${item.reason || "未填写，需要补充当时判断依据。"}</p>
            <p><b>AI复盘入口</b>点击“执行AI复盘”后，可结合日报、行情和自选股表现校准判断。</p>
          </article>
        `).join("") || `<article class="data-card"><strong>暂无交易记录</strong><p>记录买入、卖出和盈亏后，后续可与AI判断进行对照复盘。</p></article>`}
      </div>
      <p id="trade-review-message" class="form-message">交易复盘仅用于记录和反思，不触发任何下单动作。</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>${detail.date} 当日复盘</h2><span>更新时间：${detail.updatedAt}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场情况</strong><p>${detail.marketSummary}</p><p>${detail.breadth}</p></article>
        <article class="data-card"><strong>板块表现</strong><p>${detail.hotSectors.join("、") || "暂无"}</p></article>
        <article class="data-card"><strong>当时AI观点</strong><p>${detail.aiView}</p></article>
        <article class="data-card"><strong>复盘总结</strong><p>${detail.reviewConclusion}</p><p>${detail.reviewReason}</p></article>
      </div>
      <p class="side-note">数据来源：${detail.source.join("、")}。本复盘用于校准AI判断，不代表未来表现。</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>关注股票表现</h2><span>当天关注列表快照</span></div>
      <div class="detail-grid">
        ${detail.watchlistPerformance.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><span>${item.changePercent}</span></div>
            <p>${item.code} · ${item.industry}</p>
          </article>
        `).join("") || `<article class="data-card"><strong>暂无自选股</strong><p>添加关注股票后可在此复盘表现。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>市场判断周期统计</h2><span>30天 / 60天 / 90天</span></div>
      <div class="metrics">
        ${accuracyCard("30天市场判断", data.windows["30"])}
        ${accuracyCard("60天市场判断", data.windows["60"])}
        ${accuracyCard("90天市场判断", data.windows["90"])}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>行业判断准确率</h2><span>重点方向</span></div>
      <div class="metrics">
        ${accuracyCard("AI方向", data.byIndustry.AI)}
        ${accuracyCard("半导体", data.byIndustry["半导体"])}
        ${accuracyCard("新能源", data.byIndustry["新能源"])}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>近期复盘趋势</h2><span>最近30条AI判断</span></div>
      <div class="detail-grid">
        ${data.thirtyDays.map((item) => `
          <article class="data-card">
            <strong>${item.label}</strong>
            <p>市场判断得分：${Math.round(item.marketScore * 100)}%</p>
            ${bar(item.marketScore)}
            <p>风险提醒得分：${Math.round(item.riskScore * 100)}%</p>
            ${bar(item.riskScore)}
          </article>
        `).join("") || `<article class="data-card"><strong>暂无复盘样本</strong><p>生成AI日报后，系统会逐步积累判断记录。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>热点判断结果</h2><span>用于后续AI反思</span></div>
      <div class="table">
        ${data.sectorResults.map((item) => `
          <div class="table-row">
            <b>${item.date}</b>
            <span>${item.sectors.join("、")}</span>
            <em>${item.result}</em>
          </div>
        `).join("") || `<div class="table-row"><b>暂无记录</b><span>等待AI日报生成</span><em>待复盘</em></div>`}
      </div>
    </section>`;
}

export function mountReviewAnalysis({ rerender }) {
  document.querySelector(".trade-review-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const record = saveTradeRecord({
      stock: formData.get("stock"),
      type: formData.get("type"),
      price: formData.get("price"),
      quantity: formData.get("quantity"),
      reason: formData.get("reason"),
    });
    const message = document.querySelector("#trade-review-message");
    if (message) message.textContent = record.ok ? "交易复盘记录已保存。" : record.message;
    if (record.ok) rerender();
  });

  document.querySelector(".review-date-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    selectedReviewDate = String(formData.get("date") ?? "");
    rerender();
  });

  document.querySelector("#run-ai-review-button")?.addEventListener("click", async () => {
    const message = document.querySelector("#ai-review-message");
    if (message) message.textContent = "正在执行AI复盘...";
    const result = await runAiReview();
    if (message) message.textContent = `复盘完成：更新 ${result.reviewedCount ?? 0} 条判断记录。`;
    rerender();
  });

  document.querySelectorAll(".market-review-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const message = event.currentTarget.querySelector(".market-review-message");
      if (message) message.textContent = "正在保存复盘结果...";
      const result = await updateMarketAnalysisReview(String(formData.get("id") ?? ""), {
        actualMarketMove: formData.get("actualMarketMove"),
        reviewStatus: formData.get("reviewStatus"),
        reviewNote: formData.get("reviewNote"),
      });
      if (message) message.textContent = result.ok ? "复盘结果已保存。" : result.message;
      if (result.ok) rerender();
    });
  });
}

function loadTradeRecords() {
  try {
    return JSON.parse(window.localStorage.getItem(tradeReviewKey) ?? "[]");
  } catch {
    return [];
  }
}

function saveTradeRecord(input = {}) {
  const stock = String(input.stock ?? "").trim();
  if (!stock) return { ok: false, message: "请输入股票或ETF代码。" };
  const price = Number(input.price || 0);
  const quantity = Number(input.quantity || 0);
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    stock,
    type: String(input.type ?? "买入"),
    price,
    quantity,
    amount: Number.isFinite(price * quantity) ? price * quantity : 0,
    reason: String(input.reason ?? "").trim(),
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
  window.localStorage.setItem(tradeReviewKey, JSON.stringify([record, ...loadTradeRecords()].slice(0, 80)));
  return { ok: true, record };
}

function summarizeTrades(records = []) {
  const buyCount = records.filter((item) => item.type === "买入").length;
  const sellCount = records.filter((item) => item.type === "卖出").length;
  const sellAmount = records.filter((item) => item.type === "卖出").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const buyAmount = records.filter((item) => item.type === "买入").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const manualPnl = records.filter((item) => item.type === "盈亏").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { buyCount, sellCount, pnl: manualPnl || (sellAmount - buyAmount) };
}

function marketAnalysisHistoryCard(record = {}) {
  const content = record.predictionContent ?? record.prediction_content ?? {};
  const snapshot = content.marketSnapshotSummary ?? {};
  const breadth = snapshot.breadth ?? {};
  const actual = record.actualResult ?? record.actual_result ?? {};
  const reviewStatus = record.reviewStatus ?? record.review_status ?? actual.reviewStatus ?? "pending";
  const directions = (content.mainDirections ?? []).map((item) => item.name ?? item).filter(Boolean).slice(0, 4);
  const risks = (content.riskDirections ?? []).map((item) => item.target ? `${item.target}：${item.reason}` : String(item)).filter(Boolean).slice(0, 3);
  return `
    <article class="data-card">
      <div class="card-head"><strong>${record.date ?? "日期待补充"}</strong><span>${content.aiSource ?? record.source ?? "fallback"} · ${statusLabel(reviewStatus)}</span></div>
      <p><b>AI判断</b>${content.marketState ?? record.marketPrediction ?? record.prediction?.marketDirection ?? "市场判断待补充"}</p>
      <p><b>今日主线</b>${directions.join("、") || "主线方向待补充"}</p>
      <p><b>风险方向</b>${risks.join("；") || "风险方向待补充"}</p>
      <p><b>操作思路</b>${content.operationPlan ?? "等待后续复盘补充"}</p>
      <p><b>市场数据</b>上涨${breadth.upCount ?? "未知"}家，下跌${breadth.downCount ?? "未知"}家，涨停${breadth.limitUpCount ?? "未知"}家，跌停${breadth.limitDownCount ?? "未知"}家，成交额${breadth.turnover ?? "未知"}。</p>
      <p><b>实际结果</b>${actual.marketMove ?? "未填写"}。<b>复盘备注</b>${record.reviewNote ?? actual.reviewNote ?? "未填写"}</p>
      <form class="stock-search market-review-form">
        <input type="hidden" name="id" value="${record.id}" />
        <input name="actualMarketMove" value="${actual.marketMove ?? ""}" placeholder="实际走势，例如：指数震荡收涨，半导体走强" />
        <select name="reviewStatus">
          <option value="pending" ${reviewStatus === "pending" ? "selected" : ""}>待复盘</option>
          <option value="correct" ${reviewStatus === "correct" ? "selected" : ""}>判断正确</option>
          <option value="wrong" ${reviewStatus === "wrong" ? "selected" : ""}>判断错误</option>
        </select>
        <input name="reviewNote" value="${record.reviewNote ?? actual.reviewNote ?? ""}" placeholder="复盘备注" />
        <button type="submit">保存复盘</button>
        <span class="market-review-message form-message"></span>
      </form>
    </article>`;
}

function statusLabel(status) {
  if (status === "correct") return "判断正确";
  if (status === "wrong") return "判断错误";
  return "待复盘";
}
