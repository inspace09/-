/*
  이 파일은 웹앱의 '진짜 동작 로직'을 담당합니다.
  - 저장소(localStorage)에서 데이터 불러오기
  - 폼 입력값을 구독 객체로 변환하기
  - 목록/요약/카테고리 UI 갱신하기
  - 수정/삭제 버튼 이벤트 처리하기

  핵심 아이디어는 '데이터 상태(subscriptions)'를 항상 최신으로 유지하고,
  상태가 바뀔 때마다 renderApp()를 호출해 화면을 다시 그리는 것입니다.
*/

import { formatCurrency, formatDday, renderCategoryBreakdown, renderSubscriptionList, renderSummary } from "./ui.js";

const STORAGE_KEY = "subTracker.data";
const form = document.getElementById("subscriptionForm");
const listContainer = document.getElementById("subscriptionList");
const cancelButton = document.getElementById("cancelEditButton");
const formTitle = document.getElementById("formTitle");
const submitButton = document.getElementById("submitButton");

let subscriptions = loadSubscriptions();
let editingId = null;

if (typeof document !== "undefined") {
  initializeApp();
}

function initializeApp() {
  /*
    앱이 처음 실행될 때 필요한 이벤트 연결을 설정합니다.
    - 폼 제출: 새 구독 추가 또는 수정 저장
    - 취소 버튼: 수정 상태 초기화
    - 목록 클릭: 수정/삭제 동작 수행
    - 마지막으로 현재 데이터로 화면 렌더링
  */
  form.addEventListener("submit", handleSubmit);
  cancelButton.addEventListener("click", resetForm);
  listContainer.addEventListener("click", handleListAction);
  renderApp();
}

function loadSubscriptions() {
  /*
    localStorage에서 저장된 구독 데이터를 읽어옵니다.
    만약 저장된 데이터가 없거나 잘못된 형식이면 기본 예시 데이터를 넣어줍니다.
    이 함수는 앱 시작 시 한 번만 실행됩니다.
  */
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("저장된 데이터를 불러오지 못했습니다.", error);
  }

  const seed = [
    {
      id: "sub_1",
      name: "넷플릭스",
      amount: 13500,
      cycle: "monthly",
      nextPaymentDate: "2026-10-20",
      category: "영상",
      paymentMethod: "신한카드",
    },
    {
      id: "sub_2",
      name: "스포티파이",
      amount: 10900,
      cycle: "monthly",
      nextPaymentDate: "2026-10-18",
      category: "음악",
      paymentMethod: "신한카드",
    },
    {
      id: "sub_3",
      name: "헬스장",
      amount: 45000,
      cycle: "monthly",
      nextPaymentDate: "2026-10-25",
      category: "운동",
      paymentMethod: "삼성카드",
    },
    {
      id: "sub_4",
      name: "Notion",
      amount: 120000,
      cycle: "yearly",
      nextPaymentDate: "2027-02-01",
      category: "생산성",
      paymentMethod: "삼성카드",
    },
  ];

  saveSubscriptions(seed);
  return seed;
}

function saveSubscriptions(data) {
  /*
    현재 구독 배열을 JSON 문자열로 변환해 localStorage에 저장합니다.
    저장 후 페이지를 새로고침해도 데이터가 그대로 유지됩니다.
  */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function renderApp() {
  /*
    화면 전체를 다시 그리는 핵심 함수입니다.
    이 함수가 호출되는 순간 다음 3가지를 계산하고 UI를 갱신합니다.
    1) 월/연 합계
    2) 이번 주 결제 예정 건수
    3) 카테고리별 합계 및 목록 표시
  */
  const today = getTodayString();
  const totalMonthly = window.getTotalMonthlyAmount(subscriptions);
  const totalYearly = window.getTotalYearlyAmount(subscriptions);
  const dueThisWeek = window.getSubscriptionsDueWithinDays(subscriptions, today, 7);
  const categoryTotals = window.getMonthlyAmountByCategory(subscriptions);

  renderSummary({
    totalMonthly,
    totalYearly,
    dueThisWeekCount: dueThisWeek.length,
  });

  renderCategoryBreakdown(categoryTotals);
  renderSubscriptionList(subscriptions);
}

function handleSubmit(event) {
  /*
    폼 제출 시 동작합니다.
    사용자가 입력한 값들을 읽어 구독 객체를 만들고,
    새 항목이면 배열 앞에 추가하거나, 수정 모드이면 기존 항목을 교체합니다.
  */
  event.preventDefault();

  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  const entry = {
    id: editingId || makeId(),
    name: String(data.get("name")).trim(),
    amount,
    cycle: String(data.get("cycle")),
    nextPaymentDate: String(data.get("nextPaymentDate")),
    category: String(data.get("category")),
    paymentMethod: String(data.get("paymentMethod")).trim(),
  };

  if (!entry.name || !entry.nextPaymentDate || !entry.paymentMethod || Number.isNaN(amount) || amount <= 0) {
    alert("입력값을 다시 확인해주세요.");
    return;
  }

  if (editingId) {
    subscriptions = subscriptions.map((subscription) => (subscription.id === editingId ? entry : subscription));
  } else {
    subscriptions = [entry, ...subscriptions];
  }

  saveSubscriptions(subscriptions);
  resetForm();
  renderApp();
}

function handleListAction(event) {
  /*
    구독 카드 안의 수정/삭제 버튼을 눌렀을 때 처리합니다.
    event.target.closest("button[data-action]")는 클릭된 요소가 버튼인지 확인하는 역할을 합니다.
  */
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const { action, id } = target.dataset;

  if (action === "edit") {
    const item = subscriptions.find((subscription) => subscription.id === id);
    if (!item) {
      return;
    }

    editingId = id;
    formTitle.textContent = "구독 수정";
    submitButton.textContent = "수정하기";
    cancelButton.classList.remove("hidden");

    form.name.value = item.name;
    form.amount.value = item.amount;
    form.cycle.value = item.cycle;
    form.category.value = item.category;
    form.paymentMethod.value = item.paymentMethod;
    form.nextPaymentDate.value = item.nextPaymentDate;
  }

  if (action === "delete") {
    const isConfirmed = window.confirm("이 구독을 삭제할까요?");
    if (!isConfirmed) {
      return;
    }

    subscriptions = subscriptions.filter((subscription) => subscription.id !== id);
    saveSubscriptions(subscriptions);
    renderApp();

    if (editingId === id) {
      resetForm();
    }
  }
}

function resetForm() {
  /*
    폼을 초기 상태로 되돌립니다.
    수정 모드라면 editingId와 버튼 문구와 취소 버튼도 함께 정리합니다.
  */
  editingId = null;
  form.reset();
  formTitle.textContent = "새 구독 추가";
  submitButton.textContent = "추가하기";
  cancelButton.classList.add("hidden");
}

function getTodayString() {
  /*
    오늘 날짜를 YYYY-MM-DD 형식으로 만들어 logic.js의 함수들이 기대하는 형식과 맞춥니다.
    예: 2026-10-15
  */
  return new Date().toISOString().slice(0, 10);
}

function makeId() {
  /*
    각 구독마다 고유 ID를 생성합니다.
    Date.now()와 랜덤 문자열을 조합해 충돌 가능성을 낮춥니다.
  */
  return `sub_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

window.addEventListener("storage", () => {
  /*
    다른 탭에서 localStorage가 변경되면 현재 탭도 데이터를 다시 읽어 반영합니다.
    실시간 동기화처럼 보이게 만드는 장점이 있습니다.
  */
  subscriptions = loadSubscriptions();
  renderApp();
});

window.formatCurrency = formatCurrency;
window.formatDday = formatDday;
