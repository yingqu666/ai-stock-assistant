import { metricCard, toneClass } from "../components/cards.js";
import { getAccountData } from "../services/mockService.js";

export function renderAccount() {
  const { account } = getAccountData();
  const rows = account.positions.map((position) => {
    const pnl = (position.price - position.cost) * position.qty - position.buyFee - position.sellFee - position.stampTax - position.otherFee;
    return `<div class="table-row account-row"><b>${position.name}<small>${position.code}</small></b><span>${position.qty}股</span><span>成本 ${position.cost}</span><span>现价 ${position.price}</span><em class="${toneClass(pnl)}">${pnl.toFixed(2)}元</em></div>`;
  }).join("");

  return `
    <section class="wide-section">
      <div class="metrics">${[
        { label: "初始资金", value: "5,000元", change: "模拟" },
        { label: "账户总值", value: `${account.total.toFixed(2)}元`, change: "+5.73%" },
        { label: "浮动盈亏", value: `${account.profit.toFixed(2)}元`, change: "含费用" },
      ].map(metricCard).join("")}</div>
      <div class="section-head"><h2>持仓记录</h2><button>新增交易</button></div>
      <div class="table">${rows}</div>
    </section>`;
}
