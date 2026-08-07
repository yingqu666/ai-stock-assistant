(function configureApiBase() {
  const savedApiBase = window.localStorage?.getItem("ai-investment-api-base");
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  window.__AI_INVESTMENT_API_BASE__ =
    savedApiBase ||
    window.__AI_INVESTMENT_API_BASE__ ||
    (isLocal ? "API_URL: "https://ai-stock-backend-2egj.onrender.com"/api" : "https://your-api-domain.example.com/api");
})();
