import { aiHistory } from "../data.js";
import { getHistory, saveHistory } from "./storageService.js";

export async function getAiHistoryRecords() {
  const saved = await getHistory();
  return [...saved, ...aiHistory];
}

export async function saveAiHistoryRecord(record) {
  return saveHistory({ ...record, id: record.id ?? `${Date.now()}` });
}

export async function saveMarketAnalysisHistory(aiAnalysis = {}, marketData = {}, newsSnapshot = {}) {
  const date = todayKey();
  const sentiment = marketData.marketSentiment ?? {};
  const hotSectors = (marketData.hotSectors ?? []).slice(0, 12);
  const risks = normalizeRiskTexts(aiAnalysis.riskReminders ?? aiAnalysis.risks);
  const mainDirections = normalizeDirectionTexts(aiAnalysis.mainDirections ?? aiAnalysis.hotDirections);
  return saveAiHistoryRecord({
    id: `market-analysis-${date}`,
    date,
    targetDate: nextDateKey(date),
    predictionType: "market",
    prediction: {
      marketDirection: aiAnalysis.currentMarketJudgment ?? aiAnalysis.investmentDecision?.marketTrend ?? aiAnalysis.marketSummary ?? "市场判断待补充",
      sectors: mainDirections.map((item) => item.name ?? item).filter(Boolean).slice(0, 6),
      risks: risks.map((item) => item.target ? `${item.target}：${item.reason ?? ""}` : String(item)).filter(Boolean).slice(0, 6),
    },
    predictionContent: {
      marketState: aiAnalysis.currentMarketJudgment ?? aiAnalysis.investmentDecision?.marketTrend ?? "市场判断待补充",
      mainDirections,
      riskDirections: risks,
      operationPlan: aiAnalysis.operationPlan ?? aiAnalysis.observationAdvice ?? "等待市场数据进一步确认",
      aiSource: aiAnalysis.source ?? "fallback",
      marketSnapshotSummary: buildMarketSnapshotSummary(marketData),
      evidence: aiAnalysis.evidence ?? aiAnalysis.conclusionBasis ?? {},
      newsSource: newsSnapshot.source,
    },
    marketPrediction: aiAnalysis.currentMarketJudgment ?? aiAnalysis.marketSummary ?? "",
    actualResult: null,
    accuracyScore: null,
    reviewStatus: "pending",
    source: aiAnalysis.source ?? "fallback",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function saveStockAnalysisHistory(aiAnalysis = {}, stockDetail = {}, context = {}) {
  const date = todayKey();
  const code = stockDetail.code ?? context.stockCode ?? "unknown";
  const decision = aiAnalysis.investmentDecision ?? {};
  await updatePreviousStockOutcomes(code, stockDetail, aiAnalysis).catch(() => null);
  return saveAiHistoryRecord({
    id: `stock-analysis-${date}-${code}`,
    date,
    targetDate: tradingDateKey(date, 5),
    predictionType: "stock",
    prediction: {
      stockCode: code,
      stockName: stockDetail.name ?? "",
      rating: decision.rating ?? aiAnalysis.currentJudgement ?? "数据不足",
      score: typeof decision.score === "number" ? decision.score : null,
      shortTerm: decision.shortTerm ?? aiAnalysis.shortTermObservation ?? "",
      midTerm: decision.midTerm ?? aiAnalysis.midLongTermObservation ?? "",
      action: decision.action ?? "",
    },
    predictionContent: {
      stockCode: code,
      stockName: stockDetail.name ?? "",
      assetType: stockDetail.assetType ?? stockDetail.securityType ?? "",
      analysisDate: date,
      marketEnvironment: summarizeMarketEnvironment(context.marketData),
      sectorStatus: summarizeSectorStatus(stockDetail, context.marketData),
      newsCatalysts: summarizeNewsCatalysts(stockDetail, context.newsData ?? context.newsEvents),
      dataQuality: stockDetail.dataQuality,
      quote: {
        price: stockDetail.price,
        changePercent: stockDetail.changePercent,
        amount: stockDetail.amount,
        volume: stockDetail.volume,
        turnoverRate: stockDetail.turnoverRate,
        source: stockDetail.quoteSource ?? stockDetail.dataSource,
        updatedAt: stockDetail.updatedAt,
      },
      attentionReasons: aiAnalysis.attentionReasons ?? [],
      observeConditions: aiAnalysis.observeConditions ?? {},
      currentOpportunityLogic: aiAnalysis.currentOpportunityLogic ?? "",
      maximumRisk: aiAnalysis.maximumRisk ?? "",
      validationPoints: aiAnalysis.validationPoints ?? [],
      investmentDecision: decision,
      evidence: aiAnalysis.evidence ?? aiAnalysis.basis ?? {},
      aiSource: aiAnalysis.source ?? "fallback",
    },
    followUp5d: { status: "pending", targetDate: tradingDateKey(date, 5), message: "等待后续行情复盘" },
    followUp20d: { status: "pending", targetDate: tradingDateKey(date, 20), message: "等待后续行情复盘" },
    actualResult: null,
    accuracyScore: null,
    reviewStatus: "pending",
    source: aiAnalysis.source ?? "fallback",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function getMarketAnalysisHistory() {
  const records = await getAiHistoryRecords();
  return records
    .filter((item) => (item.predictionType ?? item.prediction_type) === "market" && (item.id?.startsWith?.("market-analysis-") || item.predictionContent?.operationPlan))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export async function getStockAnalysisHistory() {
  const records = await getAiHistoryRecords();
  return records
    .filter((item) => (item.predictionType ?? item.prediction_type) === "stock")
    .sort((a, b) => String(b.updatedAt ?? b.id ?? "").localeCompare(String(a.updatedAt ?? a.id ?? "")));
}

export async function getStockReviewSummary() {
  const history = await getStockAnalysisHistory();
  const reviewed = history.filter((item) => item.reviewStatus && item.reviewStatus !== "pending");
  const success = reviewed.filter((item) => item.reviewStatus === "correct").length;
  const failed = reviewed.filter((item) => item.reviewStatus === "wrong").length;
  const pending = history.length - reviewed.length;
  return {
    total: history.length,
    success,
    failed,
    pending,
    successRate: reviewed.length ? Math.round((success / reviewed.length) * 100) : 0,
    latest: history.slice(0, 10).map((item) => ({
      code: item.prediction?.stockCode,
      name: item.prediction?.stockName,
      date: item.date,
      rating: item.prediction?.rating,
      followUp5d: item.followUp5d,
      followUp20d: item.followUp20d,
      reviewStatus: item.reviewStatus,
      possibleReason: item.reviewReason ?? item.actualResult?.possibleReason ?? "等待后续数据积累",
    })),
  };
}

export async function getAiPerformanceReport() {
  const records = await getAiHistoryRecords();
  const marketRecords = records.filter((item) => (item.predictionType ?? item.prediction_type) === "market");
  const stockRecords = records.filter((item) => (item.predictionType ?? item.prediction_type) === "stock");
  const marketStats = buildStatusStats(marketRecords);
  const stock5dStats = buildFollowUpStats(stockRecords, "followUp5d");
  const stock20dStats = buildFollowUpStats(stockRecords, "followUp20d");
  const errorAnalysis = buildAiErrorAnalysis(records);
  return {
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    market: {
      label: "市场判断",
      ...marketStats,
    },
    stock5d: {
      label: "股票5日判断",
      ...stock5dStats,
    },
    stock20d: {
      label: "股票20日判断",
      ...stock20dStats,
    },
    total: {
      count: marketStats.count + stock5dStats.count + stock20dStats.count,
      success: marketStats.success + stock5dStats.success + stock20dStats.success,
      failed: marketStats.failed + stock5dStats.failed + stock20dStats.failed,
      pending: marketStats.pending + stock5dStats.pending + stock20dStats.pending,
      accuracy: weightedAccuracy([marketStats, stock5dStats, stock20dStats]),
    },
    errorAnalysis,
    riskHints: buildAiHistoryRiskHints(errorAnalysis, { marketStats, stock5dStats, stock20dStats }),
  };
}

export async function getUserResearchDataSummary({ watchlist = [], portfolio = null, reports = [] } = {}) {
  const history = await getAiHistoryRecords();
  const marketHistory = history.filter((item) => (item.predictionType ?? item.prediction_type) === "market");
  const stockHistory = history.filter((item) => (item.predictionType ?? item.prediction_type) === "stock");
  const reviewed = history.filter((item) => item.reviewStatus && item.reviewStatus !== "pending");
  const preferenceWeights = buildUserPreferenceWeights({ watchlist, portfolio, history });
  return {
    watchlistCount: watchlist.length,
    portfolioCount: portfolio?.positions?.length ?? 0,
    reportCount: reports.length,
    stockAnalysisHistoryCount: stockHistory.length,
    marketAnalysisHistoryCount: marketHistory.length,
    reviewRecordCount: reviewed.length,
    lastStockAnalysisAt: stockHistory[0]?.updatedAt ?? stockHistory[0]?.createdAt ?? "暂无",
    lastMarketAnalysisAt: marketHistory[0]?.updatedAt ?? marketHistory[0]?.createdAt ?? "暂无",
    preferenceWeights,
  };
}

export async function getUserPreferenceWeights({ watchlist = [], portfolio = null, investmentProfile = null } = {}) {
  const history = await getAiHistoryRecords();
  return buildUserPreferenceWeights({ watchlist, portfolio, history, investmentProfile });
}

export async function updateMarketAnalysisReview(id, review = {}) {
  const records = await getAiHistoryRecords();
  const current = records.find((item) => item.id === id);
  if (!current) return { ok: false, message: "未找到对应AI市场判断记录。" };
  const status = normalizeReviewStatus(review.reviewStatus);
  const actualMarketMove = String(review.actualMarketMove ?? "").trim();
  const reviewNote = String(review.reviewNote ?? "").trim();
  const updated = {
    ...current,
    actualResult: {
      ...(current.actualResult ?? {}),
      marketMove: actualMarketMove,
      reviewStatus: status,
      reviewNote,
      reviewedAt: new Date().toISOString(),
    },
    reviewStatus: status,
    reviewNote,
    accuracyScore: status === "correct" ? 100 : status === "wrong" ? 0 : null,
    updatedAt: new Date().toISOString(),
  };
  await saveAiHistoryRecord(updated);
  return { ok: true, data: updated };
}

export async function getAiAccuracyStats() {
  const records = await getAiHistoryRecords();
  const total = records.length || 1;
  const marketCorrect = records.filter((item) => isMarketCorrect(item)).length;
  const riskEffective = records.filter((item) => item.actualResult?.riskVerified).length;
  const report = await getAiPerformanceReport();

  return {
    sampleSize: records.length,
    marketAccuracy: report.market.accuracy || Math.round((marketCorrect / total) * 100),
    riskAccuracy: Math.round((riskEffective / total) * 100),
    stock5dAccuracy: report.stock5d.accuracy,
    stock20dAccuracy: report.stock20d.accuracy,
    performanceReport: report,
  };
}

function isMarketCorrect(item) {
  const prediction = item.prediction?.marketDirection ?? "";
  const result = item.actualResult?.marketMove ?? "";
  if (prediction.includes("强") && result.includes("涨")) return true;
  if (prediction.includes("震荡") && result.includes("震荡")) return true;
  if (prediction.includes("弱") && result.includes("跌")) return true;
  return false;
}

function todayKey() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function nextDateKey(date) {
  const next = new Date(`${date}T00:00:00+08:00`);
  next.setDate(next.getDate() + 1);
  return next.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function tradingDateKey(date, days) {
  const next = new Date(`${date}T00:00:00+08:00`);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

async function updatePreviousStockOutcomes(code, stockDetail = {}, currentAnalysis = {}) {
  if (!code) return;
  const currentPrice = parseNumber(stockDetail.price);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
  const records = await getStockAnalysisHistory();
  const today = todayKey();
  const related = records.filter((item) => item.prediction?.stockCode === code && item.date && item.date < today);
  for (const record of related) {
    const days = daysBetween(record.date, today);
    const nextRecord = { ...record };
    let changed = false;
    if (days >= 5 && !hasCompletedFollowUp(record.followUp5d)) {
      nextRecord.followUp5d = buildFollowUpResult(record, stockDetail, currentPrice, 5);
      changed = true;
    }
    if (days >= 20 && !hasCompletedFollowUp(record.followUp20d)) {
      nextRecord.followUp20d = buildFollowUpResult(record, stockDetail, currentPrice, 20);
      changed = true;
    }
    if (changed) {
      const review = buildStockReviewResult(nextRecord, currentAnalysis);
      await saveAiHistoryRecord({
        ...nextRecord,
        reviewStatus: review.status,
        actualResult: review.actualResult,
        accuracyScore: review.accuracyScore,
        reviewReason: review.reason,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

function buildFollowUpResult(record = {}, stockDetail = {}, currentPrice, days) {
  const startPrice = parseNumber(record.predictionContent?.quote?.price);
  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    return { status: "insufficient", targetDate: tradingDateKey(record.date, days), message: "原始价格缺失，无法计算表现" };
  }
  const changePercent = ((currentPrice - startPrice) / startPrice) * 100;
  return {
    status: "completed",
    targetDate: tradingDateKey(record.date, days),
    checkedAt: new Date().toISOString(),
    startPrice,
    currentPrice,
    changePercent: Number(changePercent.toFixed(2)),
    marketPriceSource: stockDetail.dataSource ?? stockDetail.quoteSource ?? "stockService",
    summary: `${days}日后价格${changePercent >= 0 ? "上涨" : "下跌"}${Math.abs(changePercent).toFixed(2)}%`,
  };
}

function buildStockReviewResult(record = {}, currentAnalysis = {}) {
  const result = record.followUp20d?.status === "completed" ? record.followUp20d : record.followUp5d;
  if (!result || result.status !== "completed") {
    return { status: "pending", actualResult: null, accuracyScore: null, reason: "等待后续表现数据" };
  }
  const ratingText = `${record.prediction?.rating ?? ""}${record.prediction?.action ?? ""}${record.prediction?.shortTerm ?? ""}`;
  const positive = /重点关注|可以观察|关注|持有|偏强|上涨/.test(ratingText);
  const cautious = /等待|暂不参与|风险较高|降低|回避|偏弱|下跌/.test(ratingText);
  const change = Number(result.changePercent);
  let status = "pending";
  if (positive) status = change >= 0 ? "correct" : "wrong";
  else if (cautious) status = change <= 1 ? "correct" : "wrong";
  const reason = buildPossibleReason({ status, change, record, currentAnalysis });
  return {
    status,
    actualResult: {
      stockMove: result.summary,
      changePercent: change,
      reviewStatus: status,
      possibleReason: reason,
      reviewedAt: new Date().toISOString(),
    },
    accuracyScore: status === "correct" ? 100 : status === "wrong" ? 0 : null,
    reason,
  };
}

function buildPossibleReason({ status, change, record, currentAnalysis }) {
  const catalysts = record.predictionContent?.newsCatalysts ?? [];
  const sector = record.predictionContent?.sectorStatus?.summary ?? "板块状态数据不足";
  if (status === "correct") {
    return `判断成功可能来自板块方向与价格表现一致；当时板块：${sector}；新闻催化：${catalysts[0]?.title ?? "无强催化"}`;
  }
  if (status === "wrong") {
    return `判断失败可能来自市场风格变化、新闻催化未兑现或短线波动反向；后续涨跌幅${change.toFixed(2)}%，需复核当时依据。`;
  }
  return `等待更多价格数据；当前AI来源${currentAnalysis.source ?? "fallback"}。`;
}

function buildUserPreferenceWeights({ watchlist = [], portfolio = null, history = [], investmentProfile = null } = {}) {
  const weights = new Map();
  const add = (name, score, reason) => {
    const clean = normalizeIndustryName(name);
    if (!clean) return;
    const current = weights.get(clean) ?? { industry: clean, weight: 0, reasons: [] };
    current.weight += score;
    if (reason) current.reasons.push(reason);
    weights.set(clean, current);
  };
  (investmentProfile?.industries ?? investmentProfile?.focus ?? []).forEach((industry) => add(industry, 18, "投资档案关注行业"));
  watchlist.forEach((stock) => add(stock.industry, 10, `自选股：${stock.name ?? stock.code}`));
  (portfolio?.positions ?? []).forEach((position) => add(position.industry, Math.max(8, Number(position.weight ?? 0) / 2), `持仓：${position.name ?? position.code}`));
  history.filter((item) => (item.predictionType ?? item.prediction_type) === "stock").slice(0, 30).forEach((item) => {
    const sector = item.predictionContent?.sectorStatus?.industry ?? item.predictionContent?.sectorStatus?.name;
    add(sector, 4, `历史分析：${item.prediction?.stockName ?? item.prediction?.stockCode}`);
  });
  return [...weights.values()]
    .map((item) => ({ ...item, weight: Math.min(100, Math.round(item.weight)), reasons: [...new Set(item.reasons)].slice(0, 4) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);
}

function summarizeMarketEnvironment(marketData = {}) {
  const sentiment = marketData.marketSentiment ?? {};
  return {
    summary: sentiment.summary ?? marketData.strategy?.state ?? "市场环境数据暂缺",
    upCount: sentiment.upCount,
    downCount: sentiment.downCount,
    turnover: sentiment.turnover ?? sentiment.amount,
    moneyEffect: sentiment.moneyEffect,
    updatedAt: marketData.updatedAt,
  };
}

function summarizeSectorStatus(stockDetail = {}, marketData = {}) {
  const industry = stockDetail.industry;
  const sector = (marketData.hotSectors ?? []).find((item) => {
    const name = String(item.name ?? "");
    return industry && (name.includes(industry) || String(industry).includes(name));
  });
  return {
    industry,
    name: sector?.name,
    changePercent: sector?.changePercent ?? sector?.change,
    amount: sector?.amount ?? sector?.turnover,
    summary: sector ? `${sector.name}位于热点板块，涨跌幅${sector.changePercent ?? sector.change ?? "未返回"}` : `${industry ?? "行业数据暂缺"}暂未匹配到热点TOP数据`,
  };
}

function summarizeNewsCatalysts(stockDetail = {}, newsEvents = []) {
  const rows = Array.isArray(newsEvents) ? newsEvents : [];
  const code = String(stockDetail.code ?? "");
  const name = String(stockDetail.name ?? "");
  const industry = String(stockDetail.industry ?? "");
  return rows.filter((item) => {
    const text = `${item.title ?? ""}${item.relatedStock ?? ""}${(item.relatedStocks ?? []).join("")}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
    return (code && text.includes(code)) || (name && text.includes(name)) || (industry && text.includes(industry));
  }).slice(0, 5).map((item) => ({
    title: item.title,
    source: item.source,
    time: item.time,
    impact: item.impact ?? item.analysis?.direction ?? "中性",
  }));
}

function normalizeIndustryName(name) {
  const text = String(name ?? "").trim();
  if (!text || /待补充|暂缺|未返回|其他/.test(text)) return "";
  return text.replace(/行业|板块/g, "");
}

function parseNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function hasCompletedFollowUp(value) {
  return value?.status === "completed" || value?.status === "insufficient";
}

function buildStatusStats(records = []) {
  const success = records.filter((item) => item.reviewStatus === "correct").length;
  const failed = records.filter((item) => item.reviewStatus === "wrong").length;
  const pending = records.length - success - failed;
  const reviewed = success + failed;
  return {
    count: records.length,
    success,
    failed,
    pending,
    accuracy: reviewed ? Math.round((success / reviewed) * 100) : 0,
  };
}

function buildFollowUpStats(records = [], key) {
  const completed = records.filter((item) => item[key]?.status === "completed");
  const success = completed.filter((item) => isFollowUpSuccessful(item, item[key])).length;
  const failed = completed.length - success;
  const pending = records.length - completed.length;
  return {
    count: records.length,
    completed: completed.length,
    success,
    failed,
    pending,
    accuracy: completed.length ? Math.round((success / completed.length) * 100) : 0,
  };
}

function isFollowUpSuccessful(record = {}, followUp = {}) {
  const ratingText = `${record.prediction?.rating ?? ""}${record.prediction?.action ?? ""}${record.prediction?.shortTerm ?? ""}${record.prediction?.midTerm ?? ""}`;
  const change = Number(followUp.changePercent);
  if (!Number.isFinite(change)) return false;
  if (/重点关注|可以观察|关注|持有|偏强|上涨/.test(ratingText)) return change >= 0;
  if (/等待|暂不参与|风险较高|降低|回避|偏弱|下跌/.test(ratingText)) return change <= 1;
  return Math.abs(change) <= 2;
}

function weightedAccuracy(stats = []) {
  const reviewed = stats.reduce((sum, item) => sum + Number(item.success ?? 0) + Number(item.failed ?? 0), 0);
  if (!reviewed) return 0;
  const success = stats.reduce((sum, item) => sum + Number(item.success ?? 0), 0);
  return Math.round((success / reviewed) * 100);
}

function buildAiErrorAnalysis(records = []) {
  const failed = records.filter((item) => item.reviewStatus === "wrong" || isFailedFollowUp(item.followUp5d) || isFailedFollowUp(item.followUp20d));
  const buckets = {
    industry: { label: "行业判断错误", count: 0, reasons: [] },
    timing: { label: "时间判断错误", count: 0, reasons: [] },
    risk: { label: "风险低估", count: 0, reasons: [] },
    price: { label: "价格判断错误", count: 0, reasons: [] },
  };
  failed.forEach((item) => {
    const text = JSON.stringify(item);
    const name = item.prediction?.stockName ?? item.prediction?.stockCode ?? item.prediction?.marketDirection ?? item.date ?? "历史判断";
    if (/行业|板块|热点|主线|sector|hot/.test(text)) addErrorBucket(buckets.industry, `${name}：板块或行业持续性判断需要复核`);
    if (/短期|明日|5日|1-5|timing|targetDate/.test(text)) addErrorBucket(buckets.timing, `${name}：时间窗口可能过短或节奏判断偏差`);
    if (/风险|回撤|利空|退潮|跌|risk/.test(text)) addErrorBucket(buckets.risk, `${name}：风险暴露可能被低估`);
    if (/价格|支撑|压力|区间|followUp|price/.test(text)) addErrorBucket(buckets.price, `${name}：价格观察区间或确认条件需要复核`);
  });
  return Object.values(buckets).map((item) => ({
    ...item,
    severity: item.count >= 3 ? "高" : item.count >= 1 ? "中" : "低",
    reasons: item.reasons.slice(0, 5),
  }));
}

function addErrorBucket(bucket, reason) {
  bucket.count += 1;
  if (reason && !bucket.reasons.includes(reason)) bucket.reasons.push(reason);
}

function isFailedFollowUp(followUp = {}) {
  return followUp.status === "completed" && Number.isFinite(Number(followUp.changePercent)) && Number(followUp.changePercent) < -2;
}

function buildAiHistoryRiskHints(errorAnalysis = [], stats = {}) {
  const hints = [];
  errorAnalysis.filter((item) => item.count > 0).forEach((item) => {
    hints.push({
      type: "AI历史错误风险",
      target: item.label,
      level: item.severity,
      message: `${item.label}出现${item.count}次，后续报告需要降低对应结论置信度。`,
    });
  });
  if ((stats.stock5dStats?.accuracy ?? 0) > 0 && stats.stock5dStats.accuracy < 50) {
    hints.push({ type: "AI历史错误风险", target: "短线判断", level: "高", message: "股票5日判断准确率低于50%，短线结论需要更谨慎。" });
  }
  if ((stats.stock20dStats?.accuracy ?? 0) > 0 && stats.stock20dStats.accuracy < 50) {
    hints.push({ type: "AI历史错误风险", target: "中线判断", level: "中", message: "股票20日判断准确率偏低，中线观察条件需要复核。" });
  }
  return hints;
}

function buildMarketSnapshotSummary(marketData = {}) {
  const sentiment = marketData.marketSentiment ?? {};
  const overview = marketData.marketOverview ?? [];
  return {
    updatedAt: marketData.updatedAt,
    source: marketData.source,
    dataStatus: marketData.dataStatus,
    indexes: overview.slice(0, 4).map((item) => `${item.label}:${item.value}${item.change ? `(${item.change})` : ""}`),
    breadth: {
      upCount: sentiment.upCount,
      downCount: sentiment.downCount,
      flatCount: sentiment.flatCount,
      limitUpCount: sentiment.limitUpCount,
      limitDownCount: sentiment.limitDownCount,
      turnover: sentiment.turnover,
      moneyEffect: sentiment.moneyEffect,
    },
    hotSectors: (marketData.hotSectors ?? []).slice(0, 12).map((item) => ({
      name: item.name,
      changePercent: item.changePercent ?? item.change,
      amount: item.amount ?? item.turnover,
      heatRank: item.heatRank ?? item.rank,
    })),
  };
}

function normalizeDirectionTexts(items = []) {
  return (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 6).map((item) => {
    if (typeof item === "string") return { name: item, reason: item };
    return {
      name: item.name ?? "主线方向",
      reason: item.reason ?? item.catalyst ?? item.summary ?? "依据待补充",
      sustainability: item.sustainability ?? "待复核",
      risk: item.risk ?? "热点退潮或成交缩量",
    };
  });
}

function normalizeRiskTexts(items = []) {
  return (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 6).map((item) => {
    if (typeof item === "string") return { target: "市场", reason: item };
    return {
      target: item.target ?? "市场",
      reason: item.reason ?? item.message ?? item.summary ?? "风险原因待补充",
      shortTermImpact: item.shortTermImpact,
      midTermImpact: item.midTermImpact,
    };
  });
}

function normalizeReviewStatus(status) {
  return ["pending", "correct", "wrong"].includes(status) ? status : "pending";
}
