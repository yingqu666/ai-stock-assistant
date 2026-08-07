(function configureApiBase() {
  const savedApiBase = window.localStorage?.getItem("ai-investment-api-base");

  window.__AI_INVESTMENT_API_BASE__ =
    savedApiBase ||
    window.__AI_INVESTMENT_API_BASE__ ||
    `${window.location.origin}/api`;
})();
