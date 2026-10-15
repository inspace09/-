/*
  이 파일은 화면에 실제로 표시될 HTML 요소를 그리는 역할을 합니다.
  '데이터를 받아서 DOM에 반영하는 함수들'만 모아두어,
  main.js에서 상태 변경이 일어나면 UI를 쉽게 갱신할 수 있도록 구성했습니다.
*/

export function formatCurrency(value) {
  /*
    숫자를 한국어 형식으로 변환합니다.
    예: 13500 -> "13,500원"
    Intl.NumberFormat은 천 단위 콤마와 로케일을 자동으로 처리합니다.
  */
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value) + "원";
}

export function formatDday(dateString) {
  /*
    결제 예정일과 오늘 날짜의 차이를 계산해 D-Day 문구를 만듭니다.
    예: 오늘이면 D-day, 3일 뒤면 D-3, 2일 지났으면 D+2
  */
  const today = new Date();
  const targetDay = new Date(`${dateString}T00:00:00`);
  const diffDays = Math.floor((targetDay - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "D-day";
  }
  if (diffDays < 0) {
    return `D+${Math.abs(diffDays)}`;
  }
  return `D-${diffDays}`;
}

export function renderSummary(summary) {
  /*
    상단 요약 카드 3개에 값을 넣습니다.
    여기서 summary는 main.js에서 계산된 월합계, 연합계, 이번 주 결제 예정 건수입니다.
  */
  const monthlyNode = document.getElementById("totalMonthly");
  const yearlyNode = document.getElementById("totalYearly");
  const dueWeekNode = document.getElementById("dueThisWeek");

  if (!monthlyNode || !yearlyNode || !dueWeekNode) {
    return;
  }

  monthlyNode.textContent = formatCurrency(summary.totalMonthly);
  yearlyNode.textContent = formatCurrency(summary.totalYearly);
  dueWeekNode.textContent = `${summary.dueThisWeekCount}건`;
}

export function renderCategoryBreakdown(categoryTotals) {
  /*
    카테고리별 월 소비합을 받아 비중 막대 그래프를 생성합니다.
    categoryTotals 예시: { 영상: 13500, 음악: 10900, 운동: 45000 }
  */
  const container = document.getElementById("categoryBreakdown");

  if (!container) {
    return;
  }

  const entries = Object.entries(categoryTotals);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (!entries.length || total === 0) {
    container.innerHTML = '<div class="empty-state">아직 카테고리 데이터가 없습니다.</div>';
    return;
  }

  const colors = ["", "alt-2", "alt-3", "alt-4"];

  container.innerHTML = entries
    .map(([category, amount], index) => {
      const percentage = total === 0 ? 0 : (amount / total) * 100;
      const colorClass = colors[index % colors.length];

      return `
        <div class="category-row">
          <div class="category-top">
            <span>${category}</span>
            <strong>${formatCurrency(amount)} (${percentage.toFixed(0)}%)</strong>
          </div>
          <div class="bar">
            <div class="bar-fill ${colorClass}" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

export function renderSubscriptionList(subscriptions) {
  /*
    구독 데이터 배열을 받아 실제 카드 목록을 화면에 그립니다.
    map()을 이용해 배열의 각 항목을 HTML 문자열로 변환하고, 마지막에 join으로 하나의 문자열로 합칩니다.
  */
  const list = document.getElementById("subscriptionList");

  if (!list) {
    return;
  }

  if (!subscriptions.length) {
    list.innerHTML = '<div class="empty-state">아직 등록된 구독이 없습니다. 첫 구독을 추가해보세요.</div>';
    return;
  }

  list.innerHTML = subscriptions
    .map((subscription) => {
      const monthlyAmount = getMonthlyAmount(subscription);
      const dday = formatDday(subscription.nextPaymentDate);
      const cycleText = subscription.cycle === "yearly" ? "/년" : "/월";

      return `
        <article class="subscription-item" data-id="${subscription.id}">
          <div class="item-head">
            <div class="item-title">
              <span class="category-badge">${subscription.category}</span>
              <h3>${subscription.name}</h3>
            </div>
            <div class="price">${formatCurrency(monthlyAmount)}<span>${cycleText}</span></div>
          </div>

          <div class="item-meta">
            <span>결제일: ${subscription.nextPaymentDate}</span>
            <span class="dday-pill">${dday}</span>
          </div>

          <div class="item-details">
            <span>결제수단: ${subscription.paymentMethod}</span>
            <span>${subscription.cycle === "yearly" ? "연 결제" : "월 결제"}</span>
          </div>

          <div class="item-actions">
            <button type="button" class="card-action edit" data-action="edit" data-id="${subscription.id}">수정</button>
            <button type="button" class="card-action delete" data-action="delete" data-id="${subscription.id}">삭제</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getMonthlyAmount(subscription) {
  /*
    logic.js의 getMonthlyAmount를 재사용하는 대신,
    이 파일 내부에서 같은 계산 규칙을 적용합니다.
    yearly 구독은 연 비용을 12로 나누어 월 평균 금액으로 환산합니다.
  */
  if (subscription.cycle === "yearly") {
    return Math.round(subscription.amount / 12);
  }
  return subscription.amount;
}
