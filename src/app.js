import { metricCard } from "./components/cards.js";
import { renderAccount } from "./pages/account.js";
import { mountDashboard, renderDashboard } from "./pages/dashboard.js";
import { mountDailyReport, renderDailyReport } from "./pages/dailyReport.js";
import { mountInvestmentProfile, renderInvestmentProfile } from "./pages/investmentProfile.js";
import { mountAiAssistant, renderAiAssistant } from "./pages/aiAssistant.js";
import { mountReportCenter, renderReportCenter } from "./pages/reportCenter.js";
import { mountPortfolio, renderPortfolio } from "./pages/portfolio.js";
import { mountReviewAnalysis, renderReviewAnalysis } from "./pages/reviewAnalysis.js";
import { mountRiskDashboard, renderRiskDashboard } from "./pages/riskDashboard.js";
import { mountIndustryResearch, renderIndustryResearch } from "./pages/industryResearch.js";
import { mountLogin, renderLogin } from "./pages/login.js";
import { renderMarket } from "./pages/market.js";
import { renderOpportunities } from "./pages/opportunities.js";
import { renderResearchTeam } from "./pages/researchTeam.js";
import { mountSettings, renderSettings } from "./pages/settings.js";
import { mountStockSearch, renderStockSearch } from "./pages/stockSearch.js";
import { renderSystemStatus } from "./pages/systemStatus.js";
import { mountWatchlist, renderWatchlist } from "./pages/watchlist.js";
import { getNavigation, getSidePanelData } from "./services/mockService.js";
import { initNotificationSchedule } from "./services/notificationService.js";
import { initAutoRefresh } from "./services/refreshService.js";
import { startReportScheduler } from "./services/reportScheduler.js";
import { checkCloudStatus, getSyncStatus, getTopSyncStatus, registerNetworkSync } from "./services/syncService.js";
import { getCurrentUser, isLoggedIn, logout } from "./services/userService.js";

const appShell = document.querySelector(".app-shell");
const nav = document.querySelector("#nav");
const content = document.querySelector("#content");
const title = document.querySelector("#page-title");
const topActions = document.querySelector(".top-actions");

const pages = {
  dashboard: { render: renderDashboard, mount: mountDashboard },
  market: { render: renderMarket },
  opportunities: { render: renderOpportunities },
  stock: { render: renderStockSearch, mount: mountStockSearch },
  watchlist: { render: renderWatchlist, mount: mountWatchlist },
  dailyReport: { render: renderDailyReport, mount: mountDailyReport },
  reportCenter: { render: renderReportCenter, mount: mountReportCenter },
  assistant: { render: renderAiAssistant, mount: mountAiAssistant },
  portfolio: { render: renderPortfolio, mount: mountPortfolio },
  review: { render: renderReviewAnalysis, mount: mountReviewAnalysis },
  riskDashboard: { render: renderRiskDashboard, mount: mountRiskDashboard },
  industryResearch: { render: renderIndustryResearch, mount: mountIndustryResearch },
  profile: { render: renderInvestmentProfile, mount: mountInvestmentProfile },
  account: { render: renderAccount },
  team: { render: renderResearchTeam },
  systemStatus: { render: renderSystemStatus },
  settings: { render: renderSettings, mount: mountSettings },
};

let currentPage = "dashboard";
let appStarted = false;
const APP_VERSION = "1.3";
const appVersionKey = "ai-investment-app-version";
const deprecatedCacheKeys = [
  "ai-investment-sync:status",
  "ai-investment-refresh-logs",
  "investment_notification_log",
  "ai-investment-ui-cache",
  "ai-investment-debug",
  "ai-investment-test-data",
];
const deprecatedCachePrefixes = ["ai-investment-auth:verify:"];
const mojibakeCodePoints = new Set([
  0x9394, 0x942d, 0x7f01, 0x935f, 0x9357, 0x9359, 0x95b2, 0x9411, 0x6960, 0x704f, 0x891d, 0x7ec2, 0x59af, 0x5ad9,
  0x837b, 0x7cba, 0x935a, 0x942e, 0x6231, 0x509a, 0xff04, 0x69e6, 0xfffd,
]);

function prepareFrontendCache() {
  try {
    const savedVersion = window.localStorage.getItem(appVersionKey);
    if (savedVersion !== APP_VERSION) {
      clearDeprecatedCache(window.localStorage);
      clearDeprecatedCache(window.sessionStorage);
      window.localStorage.setItem(appVersionKey, APP_VERSION);
      return;
    }

    removeMojibakeDisplayCache(window.localStorage);
    removeMojibakeDisplayCache(window.sessionStorage);
  } catch {
    // Cache cleanup is best-effort and must not block page startup.
  }
}

function hasMojibake(value) {
  return [...String(value)].some((char) => mojibakeCodePoints.has(char.charCodeAt(0)));
}

function clearDeprecatedCache(storage) {
  deprecatedCacheKeys.forEach((key) => storage.removeItem(key));
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && deprecatedCachePrefixes.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

function removeMojibakeDisplayCache(storage) {
  deprecatedCacheKeys.forEach((key) => {
    const value = storage.getItem(key);
    if (value && hasMojibake(value)) storage.removeItem(key);
  });
}

async function setPage(id) {
  const navItems = getNavigation();
  const item = navItems.find((entry) => entry.id === id) ?? navItems[0];
  currentPage = item.id;
  title.textContent = item.label;
  content.innerHTML = await pages[item.id].render();

  document.querySelectorAll(".nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === item.id);
  });

  pages[item.id].mount?.({
    navigate: setPage,
    rerender: () => setPage(currentPage),
  });
}

function renderNavigation() {
  nav.innerHTML = getNavigation().map((item) => `<button data-page="${item.id}" type="button">${item.label}</button>`).join("");
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) setPage(button.dataset.page);
  });
}

async function renderSidePanel() {
  const { marketOverview, riskAlerts, aiTeam } = await getSidePanelData();
  document.querySelector("#side-market").innerHTML = marketOverview.slice(0, 3).map(metricCard).join("");
  document.querySelector("#side-risk").innerHTML = riskAlerts.map((item) => `<p class="side-note">${item}</p>`).join("");
  document.querySelector("#side-queue").innerHTML = aiTeam.slice(0, 3).map((item) => `<p class="side-note"><b>${item.role}</b><br>${item.focus.join(" / ")}</p>`).join("");
}

async function renderUserStatus({ refreshCloud = true } = {}) {
  const user = getCurrentUser();
  const cloud = refreshCloud ? await checkCloudStatus() : getSyncStatus().cloud;
  const syncStatus = getTopSyncStatus();
  const lastSyncAt = syncStatus.lastSyncAt ?? cloud?.lastSyncAt ?? "尚未同步";
  const cloudConnected = cloud?.connected !== false && cloud?.status !== "连接失败";
  if (!topActions) return;
  topActions.innerHTML = `
    <span class="status-dot"></span>
    <span>${user?.phone ?? "未登录"}</span>
    <span>${cloudConnected ? "云端已连接" : "云端回退"}</span>
    <span>同步：${lastSyncAt}</span>
    <button class="logout-button" type="button">退出</button>
  `;
  topActions.querySelector(".logout-button")?.addEventListener("click", () => {
    logout();
    window.location.reload();
  });
}

function showLogin() {
  appShell.style.display = "none";
  const loginRoot = document.createElement("div");
  loginRoot.id = "login-root";
  loginRoot.innerHTML = renderLogin();
  document.body.prepend(loginRoot);
  mountLogin({
    onSuccess: () => {
      window.location.reload();
    },
  });
}

function initApp() {
  if (appStarted) return;
  appStarted = true;
  renderUserStatus();
  window.addEventListener("sync-status-updated", () => {
    renderUserStatus({ refreshCloud: false });
  });
  renderNavigation();
  initNotificationSchedule();
  startReportScheduler();
  registerNetworkSync(() => {
    renderUserStatus();
    renderSidePanel();
    setPage(currentPage);
  });
  initAutoRefresh(() => {
    renderUserStatus({ refreshCloud: false });
    renderSidePanel();
    if (currentPage === "dashboard" || currentPage === "market" || currentPage === "watchlist") {
      setPage(currentPage);
    }
  });
  renderSidePanel();
  setPage("dashboard");
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // PWA registration is optional for local development.
    });
  }
}

function init() {
  prepareFrontendCache();
  registerPwa();
  if (!isLoggedIn()) {
    showLogin();
    return;
  }
  initApp();
}

init();
