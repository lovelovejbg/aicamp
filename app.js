// app.js – 화면 동작 (오늘 날짜 표시, 일정 목록 그리기, 일정 추가)
// 규칙(REGIONS, KINDS, validateTask)은 logic.js 에 있고, index.html 에서 먼저 불러옵니다.

// 브라우저 저장소(localStorage)에 일정을 저장할 때 쓰는 이름표
const STORAGE_KEY = "wx_tasks";

// PRD 4장: 처음 보이는 가상 일정 6건 (실제 인물 · 기관 아님)
const INITIAL_TASKS = [
  { title: "다중이용시설 안전점검", region: "세종", kind: "야외", owner: "김안전" },
  { title: "시민 안전체험 행사 운영", region: "보령", kind: "야외", owner: "이행사" },
  { title: "옥상 태양광 설비 점검", region: "태안", kind: "고소", owner: "박설비" },
  { title: "하천 수위계 확인", region: "대전", kind: "야외", owner: "최현장" },
  { title: "청사 외벽 간판 보수", region: "세종", kind: "고소", owner: "정시설" },
  { title: "비상연락 훈련", region: "대전", kind: "실내", owner: "한상황" },
];

// ----- 저장 / 불러오기 -----

// 저장된 일정을 불러옵니다. 저장된 게 없거나 망가져 있으면 가상 6건을 씁니다.
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    // 처음 열었을 때: 원본이 바뀌지 않도록 복사본을 돌려줍니다
    return INITIAL_TASKS.map((task) => ({ ...task }));
  }
  try {
    const tasks = JSON.parse(saved);
    // 배열이 아니면 망가진 데이터로 보고 처음 상태로 돌아갑니다
    if (!Array.isArray(tasks)) throw new Error("일정 데이터가 배열이 아님");
    // 규칙에 맞는 일정만 남깁니다 (손으로 고친 데이터 등 방어)
    return tasks
      .map((task) => validateTask(task))
      .filter((result) => result.ok)
      .map((result) => result.task);
  } catch (error) {
    console.warn("저장된 일정을 읽지 못해 처음 6건으로 시작합니다.", error);
    return INITIAL_TASKS.map((task) => ({ ...task }));
  }
}

// 일정 배열을 문자열(JSON)로 바꿔 브라우저에 저장합니다
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ----- 화면 그리기 -----

// 오늘 날짜를 yyyy-mm-dd 형식으로 표시합니다
function renderToday() {
  const now = new Date();
  const year = now.getFullYear();
  // getMonth()는 0부터 시작하므로(1월 = 0) 1을 더하고, 두 자리로 맞춥니다 (3 → "03")
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  document.getElementById("today").textContent = `${year}-${month}-${day}`;
}

// 선택 목록(<select>)에 선택지를 채웁니다
function fillOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

// 일정 표를 처음부터 다시 그립니다
function renderTasks(tasks) {
  const tbody = document.getElementById("task-list");
  tbody.replaceChildren(); // 기존 행을 모두 지움

  for (const task of tasks) {
    const row = document.createElement("tr");
    // 칸 순서: 일정 · 지역 · 구분 · 담당
    for (const value of [task.title, task.region, task.kind, task.owner]) {
      const cell = document.createElement("td");
      // 사용자가 입력한 글자는 textContent 로 넣습니다 (HTML 로 해석되지 않아 안전)
      cell.textContent = value;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
}

// ----- 시작 -----

// 현재 화면에 보이는 일정 목록 (추가할 때마다 이 배열에 붙입니다)
let tasks = loadTasks();

const form = document.getElementById("task-form");
const message = document.getElementById("form-message");

renderToday();
fillOptions(form.elements.region, REGIONS);
fillOptions(form.elements.kind, KINDS);
renderTasks(tasks);

// F-02 일정 추가: [추가] 버튼을 누르거나 입력칸에서 Enter 를 누르면 실행됩니다
form.addEventListener("submit", (event) => {
  event.preventDefault(); // 폼 기본 동작(페이지 새로고침)을 막습니다

  // 입력값을 모아 logic.js 의 규칙으로 검사합니다
  const result = validateTask({
    title: form.elements.title.value,
    region: form.elements.region.value,
    kind: form.elements.kind.value,
    owner: form.elements.owner.value,
  });

  if (!result.ok) {
    message.textContent = result.message; // 무엇이 틀렸는지 안내
    return;
  }

  tasks.push(result.task); // 목록 맨 아래에 추가
  saveTasks(tasks);        // 새로고침해도 남도록 저장
  renderTasks(tasks);      // 표 다시 그리기

  // 다음 입력을 위해 글자 칸만 비우고, 일정 칸에 커서를 둡니다
  message.textContent = "";
  form.elements.title.value = "";
  form.elements.owner.value = "";
  form.elements.title.focus();
});
