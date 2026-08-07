import { stockNews } from "../data.js";

export function getIndustryResearchData() {
  const chains = [
    {
      name: "算力",
      logic: "大模型训练和推理需求继续拉动服务器、GPU、IDC和配套电力投入。",
      leaders: ["工业富联", "浪潮信息", "中科曙光"],
      catalysts: ["大模型应用扩散", "云厂商资本开支恢复", "国产算力适配"],
      risks: ["订单兑现不及预期", "海外供应限制", "短期估值偏高"],
      latestNews: "AI服务器需求维持高景气，资金继续关注算力基础设施。",
    },
    {
      name: "光模块",
      logic: "高速互联是AI数据中心核心环节，800G/1.6T升级带来产品结构改善。",
      leaders: ["中际旭创", "新易盛", "天孚通信"],
      catalysts: ["高速光模块放量", "海外云厂商需求", "产品迭代"],
      risks: ["海外客户集中", "价格竞争", "业绩预期过满"],
      latestNews: "高速光模块仍是AI产业链中业绩弹性较高的方向。",
    },
    {
      name: "半导体",
      logic: "国产替代、先进封装和AI芯片需求构成中长期主线。",
      leaders: ["中芯国际", "北方华创", "寒武纪"],
      catalysts: ["国产替代加速", "设备材料订单", "先进封装需求"],
      risks: ["周期复苏节奏", "外部限制", "研发投入压力"],
      latestNews: "半导体板块受政策和国产替代预期支撑，但波动较大。",
    },
    {
      name: "电力",
      logic: "数据中心用电增长提升电网、电源和电力设备的重要性。",
      leaders: ["国电南瑞", "阳光电源", "许继电气"],
      catalysts: ["数据中心建设", "电网投资", "新能源消纳"],
      risks: ["项目建设节奏", "原材料价格", "政策变化"],
      latestNews: "算力扩张推动电力配套需求，电网和储能方向关注度提升。",
    },
    {
      name: "储能",
      logic: "新能源消纳、峰谷调节和数据中心备用电源需求推动储能场景扩展。",
      leaders: ["宁德时代", "阳光电源", "科华数据"],
      catalysts: ["海外储能订单", "电力市场化", "数据中心备电"],
      risks: ["价格竞争", "海外政策变化", "毛利率压力"],
      latestNews: "储能景气度与海外需求和国内电力改革密切相关。",
    },
    {
      name: "国产替代",
      logic: "软硬件自主可控仍是政策和产业共同推动的长期方向。",
      leaders: ["金山办公", "中国软件", "中科曙光"],
      catalysts: ["信创招标", "国产生态成熟", "安全合规需求"],
      risks: ["采购节奏波动", "商业化不及预期", "竞争加剧"],
      latestNews: "国产替代方向更适合结合订单和业绩验证持续跟踪。",
    },
  ];

  return {
    industry: "人工智能",
    chain: chains,
    chains,
    news: stockNews
      .filter((item) => item.title.includes("AI") || item.title.includes("数字") || item.category.includes("行业"))
      .slice(0, 6),
  };
}
