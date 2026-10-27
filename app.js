// app.js – 화면 동작 (오늘 날짜 표시, 일정 목록 그리기, 일정 추가, 날씨 API 호출)
// 규칙(REGIONS, KINDS, validateTask, buildWeatherUrl, parseWeather, judgeTask 등)은
// logic.js 에 있고, index.html 에서 먼저 불러옵니다.

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

// 판단 결과 → 배지 색을 정하는 CSS 클래스 이름 (style.css 의 .badge-xxx)
const JUDGE_CLASS = {
  "중지 검토": "badge-stop",
  "폭염 휴식": "badge-heat",
  "우천 주의": "badge-rain",
  "진행": "badge-go",
  "영향 없음": "badge-none",
  "날씨 확인 전": "badge-none",
};

// 날씨 칸 글자를 만듭니다. 예: "31℃ · 4.2m/s · 20%"
function formatWeather(w) {
  if (!w) return "-";
  return `${w.temp}℃ · ${w.wind}m/s · ${w.rain}%`;
}

// 일정 표를 처음부터 다시 그립니다
// weather: 지역별 날씨 (아직 못 받았거나 실패했으면 null)
function renderTasks(tasks, weather) {
  const tbody = document.getElementById("task-list");
  tbody.replaceChildren(); // 기존 행을 모두 지움

  for (const task of tasks) {
    const row = document.createElement("tr");
    // 칸 순서: 일정 · 지역 · 구분 · 담당 · 날씨
    const w = weather ? weather[task.region] : null;
    for (const value of [task.title, task.region, task.kind, task.owner, formatWeather(w)]) {
      const cell = document.createElement("td");
      // 사용자가 입력한 글자는 textContent 로 넣습니다 (HTML 로 해석되지 않아 안전)
      cell.textContent = value;
      row.appendChild(cell);
    }

    // 마지막 판단 칸: logic.js 의 규칙으로 판단해 색깔 배지로 표시
    const judgement = judgeTask(task, weather);
    const badge = document.createElement("span");
    badge.className = `badge ${JUDGE_CLASS[judgement]}`;
    badge.textContent = judgement;
    const judgeCell = document.createElement("td");
    judgeCell.appendChild(badge);
    row.appendChild(judgeCell);

    tbody.appendChild(row);
  }
}

// ----- F-04 날씨 받기 -----

// 날씨 상태 안내 문구를 바꿉니다. isError 가 true 면 빨간 글씨
function showWeatherStatus(text, isError) {
  const status = document.getElementById("weather-status");
  status.textContent = text;
  status.classList.toggle("is-error", Boolean(isError));
}

// Open-Meteo 에서 오늘 날씨를 받아 표를 다시 그립니다.
// 실패해도 목록은 이미 그려져 있으므로 안내만 띄우고 끝냅니다.
async function loadWeather() {
  // 주소 끝의 ?test=wind 같은 시험 모드 값을 읽습니다 (없으면 null)
  const testMode = new URLSearchParams(location.search).get("test");

  showWeatherStatus("날씨를 받는 중이에요…", false);
  try {
    const response = await fetch(buildWeatherUrl());
    // 404 · 500 같은 응답은 fetch 가 오류로 보지 않으므로 직접 확인합니다
    if (!response.ok) throw new Error(`날씨 API 응답 오류 (${response.status})`);

    const data = await response.json();
    weather = applyTestMode(parseWeather(data), testMode);
    renderTasks(tasks, weather);

    if (testMode === "wind") {
      showWeatherStatus(`시험 모드: 모든 지역 풍속을 ${TEST_WIND}m/s 로 바꿔 판단하고 있어요.`, false);
    } else {
      showWeatherStatus("", false);
    }
  } catch (error) {
    console.warn("날씨를 받지 못했습니다.", error);
    weather = null;               // 판단을 모두 '날씨 확인 전'으로
    renderTasks(tasks, weather);
    showWeatherStatus("날씨를 받지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.", true);
  }
}

// ----- 시작 -----

// 현재 화면에 보이는 일정 목록 (추가할 때마다 이 배열에 붙입니다)
let tasks = loadTasks();

// 받아 온 지역별 날씨 (받기 전이거나 실패하면 null → 판단은 '날씨 확인 전')
let weather = null;

const form = document.getElementById("task-form");
const message = document.getElementById("form-message");

renderToday();
fillOptions(form.elements.region, REGIONS);
fillOptions(form.elements.kind, KINDS);
renderTasks(tasks, weather); // 날씨 없이 목록부터 먼저 보여 줍니다
loadWeather();               // 날씨를 받으면 표를 다시 그립니다

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
  renderTasks(tasks, weather); // 표 다시 그리기 (받아 둔 날씨로 새 일정도 바로 판단)

  // 다음 입력을 위해 글자 칸만 비우고, 일정 칸에 커서를 둡니다
  message.textContent = "";
  form.elements.title.value = "";
  form.elements.owner.value = "";
  form.elements.title.focus();
});
