export function newsList(items) {
  return items.map((item) => `<article class="list-row"><b>${item.type}</b><span>${item.title}</span></article>`).join("");
}

export function reportList(items) {
  return items.map((item) => `
    <article class="data-card report-row" role="button" tabindex="0">
      <div>
        <strong>${item.title}</strong>
        <small>${item.date}｜${item.type}</small>
      </div>
      <b>${item.score}分</b>
    </article>`).join("");
}

export function timelineList(items) {
  return items.map((item) => `
    <article class="timeline-row">
      <span>${item.date}</span>
      <div>
        <strong>${item.title ?? item.event}</strong>
        <p>${item.impact ?? item.analysis}</p>
      </div>
    </article>`).join("");
}
