const N = {
  semi: "\u534a\u5bfc\u4f53",
  optical: "\u5149\u6a21\u5757",
  comm: "\u901a\u4fe1",
  power: "\u7535\u529b",
  storage: "\u50a8\u80fd",
  resource: "\u8d44\u6e90",
  estate: "\u5730\u4ea7",
  domestic: "\u56fd\u4ea7\u66ff\u4ee3",
};

const industries = {
  AI: industry("AI", "\u5927\u6a21\u578b\u5e94\u7528\u4ece\u8bad\u7ec3\u8d70\u5411\u63a8\u7406\uff0c\u7b97\u529b\u3001\u670d\u52a1\u5668\u3001\u82af\u7247\u3001\u5149\u6a21\u5757\u548c\u7535\u529b\u914d\u5957\u5171\u540c\u6784\u6210\u4ea7\u4e1a\u94fe\u3002", ["\u7b97\u529b\u57fa\u7840\u8bbe\u65bd", "AI\u670d\u52a1\u5668", "\u82af\u7247", N.optical, "\u5e94\u7528\u8f6f\u4ef6"], ["\u670d\u52a1\u5668", N.power, N.optical], ["\u4f30\u503c\u8fc7\u9ad8", "\u8ba2\u5355\u5151\u73b0\u4e0d\u53ca\u9884\u671f", "\u6d77\u5916\u4f9b\u5e94\u9650\u5236"]),
  [N.semi]: industry(N.semi, "\u56fd\u4ea7\u66ff\u4ee3\u3001\u5148\u8fdb\u5c01\u88c5\u548cAI\u82af\u7247\u9700\u6c42\u6784\u6210\u4e2d\u957f\u671f\u4e3b\u7ebf\uff0c\u4f46\u5468\u671f\u6ce2\u52a8\u4ecd\u660e\u663e\u3002", ["\u8bbe\u5907", "\u6750\u6599", "\u8bbe\u8ba1", "\u5236\u9020", "\u5c01\u6d4b"], ["\u8bbe\u5907\u6750\u6599", "\u5148\u8fdb\u5c01\u88c5", "\u6676\u5706\u4ee3\u5de5"], ["\u5468\u671f\u590d\u82cf\u6162", "\u5916\u90e8\u9650\u5236", "\u4f30\u503c\u504f\u9ad8"]),
  [N.optical]: industry(N.optical, "AI\u6570\u636e\u4e2d\u5fc3\u9ad8\u901f\u4e92\u8054\u5e26\u52a8800G\u548c1.6T\u9700\u6c42\uff0c\u4e1a\u7ee9\u5f39\u6027\u96c6\u4e2d\u5728\u5934\u90e8\u516c\u53f8\u3002", ["\u5149\u82af\u7247", "\u5149\u5668\u4ef6", "\u6a21\u5757\u5c01\u88c5", "\u4e91\u5382\u5546"], ["\u9ad8\u901f\u5149\u6a21\u5757", "\u6570\u636e\u4e2d\u5fc3", "\u6d77\u5916\u94fe"], ["\u5ba2\u6237\u96c6\u4e2d", "\u4ef7\u683c\u7ade\u4e89", "\u9884\u671f\u8fc7\u6ee1"]),
  [N.comm]: industry(N.comm, "\u901a\u4fe1\u8bbe\u5907\u53d7\u76ca\u4e8e\u6570\u636e\u4e2d\u5fc3\u30015G-A\u3001\u536b\u661f\u4e92\u8054\u7f51\u548c\u7b97\u529b\u7f51\u7edc\u5efa\u8bbe\u3002", ["\u8fd0\u8425\u5546", "\u8bbe\u5907\u5546", "\u5149\u901a\u4fe1", "\u7ec8\u7aef"], ["\u901a\u4fe1\u8bbe\u5907", "\u7f51\u7edc\u4f18\u5316", "\u536b\u661f\u4e92\u8054\u7f51"], ["\u8d44\u672c\u5f00\u652f\u6ce2\u52a8", "\u7ade\u4e89\u52a0\u5267", "\u9879\u76ee\u8282\u594f\u4e0d\u786e\u5b9a"]),
  [N.power]: industry(N.power, "AI\u6570\u636e\u4e2d\u5fc3\u7528\u7535\u589e\u957f\u63d0\u5347\u7535\u7f51\u3001\u7535\u6e90\u548c\u7535\u529b\u8bbe\u5907\u91cd\u8981\u6027\u3002", ["\u53d1\u7535", "\u7535\u7f51", "\u914d\u7535", "\u7528\u7535\u4fa7"], ["\u7535\u7f51\u8bbe\u5907", "\u7535\u529b\u8fd0\u8425", "\u6570\u636e\u4e2d\u5fc3\u7535\u529b"], ["\u653f\u7b56\u7535\u4ef7\u53d8\u5316", "\u5efa\u8bbe\u8282\u594f", "\u539f\u6750\u6599\u4ef7\u683c"]),
  [N.storage]: industry(N.storage, "\u65b0\u80fd\u6e90\u6d88\u7eb3\u3001\u7535\u529b\u5e02\u573a\u5316\u548c\u6570\u636e\u4e2d\u5fc3\u5907\u7535\u9700\u6c42\u63a8\u52a8\u50a8\u80fd\u5e94\u7528\u6269\u5c55\u3002", ["\u7535\u82af", "PCS", "\u7cfb\u7edf\u96c6\u6210", "\u8fd0\u8425"], ["\u6d77\u5916\u50a8\u80fd", "\u5de5\u5546\u4e1a\u50a8\u80fd", "\u6570\u636e\u4e2d\u5fc3\u5907\u7535"], ["\u4ef7\u683c\u7ade\u4e89", "\u6d77\u5916\u653f\u7b56", "\u6bdb\u5229\u7387\u538b\u529b"]),
  [N.resource]: industry(N.resource, "\u8d44\u6e90\u54c1\u53d7\u4f9b\u9700\u3001\u4ef7\u683c\u5468\u671f\u548c\u5168\u7403\u5b8f\u89c2\u5f71\u54cd\uff0c\u9002\u5408\u5173\u6ce8\u5468\u671f\u4f4d\u7f6e\u548c\u5e93\u5b58\u53d8\u5316\u3002", ["\u80fd\u6e90", "\u6709\u8272", "\u5316\u5de5", "\u6750\u6599"], ["\u6709\u8272\u91d1\u5c5e", "\u80fd\u6e90\u4ef7\u683c", "\u5468\u671f\u4fee\u590d"], ["\u4ef7\u683c\u6ce2\u52a8", "\u9700\u6c42\u8d70\u5f31", "\u653f\u7b56\u6270\u52a8"]),
  [N.estate]: industry(N.estate, "\u5730\u4ea7\u94fe\u5904\u4e8e\u653f\u7b56\u4fee\u590d\u548c\u57fa\u672c\u9762\u9a8c\u8bc1\u9636\u6bb5\uff0c\u91cd\u70b9\u89c2\u5bdf\u9500\u552e\u3001\u878d\u8d44\u548c\u7ae3\u5de5\u6570\u636e\u3002", ["\u5f00\u53d1", "\u7269\u4e1a", "\u5efa\u6750", "\u5bb6\u5c45"], ["\u653f\u7b56\u4fee\u590d", "\u7ae3\u5de5\u94fe", "\u4f4e\u4f30\u503c"], ["\u9500\u552e\u4e0d\u53ca\u9884\u671f", "\u4fe1\u7528\u98ce\u9669", "\u5e93\u5b58\u538b\u529b"]),
};

export function getIndustryOptions() {
  return Object.keys(industries);
}

export function getIndustryResearchData(name = "AI") {
  return industries[name] ?? industries.AI;
}

export async function getIndustryAiResearchData(name = "AI") {
  const base = getIndustryResearchData(name);
  try {
    const [marketData, newsSnapshot] = await Promise.all([getMarketSnapshot(), getNewsSnapshot()]);
    const relatedNews = (newsSnapshot.stockNews ?? newsSnapshot.news ?? []).filter((item) => {
      const text = `${item.title ?? ""}${item.category ?? ""}${item.relatedIndustry ?? ""}`;
      return text.includes(base.industry) || base.chain.some((node) => text.includes(node.name));
    });
    const riskData = base.risks.map((risk) => ({ title: risk, message: `${base.industry}行业风险：${risk}`, level: "中" }));
    const aiInput = buildAiResearchInput({
      marketData,
      stockQuote: { name: base.industry, code: "INDUSTRY", industry: base.industry, type: "industry" },
      newsEvents: relatedNews.length ? relatedNews : base.news,
      riskData,
      investmentProfile: getInvestmentProfile(),
      portfolio: [],
    });
    const aiAnalysis = await generateAiAnalysis(aiInput);
    return { ...base, aiAnalysis };
  } catch {
    return { ...base, aiAnalysis: null };
  }
}

function industry(name, overview, chain, beneficiaries, risks) {
  return {
    industry: name,
    overview,
    risks,
    trend: name === N.estate ? "\u9707\u8361\u4fee\u590d" : name === N.resource ? "\u5468\u671f\u9707\u8361" : "\u7ed3\u6784\u5411\u4e0a",
    chain: chain.map((item) => ({
      name: item,
      logic: `${item} \u662f${name}\u4ea7\u4e1a\u94fe\u7684\u91cd\u8981\u73af\u8282\uff0c\u5173\u6ce8\u8ba2\u5355\u3001\u4ef7\u683c\u548c\u76c8\u5229\u80fd\u529b\u53d8\u5316\u3002`,
      leaders: sampleLeaders(name),
      catalysts: ["\u653f\u7b56\u652f\u6301", "\u9700\u6c42\u6539\u5584", "\u8d44\u91d1\u5173\u6ce8"],
      risks,
    })),
    news: [
      { source: "\u8d22\u8054\u793e/\u884c\u4e1a\u65b0\u95fb", date: "2026-08-08", event: "\u67d0\u516c\u53f8\u589e\u52a0AI\u670d\u52a1\u5668\u6295\u8d44", impact: "\u589e\u52a0\u7b97\u529b\u9700\u6c42", beneficiaries, risk: risks[0] },
      { source: "\u516c\u53f8\u516c\u544a/\u516c\u5f00\u4fe1\u606f", date: "2026-08-07", event: `${name}\u76f8\u5173\u516c\u53f8\u62ab\u9732\u8ba2\u5355\u6216\u9879\u76ee\u8fdb\u5c55`, impact: "\u63d0\u5347\u5e02\u573a\u5173\u6ce8\u5ea6\uff0c\u4f46\u9700\u8981\u540e\u7eed\u4e1a\u7ee9\u9a8c\u8bc1", beneficiaries: beneficiaries.slice(0, 2), risk: risks[1] ?? risks[0] },
      { source: "\u653f\u7b56\u4fe1\u606f", date: "2026-08-06", event: `${name}\u65b9\u5411\u51fa\u73b0\u653f\u7b56\u6216\u4ea7\u4e1a\u50ac\u5316`, impact: "\u6539\u5584\u884c\u4e1a\u9884\u671f", beneficiaries, risk: risks[2] ?? risks[0] },
    ],
    credibility: {
      level: "\u4e2d",
      reason: "\u884c\u4e1a\u903b\u8f91\u548c\u4e8b\u4ef6\u4e3a\u7ed3\u6784\u5316\u7814\u7a76\u5e93\uff0c\u65b0\u95fb\u53ef\u7531\u771f\u5b9e\u63a5\u53e3\u8865\u5145\uff1b\u90e8\u5206\u5185\u5bb9\u4ecd\u53ef\u80fd\u56de\u9000\u6a21\u62df\u3002",
      sources: ["\u4e1c\u65b9\u8d22\u5bcc\u884c\u60c5", "\u516c\u53f8\u516c\u544a", "\u884c\u4e1a\u65b0\u95fb", "\u653f\u7b56\u4fe1\u606f", "AI\u5206\u6790"],
    },
  };
}

function sampleLeaders(industryName) {
  const map = {
    AI: ["\u5de5\u4e1a\u5bcc\u8054", "\u6d6a\u6f6e\u4fe1\u606f", "\u4e2d\u79d1\u66d9\u5149"],
    [N.semi]: ["\u4e2d\u82af\u56fd\u9645", "\u5317\u65b9\u534e\u521b", "\u5bd2\u6b66\u7eaa"],
    [N.optical]: ["\u4e2d\u9645\u65ed\u521b", "\u65b0\u6613\u76db", "\u5929\u5b5a\u901a\u4fe1"],
    [N.comm]: ["\u4e2d\u5174\u901a\u8baf", "\u70fd\u706b\u901a\u4fe1", "\u4e2d\u56fd\u79fb\u52a8"],
    [N.power]: ["\u56fd\u7535\u5357\u745e", "\u8bb8\u7ee7\u7535\u6c14", "\u9633\u5149\u7535\u6e90"],
    [N.storage]: ["\u5b81\u5fb7\u65f6\u4ee3", "\u9633\u5149\u7535\u6e90", "\u79d1\u534e\u6570\u636e"],
    [N.resource]: ["\u7d2b\u91d1\u77ff\u4e1a", "\u4e2d\u56fd\u94dd\u4e1a", "\u4e2d\u56fd\u795e\u534e"],
    [N.estate]: ["\u4fdd\u5229\u53d1\u5c55", "\u4e07\u79d1A", "\u62db\u5546\u86c7\u53e3"],
  };
  return map[industryName] ?? [industryName];
}
import { buildAiResearchInput, generateAiAnalysis } from "./aiService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot } from "./newsService.js";
