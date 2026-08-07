export const stockApi = {
  async getStockQuote(code) {
    return { code, source: "future-backend" };
  },
  async listWatchlist() {
    return [];
  },
};
