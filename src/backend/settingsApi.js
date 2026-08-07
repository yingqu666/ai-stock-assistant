export const settingsApi = {
  async getSettings() {
    return { refreshInterval: 30, riskPreference: "中", industries: ["AI", "半导体"] };
  },
  async saveSettings(settings) {
    return { ok: true, settings };
  },
};
