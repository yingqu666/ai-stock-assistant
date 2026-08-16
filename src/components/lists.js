export function newsList(items) {
  return items.map((item) => {
    const impact = normalizeImpact(item.impact ?? item.category ?? item.type);
    return `
      <article class="list-row">
        <b>${impact}</b>
        <span>
          <strong>${item.title}</strong>
          <small>${item.source ?? item.type ?? "新闻"}｜${item.time ?? item.date ?? "时间待更新"}</small>
          <em>解读：${item.aiSummary ?? item.factSummary ?? item.aiInterpretation?.factSummary ?? "等待新闻事实摘要"}</em>
          <em>短期：${item.shortTermImpact ?? item.aiInterpretation?.shortTermImpact ?? shortTermImpact(item, impact)}</em>
          <em>长期：${item.longTermImpact ?? item.aiInterpretation?.longTermImpact ?? longTermImpact(item, impact)}</em>
        </span>
      </article>`;
  }).join("");
}

export function reportList(items) {
  return items.map((item) => `
    <article class="data-card report-row" role="button" tabindex="0">
      <div>
        <strong>${item.title}</strong>
        <small>${item.date}｜${item.type}</small>
      </div>
      <b>${item.score}分</b>
    </article>`).join("");
}

export function timelineList(items) {
  return items.map((item) => `
    <article class="timeline-row">
      <span>${item.date}</span>
      <div>
        <strong>${item.title ?? item.event}</strong>
        <p>${item.impact ?? item.analysis}</p>
      </div>
    </article>`).join("");
}

function normalizeImpact(value = "") {
  const text = String(value);
  if (/利好|增长|回购|增持|中标|订单|向好/.test(text)) return "利好";
  if (/利空|下滑|减持|亏损|处罚|风险/.test(text)) return "利空";
  return "中性";
}

function shortTermImpact(item, impact) {
  const title = item.title ?? "该事件";
  if (impact === "利好") return `${title}可能短期提升相关方向关注度，但需要观察成交额、龙头表现和板块联动，不能仅凭单条新闻判断持续性。`;
  if (impact === "利空") return `${title}可能短期压制风险偏好，需要观察是否扩散到相关行业，以及市场是否已经提前反映。`;
  return `${title}短期影响偏中性，更多作为信息补充，等待行情、成交和后续消息确认。`;
}

function longTermImpact(item, impact) {
  if (impact === "利好") return "长期需要验证是否转化为行业景气、订单增长、盈利改善或现金流改善，单条新闻不能直接推导长期结论。";
  if (impact === "利空") return "长期需要跟踪是否影响需求、利润率、现金流或估值中枢，并结合后续公告和财务数据复核。";
  return "长期影响取决于事件持续性，以及后续财务、公告和行业趋势是否共同验证。";
}
