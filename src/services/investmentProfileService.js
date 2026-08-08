import { getUserStoragePrefix } from "./userService.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const profileKey = "ai-investment-profile-v2";

export const industryOptions = ["AI", "\u534a\u5bfc\u4f53", "\u5149\u6a21\u5757", "\u7535\u529b", "\u50a8\u80fd", "\u8d44\u6e90", "\u56fd\u4ea7\u66ff\u4ee3"];
export const styleOptions = ["\u7a33\u5065", "\u6210\u957f", "\u6fc0\u8fdb"];
export const capitalOptions = ["5000\u4ee5\u4e0b", "5000-50000", "5\u4e07\u4ee5\u4e0a"];
export const holdingPeriodOptions = ["\u77ed\u7ebf", "\u6ce2\u6bb5", "\u957f\u671f"];
export const riskOptions = ["\u4f4e", "\u4e2d", "\u9ad8"];

export function getInvestmentProfile() {
  const saved = loadProfile();
  return {
    preference: `${saved.style}\u98ce\u683c\uff0c\u8d44\u91d1\u89c4\u6a21${saved.capitalSize}\uff0c\u6301\u4ed3\u5468\u671f${saved.holdingPeriod}\uff0c\u98ce\u9669\u63a5\u53d7${saved.riskLevel}`,
    industries: saved.industries,
    focus: saved.industries,
    riskLevel: saved.riskLevel,
    style: saved.style,
    capitalSize: saved.capitalSize,
    holdingPeriod: saved.holdingPeriod,
    updatedAt: saved.updatedAt,
  };
}

export function saveInvestmentProfile(input) {
  const profile = normalizeProfile(input);
  window.localStorage.setItem(scopedKey(), JSON.stringify(profile));
  cloudDataApi.saveSettings({ investmentProfile: profile }).catch((error) => {
    addLog({
      module: "profile",
      status: "failed",
      mode: "cloud-fallback",
      source: "investmentProfileService",
      message: "\u6295\u8d44\u6863\u6848\u4e91\u7aef\u540c\u6b65\u5931\u8d25\uff0c\u5df2\u4fdd\u7559\u672c\u5730\u6570\u636e",
      error: error.message,
    });
  });
  return { ok: true, data: profile, message: "\u6295\u8d44\u6863\u6848\u5df2\u4fdd\u5b58\uff0c\u6b63\u5728\u5c1d\u8bd5\u540c\u6b65\u4e91\u7aef\u3002AI\u65e5\u62a5\u548cAI\u52a9\u624b\u4f1a\u6309\u8be5\u753b\u50cf\u8c03\u6574\u91cd\u70b9\u3002" };
}

function loadProfile() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(scopedKey()) ?? "null");
    return normalizeProfile(saved ?? {});
  } catch {
    return normalizeProfile({});
  }
}

function normalizeProfile(input) {
  const industries = Array.isArray(input.industries) && input.industries.length
    ? input.industries.filter((item) => industryOptions.includes(item))
    : ["AI", "\u534a\u5bfc\u4f53", "\u7535\u529b"];
  return {
    industries,
    style: styleOptions.includes(input.style) ? input.style : "\u6210\u957f",
    capitalSize: capitalOptions.includes(input.capitalSize) ? input.capitalSize : "5000-50000",
    holdingPeriod: holdingPeriodOptions.includes(input.holdingPeriod) ? input.holdingPeriod : "\u6ce2\u6bb5",
    riskLevel: riskOptions.includes(input.riskLevel) ? input.riskLevel : "\u4e2d",
    updatedAt: input.updatedAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function scopedKey() {
  return `${getUserStoragePrefix()}${profileKey}`;
}
