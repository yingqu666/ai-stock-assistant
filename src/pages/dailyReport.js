import { metricCard, riskCard, tagList } from "../components/cards.js";
import { reportList } from "../components/lists.js";
import { getReviewChartData } from "../services/chartService.js";
import { getMarketAnalysisHistory } from "../services/historyService.js";
import { generateTodayReport, getDailyReportData, selectDailyReport } from "../services/mockService.js";
import { notifyByType } from "../services/notificationService.js";
import { getSyncStatus } from "../services/syncService.js";

export async function renderDailyReport() {
  const [{ dailyReport, selectedReport, taskSchedule, taskStatus, savedReports }, reviewData, marketHistory] = await Promise.all([
    getDailyReportData(),
    getReviewChartData(),
    getMarketAnalysisHistory().catch(() => []),
  ]);
  const { morning, close, history } = dailyReport;
  const decision = morning.investmentDecision ?? close.investmentDecision ?? {};
  const reportSync = getSyncStatus().reports ?? { status: "尚未同步", lastSyncAt: "尚未同步", source: "本地/云端" };
  const hotDirections = morning.hotDirections ?? close.hotDirections ?? [];
  const latestMarketReview = marketHistory[0];
  const watchlistChanges = morning.watchlistChanges ?? close.watchlistChanges ?? [];
  const portfolioDaily = morning.portfolioDaily ?? close.portfolioDaily ?? {};
  const yesterdayAutoReview = close.yesterdayReview ?? {};

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI日报</h2>
          <span>${reportSync.status} · ${reportSync.lastSyncAt} · ${reportSync.source ?? "Supabase/本地缓存"}</span>
        </div>
        <button id="generate-report-button" type="button">生成今日AI日报</button>
      </div>
      <div class="metrics">
        ${[
          { label: "行情已更新", value: taskStatus.marketUpdated ? "是" : "待执行", change: taskStatus.marketUpdated ? "完成" : "手动生成" },
          { label: "新闻已获取", value: taskStatus.newsFetched ? "是" : "待执行", change: taskStatus.newsFetched ? "完成" : "手动生成" },
          { label: "报告已生成", value: taskStatus.reportGenerated ? "是" : "待执行", change: taskStatus.lastRunAt },
          { label: "已保存报告", value: `${savedReports.length}份`, change: "历史" },
          { label: "早盘自动任务", value: taskStatus.lastMorningRunAt ?? "尚未生成", change: taskStatus.schedulerMode ?? "本地定时" },
          { label: "收盘自动任务", value: taskStatus.lastCloseRunAt ?? "尚未生成", change: taskStatus.lastError ? "有异常" : "等待到点" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${taskSchedule.map((task) => `<article class="data-card"><strong>${task.name}</strong><p>${task.time} · ${task.description}</p></article>`).join("")}
      </div>
      <p id="daily-report-message" class="form-message">点击按钮后会采集市场、自选股、新闻、公告和风险数据，生成并保存日报。</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>昨日判断复盘</h2><span>读取AI市场判断历史，暂不自动判定准确率</span></div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>昨日AI判断</strong><p>${latestMarketReview?.predictionContent?.marketState ?? latestMarketReview?.prediction?.marketDirection ?? "暂无历史判断"}</p></article>
        <article class="data-card"><strong>当时主线</strong>${tagList((latestMarketReview?.prediction?.sectors ?? latestMarketReview?.predictionContent?.mainDirections?.map((item) => item.name) ?? []).slice(0, 6))}</article>
        <article class="data-card"><strong>风险方向</strong>${tagList((latestMarketReview?.prediction?.risks ?? []).slice(0, 6))}</article>
        <article class="data-card"><strong>复盘状态</strong><p>${formatReviewStatus(latestMarketReview?.reviewStatus)} · ${latestMarketReview?.actualResult?.marketMove ?? "等待人工填写实际走势"}</p></article>
        <article class="data-card"><strong>自动复盘对照</strong><p>${yesterdayAutoReview.prediction ?? "暂无自动日报历史"} → ${yesterdayAutoReview.actual ?? "等待市场数据"}；${yesterdayAutoReview.result ?? "待复核"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>今日A股市场分析</h2><span>行情、强弱和主要影响因素</span></div>
      <div class="metrics">
        ${[
          { label: "市场判断", value: decision.marketTrend ?? morning.marketState ?? "震荡", change: decision.rating ?? "中性观察" },
          { label: "AI评分", value: `${decision.score ?? morning.score ?? 60}/100`, change: morning.aiStatus ?? "AI" },
          { label: "仓位建议", value: decision.positionAdvice ?? morning.positionAdvice ?? "保持当前仓位", change: decision.action ?? "等待" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>大盘表现</strong><p>${morning.marketAnalysis?.performance ?? morning.marketSummary ?? close.marketSummary}</p></article>
        <article class="data-card"><strong>市场强弱</strong><p>${morning.marketAnalysis?.strength ?? close.breadth}</p></article>
        <article class="data-card"><strong>主要影响因素</strong>${tagList(morning.marketAnalysis?.factors ?? [])}</article>
        <article class="data-card"><strong>数据依据</strong><p>${morning.basis ?? close.basis}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>今日热点方向 TOP5</h2><span>根据行情热度、新闻和板块变化生成</span></div>
      <div class="detail-grid">
        ${hotDirections.map((item, index) => `
          <article class="data-card">
            <div class="card-head"><strong>${index + 1}. ${item.name}</strong><span>${item.sustainability ?? "持续性观察"}</span></div>
            <p><b>上涨原因：</b>${item.reason ?? "板块活跃度靠前"}</p>
            <p><b>新闻催化：</b>${item.catalyst ?? "暂未匹配到强新闻催化"}</p>
            <p><b>风险：</b>${item.risk ?? "成交缩量或高位分歧会削弱持续性"}</p>
          </article>
        `).join("") || `<article class="data-card"><strong>热点方向</strong><p>热点方向由行情和新闻接口补充；当前报告未返回TOP5。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>明日市场观察</h2><span>重点方向、重点标的和风险方向</span></div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>重点关注方向</strong>${tagList((morning.tomorrowPlan ?? close.nextFocus ?? []).slice(0, 6))}</article>
        <article class="data-card"><strong>重点研究股票/ETF</strong>${tagList(morning.watchFocus ?? [])}</article>
        <article class="data-card"><strong>风险方向</strong>${tagList((decision.risks ?? morning.risks ?? []).slice(0, 6))}</article>
        <article class="data-card"><strong>操作纪律</strong><p>${decision.action ?? "等待"} · ${decision.positionAdvice ?? morning.positionAdvice ?? "保持当前仓位"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>我的关注股票今日分析</h2><span>读取用户自己的观察池，不自动替换</span></div>
      <div class="detail-grid">
        ${(morning.watchlistAnalysis ?? []).map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><span>${item.code} · ${item.assetType}</span></div>
            <p><b>AI评分：</b>${item.score}/100 · <b>当前判断：</b>${item.rating}</p>
            <p><b>短期：</b>${item.shortTerm} · <b>一周趋势：</b>${item.weekTrend} · <b>明日策略：</b>${item.action}</p>
            <p><b>风险等级：</b>${item.riskLevel ?? "中"} · <b>最近新闻：</b>${item.latestNews ?? "暂无强相关新闻"}</p>
            <p><b>AI观点：</b>${item.aiOpinion ?? "继续观察行情、公告和行业热度变化。"}</p>
            <p><b>核心原因：</b>${(item.reasons ?? []).slice(0, 3).join("；")}</p>
            <p><b>风险：</b>${(item.risks ?? []).slice(0, 3).join("；")}</p>
          </article>
        `).join("") || `<article class="data-card"><strong>关注股票</strong><p>先在“我的关注股票”添加标的，生成日报时会逐只分析。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>关注变化</h2><span>价格、新闻、热点和风险变化检测</span></div>
      <div class="detail-grid">
        ${watchlistChanges.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><span>${item.code} · ${item.assetType}</span></div>
            <p><b>${item.attentionChange}</b></p>
            <p><b>价格：</b>${item.price ?? "数据源未返回"} · ${item.priceChange ?? item.changePercent ?? "涨跌数据暂缺"}</p>
            <p><b>新闻：</b>${item.newsChange}</p>
            <p><b>热点：</b>${item.hotspotChange}</p>
            <p><b>风险：</b>${item.riskChange}</p>
          </article>
        `).join("") || `<article class="data-card"><strong>关注变化</strong><p>暂无关注股票变化。先在“我的关注股票”添加标的后，日报会自动检测。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>投资组合日报</h2><span>盈亏、风险等级和行业集中度变化</span></div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>今日盈亏</strong><p>${portfolioDaily.todayPnlText ?? "暂无持仓数据"}</p></article>
        <article class="data-card"><strong>风险等级变化</strong><p>${portfolioDaily.riskChange ?? "暂无持仓风险变化。"}</p></article>
        <article class="data-card"><strong>行业集中度变化</strong><p>${portfolioDaily.industryChange ?? portfolioDaily.industryConcentration ?? "暂无行业集中度数据。"}</p></article>
        <article class="data-card"><strong>组合日报总结</strong><p>${portfolioDaily.summary ?? "暂无持仓记录，组合日报等待数据。"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI历史表现</h2><span>历史表现不代表未来结果</span></div>
      <div class="metrics">
        ${[
          { label: "市场方向", value: `${reviewData.byType.market?.accuracy ?? 0}%`, change: `${reviewData.byType.market?.count ?? 0}条样本` },
          { label: "行业判断", value: `${reviewData.byType.industry?.accuracy ?? 0}%`, change: `${reviewData.byType.industry?.count ?? 0}条样本` },
          { label: "风险提醒", value: `${reviewData.byType.risk?.effectiveRate ?? 0}%`, change: `${reviewData.byType.risk?.count ?? 0}次提醒` },
          { label: "AI信心等级", value: reviewData.stats.confidenceLevel ?? "低", change: `可信度${reviewData.stats.credibilityScore ?? 0}分` },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>早盘分析</h2>
          <span>${morning.date} · 生成时间：${morning.generatedAt ?? "手动生成"}</span>
        </div>
      </div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>今日市场总结</strong><p>${morning.marketSummary ?? morning.strategy}</p></article>
        <article class="data-card"><strong>上涨原因</strong><p>${morning.riseReason ?? "热点与成交仍需观察。"}</p></article>
        <article class="data-card"><strong>下跌风险</strong><p>${morning.downsideRisk ?? (morning.risks ?? []).join("；")}</p></article>
        <article class="data-card"><strong>关注方向</strong>${tagList(morning.focus ?? [])}</article>
        <article class="data-card"><strong>明日观察</strong>${tagList(morning.tomorrowPlan ?? [])}</article>
        <article class="data-card"><strong>AI状态</strong><p>${morning.aiStatus ?? "fallback"} · 来源：${(morning.sources ?? []).join("、")}</p></article>
      </div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>行情依据</strong><p>${(morning.evidence?.market ?? []).join("；") || "数据源未返回"}</p></article>
        <article class="data-card"><strong>新闻依据</strong><p>${(morning.evidence?.industry ?? morning.evidence?.news ?? []).join("；") || "数据源未返回"}</p></article>
        <article class="data-card"><strong>公告依据</strong><p>${(morning.evidence?.announcements ?? morning.evidence?.announcement ?? []).join("；") || "数据源未返回"}</p></article>
        <article class="data-card"><strong>财务依据</strong><p>${(morning.evidence?.financials ?? morning.evidence?.financial ?? []).join("；") || "数据源未返回"}</p></article>
      </div>
      <div class="sub-panel compact"><h2>风险提醒</h2>${(morning.risks ?? []).map(riskCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>收盘复盘</h2><span>生成时间：${close.generatedAt ?? "手动生成"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>今日市场总结</strong><p>${close.marketSummary ?? close.performance}</p></article>
        <article class="data-card"><strong>涨跌情况</strong><p>${close.breadth}</p></article>
        <article class="data-card"><strong>热点板块复盘</strong>${tagList(close.hotSectors ?? [])}</article>
        <article class="data-card"><strong>热点原因</strong><p>${close.hotAnalysis ?? "需要结合成交额和新闻事件继续观察。"}</p></article>
        <article class="data-card"><strong>AI判断复盘</strong><p>${close.aiReview ?? close.summary}</p></article>
        <article class="data-card"><strong>明日观察方向</strong>${tagList(close.nextFocus ?? [])}</article>
      </div>
      <div class="sub-panel compact"><h2>重要事件</h2>${tagList(close.events ?? [])}</div>
      <p class="side-note">数据来源：${(close.sources ?? ["东方财富行情", "新闻/公告", "AI分析"]).join("、")}。更新时间：${close.generatedAt ?? "手动生成"}。可信度：${close.credibility?.level ?? "中"}（${close.credibility?.score ?? close.quality?.score ?? 0}分）。</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>历史报告列表</h2><span>点击查看详情</span></div>
      <div class="report-list clickable-reports">${reportList(history)}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>日报详情</h2><span>${selectedReport.date}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${selectedReport.marketSummary ?? close.summary}</p></article>
        <article class="data-card"><strong>热点分析</strong><p>${selectedReport.hotAnalysis ?? (close.hotSectors ?? []).join("、")}</p></article>
        <article class="data-card"><strong>明日策略</strong><p>${selectedReport.nextStrategy ?? (close.nextFocus ?? []).join("、")}</p></article>
      </div>
      <div class="sub-panel compact"><h2>风险提醒</h2>${(selectedReport.risks ?? morning.risks ?? []).map(riskCard).join("")}</div>
    </section>`;
}

export function mountDailyReport({ rerender }) {
  document.querySelector("#generate-report-button")?.addEventListener("click", async () => {
    const message = document.querySelector("#daily-report-message");
    if (message) message.textContent = "正在采集数据并生成报告...";
    await generateTodayReport();
    await notifyByType("manual-report");
    if (message) message.textContent = "今日报告已生成并保存。";
    rerender();
  });

  document.querySelectorAll(".clickable-reports .report-row").forEach((row, index) => {
    row.addEventListener("click", () => {
      selectDailyReport(index);
      rerender();
    });
  });
}

function formatReviewStatus(status) {
  if (status === "correct") return "判断正确";
  if (status === "wrong") return "判断错误";
  return "待复盘";
}
