// app.js – 화면 동작 (오늘 날짜 표시, 일정 목록 그리기, 일정 추가, 날씨 · 특보 API 호출)
// 규칙(REGIONS, KINDS, validateTask, buildWeatherUrl, parseWeather, parseWarnings, judgeTask 등)은
// logic.js 에 있고, index.html 에서 먼저 불러옵니다.

// 기본 일정 6건이 들어 있는 파일 (CLAUDE.md: 데이터는 data/ 폴더 JSON 에 둔다)
const TASKS_FILE = "data/tasks.json";

// 브라우저 저장소(localStorage)에 '화면에서 추가한 일정만' 저장할 때 쓰는 이름표
const ADDED_KEY = "wx_added_tasks";

// 예전 버전이 '전체 목록'을 저장하던 이름표. 처음 한 번 추가 일정만 골라 옮긴 뒤 지웁니다.
const OLD_STORAGE_KEY = "wx_tasks";

// ----- 저장 / 불러오기 -----

// data/tasks.json 을 읽어 기본 일정 목록을 돌려줍니다.
// 더블클릭(file://)으로 열면 브라우저가 파일 읽기를 막아서 여기서 오류가 납니다.
async function loadBaseTasks() {
  const response = await fetch(TASKS_FILE);
  if (!response.ok) throw new Error(`${TASKS_FILE} 응답 오류 (${response.status})`);
  return parseTasks(await response.json());
}

// 브라우저에 저장된 '추가한 일정'을 불러옵니다. 없거나 망가져 있으면 빈 목록
function loadAddedTasks() {
  try {
    return parseTasks(JSON.parse(localStorage.getItem(ADDED_KEY) ?? "[]"));
  } catch (error) {
    console.warn("저장된 추가 일정을 읽지 못했습니다.", error);
    return [];
  }
}

// 추가한 일정만 문자열(JSON)로 바꿔 브라우저에 저장합니다
function saveAddedTasks(added) {
  localStorage.setItem(ADDED_KEY, JSON.stringify(added));
}

// 예전 버전 저장값(기본 6건 + 추가 일정)에서 기본 일정을 빼고 추가 일정만 옮깁니다.
function migrateOldStorage(baseTasks) {
  const saved = localStorage.getItem(OLD_STORAGE_KEY);
  if (saved === null) return;
  try {
    const sameTask = (a, b) =>
      a.title === b.title && a.region === b.region && a.kind === b.kind && a.owner === b.owner;
    const extra = parseTasks(JSON.parse(saved)).filter(
      (task) => !baseTasks.some((base) => sameTask(base, task))
    );
    addedTasks = [...addedTasks, ...extra];
    saveAddedTasks(addedTasks);
  } catch (error) {
    console.warn("예전 저장값을 옮기지 못했습니다.", error);
  }
  localStorage.removeItem(OLD_STORAGE_KEY);
}

// 화면에 보일 전체 목록 = JSON 기본 일정 + 브라우저에 저장된 추가 일정 (추가 일정은 맨 아래)
function allTasks() {
  return [...baseTasks, ...addedTasks];
}

// 일정 목록 안내 문구 (파일을 못 읽었을 때). 배포 주소는 눌러서 이동할 수 있게 링크로 만듭니다.
function showTaskFileError() {
  const status = document.getElementById("task-status");
  status.replaceChildren();
  status.classList.add("is-error");
  status.append("일정 파일(data/tasks.json)을 읽지 못했어요. 배포 주소로 열어 주세요: ");
  const link = document.createElement("a");
  link.href = DEPLOYED_SITE;
  link.textContent = DEPLOYED_SITE;
  status.append(link);
}

// 기본 일정 파일을 읽어 표를 다시 그립니다. 실패하면 안내를 띄우고 추가 일정만 보여 줍니다.
async function loadTasks() {
  try {
    baseTasks = await loadBaseTasks();
    migrateOldStorage(baseTasks);
  } catch (error) {
    console.warn("일정 파일을 읽지 못했습니다.", error);
    showTaskFileError();
  }
  renderTasks(allTasks(), weather, warnings);
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

// 특보 칸을 만듭니다. 주의보는 노랑, 경보는 빨강 글자
// list: 그 지역 특보 목록. 특보를 못 받았으면 null
function createWarningCell(list) {
  const cell = document.createElement("td");
  if (!list) {
    cell.textContent = "-";
    return cell;
  }
  if (list.length === 0) {
    cell.textContent = "없음";
    return cell;
  }
  for (const item of list) {
    const tag = document.createElement("span");
    tag.className = item.level === "경보" ? "warn warn-alert" : "warn warn-watch";
    tag.textContent = `${item.type}${item.level}`; // 예: "강풍주의보"
    cell.appendChild(tag);
  }
  return cell;
}

// 일정 표를 처음부터 다시 그립니다
// weather : 지역별 날씨 (아직 못 받았거나 실패했으면 null)
// warnings: 지역별 특보 목록 (아직 못 받았거나 실패했으면 null)
function renderTasks(tasks, weather, warnings) {
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

    // 특보 칸
    row.appendChild(createWarningCell(warnings ? warnings[task.region] : null));

    // 마지막 판단 칸: logic.js 의 규칙으로 판단해 색깔 배지로 표시
    const judgement = judgeTask(task, weather, warnings);
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

// 주소 끝의 ?test=wind · ?test=warn 같은 시험 모드 값 (없으면 null)
const testMode = new URLSearchParams(location.search).get("test");

// 안내 문구를 바꿉니다. id 는 안내 자리(weather-status · warning-status), isError 가 true 면 빨간 글씨
function showStatus(id, text, isError) {
  const status = document.getElementById(id);
  status.textContent = text;
  status.classList.toggle("is-error", Boolean(isError));
}

// 날씨 안내 문구
function showWeatherStatus(text, isError) {
  showStatus("weather-status", text, isError);
}

// Open-Meteo 에서 오늘 날씨를 받아 표를 다시 그립니다.
// 실패해도 목록은 이미 그려져 있으므로 안내만 띄우고 끝냅니다.
async function loadWeather() {
  showWeatherStatus("날씨를 받는 중이에요…", false);
  try {
    const response = await fetch(buildWeatherUrl());
    // 404 · 500 같은 응답은 fetch 가 오류로 보지 않으므로 직접 확인합니다
    if (!response.ok) throw new Error(`날씨 API 응답 오류 (${response.status})`);

    const data = await response.json();
    weather = applyTestMode(parseWeather(data), testMode);
    renderTasks(allTasks(), weather, warnings);

    if (testMode === "wind") {
      showWeatherStatus(`시험 모드: 모든 지역 풍속을 ${TEST_WIND}m/s 로 바꿔 판단하고 있어요.`, false);
    } else {
      showWeatherStatus("", false);
    }
  } catch (error) {
    console.warn("날씨를 받지 못했습니다.", error);
    weather = null;               // 날씨로는 판단하지 않음 (특보 규칙만 적용)
    renderTasks(allTasks(), weather, warnings);
    showWeatherStatus("날씨를 받지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.", true);
  }
}

// ----- F-07 기상특보 받기 -----

// 발표시각 202610271600 → "10월 27일 16:00"
function formatTmFc(tmFc) {
  const s = String(tmFc ?? "");
  if (s.length < 12) return "";
  return `${Number(s.slice(4, 6))}월 ${Number(s.slice(6, 8))}일 ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

// 서버 함수(/api/warnings)로 기상청 특보를 받아 표를 다시 그립니다.
// 실패해도 목록 · 날씨 판단은 그대로 두고, 특보 칸만 '-' 로 남깁니다.
async function loadWarnings() {
  showStatus("warning-status", "기상특보를 받는 중이에요…", false);
  try {
    const response = await fetch(buildWarningUrl(location.hostname));
    const data = await response.json();
    // 서버 함수가 { ok: false, message } 를 보내면 실패로 처리
    if (!response.ok || !data.ok) throw new Error(data.message || `특보 응답 오류 (${response.status})`);

    warnings = applyWarningTestMode(parseWarnings(data.t6), testMode);
    renderTasks(allTasks(), weather, warnings);

    const time = formatTmFc(data.tmFc);
    if (testMode === "warn") {
      showStatus("warning-status", "시험 모드: 모든 지역에 강풍주의보를 더해 판단하고 있어요.", false);
    } else {
      showStatus("warning-status", time ? `기상청 특보 기준: ${time} 발표` : "기상청 특보: 현재 발효 중인 특보 없음", false);
    }
  } catch (error) {
    console.warn("기상특보를 받지 못했습니다.", error);
    // ?test=warn 은 특보를 못 받아도 시험할 수 있게 빈 특보에서 시작
    warnings = testMode === "warn" ? applyWarningTestMode(null, testMode) : null;
    renderTasks(allTasks(), weather, warnings);
    const suffix = testMode === "warn" ? " (시험 모드: 가짜 강풍주의보로 판단 중)" : "";
    showStatus("warning-status", `기상특보를 받지 못했어요.${suffix}`, true);
  }
}

// ----- 시작 -----

// data/tasks.json 에서 읽은 기본 일정 (읽기 전이거나 실패하면 빈 목록)
let baseTasks = [];

// 화면에서 추가한 일정 (브라우저에 따로 저장됨)
let addedTasks = loadAddedTasks();

// 받아 온 지역별 날씨 (받기 전이거나 실패하면 null → 판단은 '날씨 확인 전')
let weather = null;

// 받아 온 지역별 특보 목록 (받기 전이거나 실패하면 null → 특보 칸 '-')
let warnings = null;

const form = document.getElementById("task-form");
const message = document.getElementById("form-message");

renderToday();
fillOptions(form.elements.region, REGIONS);
fillOptions(form.elements.kind, KINDS);
renderTasks(allTasks(), weather, warnings); // 파일을 읽기 전에도 추가 일정은 바로 보여 줍니다
loadTasks();     // data/tasks.json 을 읽으면 표를 다시 그립니다
loadWeather();   // 날씨를 받으면 표를 다시 그립니다
loadWarnings();  // 특보를 받으면 표를 다시 그립니다 (날씨와 동시에 따로 받음)

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

  addedTasks.push(result.task);  // 목록 맨 아래에 추가
  saveAddedTasks(addedTasks);    // 추가한 일정만 브라우저에 저장 (새로고침해도 남음)
  renderTasks(allTasks(), weather, warnings); // 표 다시 그리기 (받아 둔 날씨 · 특보로 새 일정도 바로 판단)

  // 다음 입력을 위해 글자 칸만 비우고, 일정 칸에 커서를 둡니다
  message.textContent = "";
  form.elements.title.value = "";
  form.elements.owner.value = "";
  form.elements.title.focus();
});
