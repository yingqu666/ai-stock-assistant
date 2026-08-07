(function configureApiBase() {
  const savedApiBase = window.localStorage?.getItem("ai-investment-api-base");
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  window.__AI_INVESTMENT_API_BASE__ =
    savedApiBase ||
    window.__AI_INVESTMENT_API_BASE__ ||
    (isLocal ? "http://localhost:8787/api" : "https://your-api-domain.example.com/api");
})();
