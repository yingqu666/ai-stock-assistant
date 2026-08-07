import { metricCard, riskCard, tagList } from "../components/cards.js";
import { reportList } from "../components/lists.js";
import { getReviewChartData } from "../services/chartService.js";
import { generateTodayReport, getDailyReportData, selectDailyReport } from "../services/mockService.js";
import { getSyncStatus } from "../services/syncService.js";
import { notifyByType } from "../services/notificationService.js";

export async function renderDailyReport() {
  const [{ dailyReport, selectedReport, taskSchedule, taskStatus, savedReports }, reviewData] = await Promise.all([
    getDailyReportData(),
    getReviewChartData(),
  ]);
  const { morning, close, history } = dailyReport;
  const reportSync = getSyncStatus().reports ?? { status: "尚未同步", lastSyncAt: "尚未同步", source: "本地/云端" };

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI日报自动化</h2>
          <span>${reportSync.status} · ${reportSync.lastSyncAt} · ${reportSync.source ?? "Supabase/本地缓存"}</span>
        </div>
        <button id="generate-report-button" type="button">生成今日报告</button>
      </div>
      <div class="metrics">
        ${[
          { label: "行情已更新", value: taskStatus.marketUpdated ? "是" : "待执行", change: taskStatus.marketUpdated ? "完成" : "待生成" },
          { label: "新闻已获取", value: taskStatus.newsFetched ? "是" : "待执行", change: taskStatus.newsFetched ? "完成" : "待生成" },
          { label: "报告已生成", value: taskStatus.reportGenerated ? "是" : "待执行", change: taskStatus.lastRunAt },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${taskSchedule.map((task) => `<article class="data-card"><strong>${task.name}</strong><p>${task.time} · ${task.description}</p></article>`).join("")}
      </div>
      <p class="form-message">已保存报告：${savedReports.length} 份</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI历史表现</h2><span>历史表现不代表未来结果</span></div>
      <div class="metrics">
        ${[
          { label: "市场方向", value: `${reviewData.byType.market?.accuracy ?? 0}%`, change: `${reviewData.byType.market?.count ?? 0}条样本` },
          { label: "行业判断", value: `${reviewData.byType.industry?.accuracy ?? 0}%`, change: `${reviewData.byType.industry?.count ?? 0}条样本` },
          { label: "风险提醒", value: `${reviewData.byType.risk?.effectiveRate ?? 0}%`, change: `${reviewData.byType.risk?.count ?? 0}次提醒` },
          { label: "AI信心等级", value: reviewData.stats.confidenceLevel ?? "低", change: `综合可信度 ${reviewData.stats.credibilityScore ?? 0}分` },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>早盘分析</h2>
          <span>${morning.date} · 生成时间：${morning.generatedAt ?? "自动生成"}</span>
        </div>
      </div>
      <div class="metrics">
        ${[
          { label: "AI综合评分", value: `${morning.score}分`, change: "AI" },
          { label: "市场状态", value: morning.marketState, change: "东方财富/部分回退" },
          { label: "今日策略", value: "研究观察", change: "不追高" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        <article class="data-card"><strong>昨夜外围市场</strong><p>${morning.overseas ?? "美股和科技板块仅作为辅助观察，关注纳斯达克、标普500及科技方向对A股情绪的影响。"}</p></article>
        <article class="data-card"><strong>今日关注方向</strong>${tagList(morning.focus ?? [])}</article>
        <article class="data-card"><strong>自选股重点观察</strong>${tagList((morning.watchFocus ?? morning.focus ?? []).slice(0, 4))}</article>
      </div>
      <p class="answer">${morning.strategy}</p>
      <div class="split-section compact">
        <div class="sub-panel"><h2>风险提醒</h2>${(morning.risks ?? []).map(riskCard).join("")}</div>
        <div class="sub-panel"><h2>数据依据</h2><p>来源：${(morning.sources ?? ["marketService", "newsService", "AI"]).join("、")}</p><p>更新时间：${morning.generatedAt ?? "自动生成"} · 状态：真实/部分回退/mock</p></div>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>收盘复盘</h2><span>生成时间：${close.generatedAt ?? "自动生成"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>今日市场总结</strong><p>${close.performance}</p></article>
        <article class="data-card"><strong>涨跌情况</strong><p>${close.breadth}</p></article>
        <article class="data-card"><strong>热点板块复盘</strong>${tagList(close.hotSectors ?? [])}</article>
      </div>
      <div class="split-section compact">
        <div class="sub-panel"><h2>AI判断复盘</h2><p>${close.summary}</p><p>来源：AI/fallback · 状态：${reportSync.status}</p></div>
        <div class="sub-panel"><h2>明日观察方向</h2>${tagList(close.nextFocus ?? [])}</div>
      </div>
      <div class="sub-panel compact"><h2>重要事件</h2>${tagList(close.events ?? [])}</div>
      <p class="side-note">数据来源：${(close.sources ?? ["marketService", "newsService", "aiService"]).join("、")}。更新时间：${close.generatedAt ?? "自动生成"}。状态：真实/部分回退/mock。</p>
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
    await generateTodayReport();
    await notifyByType("manual-report");
    rerender();
  });

  document.querySelectorAll(".clickable-reports .report-row").forEach((row, index) => {
    row.addEventListener("click", () => {
      selectDailyReport(index);
      rerender();
    });
  });
}
