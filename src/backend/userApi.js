export const userApi = {
  async requestSmsCode(phone) {
    return { ok: true, phone, provider: "mock", expiresIn: 300 };
  },

  async loginWithSmsCode(phone, code) {
    return {
      ok: code === "888888",
      user: {
        id: `u_${phone}`,
        phone,
        createdTime: new Date().toISOString(),
      },
    };
  },

  async getUserProfile(userId) {
    return {
      id: userId,
      preference: "稳健成长",
      industries: ["AI", "半导体", "新能源"],
      riskLevel: "中",
    };
  },

  async updateUserProfile(userId, profile) {
    return { ok: true, userId, profile };
  },
};
