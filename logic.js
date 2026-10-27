// logic.js – 판단 규칙만 담는 파일
// 화면(document, 버튼, 표 등)을 다루는 코드는 넣지 않습니다. 화면은 app.js 담당입니다.

// PRD 4장: 지역은 이 5곳 중에서만 고릅니다
const REGIONS = ["세종", "대전", "태안", "보령", "서산"];

// PRD 4장: 구분은 이 3가지 중에서만 고릅니다
const KINDS = ["야외", "고소", "실내"];

// 일정 하나가 올바른지 검사합니다.
// 입력: { title, region, kind, owner }
// 결과: 올바르면 { ok: true, task: 앞뒤 공백을 지운 일정 }
//       틀리면   { ok: false, message: 사용자에게 보여 줄 안내 문구 }
function validateTask(input) {
  // 앞뒤 공백을 지웁니다. 값이 없으면(undefined) 빈 문자열로 취급합니다
  const task = {
    title: String(input.title ?? "").trim(),
    region: String(input.region ?? "").trim(),
    kind: String(input.kind ?? "").trim(),
    owner: String(input.owner ?? "").trim(),
  };

  if (task.title === "") {
    return { ok: false, message: "일정 이름을 입력해 주세요." };
  }
  // 선택 목록에 없는 값이 들어오면 거부합니다
  if (!REGIONS.includes(task.region)) {
    return { ok: false, message: "지역을 목록에서 골라 주세요." };
  }
  if (!KINDS.includes(task.kind)) {
    return { ok: false, message: "구분을 목록에서 골라 주세요." };
  }
  if (task.owner === "") {
    return { ok: false, message: "담당자를 입력해 주세요." };
  }

  return { ok: true, task };
}

// 일정 배열(data/tasks.json 내용이나 브라우저에 저장된 값)을 검사해 올바른 일정만 돌려줍니다.
// 배열이 아니면 오류를 던집니다. 규칙에 안 맞는 일정(빈칸 · 목록에 없는 지역 등)은 조용히 뺍니다.
function parseTasks(data) {
  if (!Array.isArray(data)) throw new Error("일정 데이터가 배열이 아닙니다.");
  return data
    .map((item) => validateTask(item ?? {}))
    .filter((result) => result.ok)
    .map((result) => result.task);
}

// ===================== F-04 날씨 · 판단 =====================

// 지역별 좌표 (위도, 경도). REGIONS 에 지역을 추가하면 여기도 함께 추가해야 합니다.
const REGION_COORDS = {
  세종: { lat: 36.48, lon: 127.29 },
  대전: { lat: 36.35, lon: 127.38 },
  태안: { lat: 36.75, lon: 126.30 },
  보령: { lat: 36.33, lon: 126.61 },
  서산: { lat: 36.78, lon: 126.45 },
};

// PRD 5장 업무 규칙의 기준값 (교육용 가상 기준)
const WIND_STOP = 10;  // R-02 최대 풍속 10 m/s 이상
const HEAT_REST = 33;  // R-03 최고 기온 33℃ 이상
const RAIN_WARN = 60;  // R-04 강수확률 60% 이상

// ?test=wind 일 때 넣을 풍속 값
const TEST_WIND = 12;

// Open-Meteo 주소를 만듭니다. 4개 지역을 한 번에 묻습니다 (위도 · 경도를 쉼표로 이어 붙임).
// 키가 필요 없는 무료 API 입니다.
function buildWeatherUrl() {
  const params = new URLSearchParams({
    latitude: REGIONS.map((region) => REGION_COORDS[region].lat).join(","),
    longitude: REGIONS.map((region) => REGION_COORDS[region].lon).join(","),
    // 오늘 하루 값: 최고 기온 · 최대 풍속 · 최대 강수확률
    daily: "temperature_2m_max,wind_speed_10m_max,precipitation_probability_max",
    wind_speed_unit: "ms",     // 풍속 단위를 m/s 로 (기본값은 km/h)
    timezone: "Asia/Seoul",    // '오늘'을 한국 시간 기준으로
    forecast_days: "1",        // 오늘 하루만
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// API 응답을 { 세종: { temp, wind, rain }, 대전: {...}, ... } 형태로 바꿉니다.
// 지역을 여러 곳 물으면 응답은 배열이고, 순서는 주소에 넣은 REGIONS 순서와 같습니다.
// 형식이 예상과 다르면 오류를 던집니다 (app.js 가 받아서 '날씨 확인 전'으로 처리).
function parseWeather(data) {
  // 지역이 하나뿐이면 배열이 아닌 객체로 오므로 배열로 맞춥니다
  const list = Array.isArray(data) ? data : [data];
  if (list.length !== REGIONS.length) {
    throw new Error("날씨 응답의 지역 수가 맞지 않습니다.");
  }

  const weather = {};
  REGIONS.forEach((region, index) => {
    const daily = list[index] && list[index].daily;
    // daily 의 각 값은 날짜별 배열이므로 [0] 이 오늘입니다
    const temp = daily && daily.temperature_2m_max && daily.temperature_2m_max[0];
    const wind = daily && daily.wind_speed_10m_max && daily.wind_speed_10m_max[0];
    const rain = daily && daily.precipitation_probability_max && daily.precipitation_probability_max[0];

    // 숫자가 하나라도 비어 있으면 잘못된 응답으로 봅니다
    if (![temp, wind, rain].every((value) => typeof value === "number")) {
      throw new Error(`${region} 날씨 값이 비어 있습니다.`);
    }
    weather[region] = { temp, wind, rain };
  });
  return weather;
}

// 시험 모드를 적용합니다. 원본은 그대로 두고 바뀐 복사본을 돌려줍니다.
// mode 가 "wind" 이면 모든 지역의 풍속을 TEST_WIND(12 m/s)로 바꿉니다.
function applyTestMode(weather, mode) {
  if (mode !== "wind") return weather;
  const changed = {};
  for (const region of Object.keys(weather)) {
    changed[region] = { ...weather[region], wind: TEST_WIND };
  }
  return changed;
}

// ===================== F-07 기상특보 =====================

// 배포된 서버 함수 주소. 더블클릭(file://)이나 로컬에서 열 때는 이 주소를 부릅니다.
const DEPLOYED_SITE = "https://aicamp-mu.vercel.app";

// 충청남도 소속 지역. 특보 글에 "충청남도"만 있고 세부 지역이 없으면 충남 전체 특보입니다.
const CHUNGNAM_REGIONS = ["태안", "보령", "서산"];

// 특보 서버 함수 주소를 정합니다.
// Vercel 에서 열었으면 같은 사이트의 /api/warnings, 그 밖(file:// · localhost)이면 배포 주소를 씁니다.
// (화면 코드를 쓰지 않도록 location 대신 hostname 글자만 받습니다)
function buildWarningUrl(hostname) {
  if (hostname && hostname.endsWith(".vercel.app")) return "/api/warnings";
  return `${DEPLOYED_SITE}/api/warnings`;
}

// 특보 지역 글(areas)에 해당 지역이 들어 있는지 봅니다.
// 예) "충청남도(태안, 당진, 보령(도서제외))" → 태안 O, 보령 O, 세종 X
function isRegionInAreas(region, areas) {
  // "태안 제외" 처럼 제외된 경우는 빼고 찾습니다
  const named = new RegExp(`${region}(?!\\s*제외)`).test(areas);
  if (named) return true;
  // "충청남도" 뒤에 괄호가 없으면 충남 전체 특보 → 태안 · 보령 · 서산 해당
  return CHUNGNAM_REGIONS.includes(region) && /충청남도(?!\s*\()/.test(areas);
}

// 기상청 특보발효현황 글(t6)을 지역별 특보 목록으로 바꿉니다.
// 입력 예: "o 강풍주의보 : 충청남도(태안, 보령)\r\no 한파주의보 : 대전, 세종"
// 결과 예: { 세종: [{ type: "한파", level: "주의보" }], 대전: [...], 태안: [{ type: "강풍", level: "주의보" }], 보령: [...] }
function parseWarnings(t6) {
  const warnings = {};
  for (const region of REGIONS) warnings[region] = [];

  // 한 줄에 특보 하나씩: "o {종류}{주의보|경보} : {지역들}"
  for (const line of String(t6 ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*o\s*(\S+?)(주의보|경보)\s*:\s*(.+)$/);
    if (!match) continue;
    const [, type, level, areas] = match;
    for (const region of REGIONS) {
      if (isRegionInAreas(region, areas)) warnings[region].push({ type, level });
    }
  }
  return warnings;
}

// 특보 시험 모드: mode 가 "warn" 이면 모든 지역에 강풍주의보를 더한 복사본을 돌려줍니다.
// 특보를 못 받았어도(null) 시험할 수 있게 빈 목록에서 시작합니다.
function applyWarningTestMode(warnings, mode) {
  if (mode !== "warn") return warnings;
  const changed = {};
  for (const region of REGIONS) {
    const list = (warnings && warnings[region]) || [];
    changed[region] = [...list, { type: "강풍", level: "주의보" }];
  }
  return changed;
}

// 일정 하나를 판단합니다 (PRD R-01 ~ R-06).
// task    : { title, region, kind, owner }
// weather : 지역별 날씨 객체. 아직 못 받았으면 null
// warnings: 지역별 특보 목록. 아직 못 받았으면 null (생략 가능)
// 결과    : '영향 없음' · '날씨 확인 전' · '중지 검토' · '폭염 휴식' · '우천 주의' · '진행' 중 하나
// 여러 규칙에 걸리면 R-02 → R-03 → R-04 순서로 먼저 걸린 하나만 돌려줍니다 (R-05).
function judgeTask(task, weather, warnings) {
  // R-01 실내는 날씨와 관계없이 영향 없음 (날씨를 못 받았어도 마찬가지)
  if (task.kind === "실내") return "영향 없음";

  const w = weather && weather[task.region];
  const list = (warnings && warnings[task.region]) || [];
  // R-06 해당 지역에 이 종류의 특보(주의보 · 경보)가 있는지
  const hasWarning = (type) => list.some((item) => item.type === type);

  // R-02 높은 곳 작업 + (풍속 10 m/s 이상 또는 강풍특보)
  if (task.kind === "고소" && ((w && w.wind >= WIND_STOP) || hasWarning("강풍"))) return "중지 검토";
  // R-03 최고 기온 33℃ 이상 또는 폭염특보
  if ((w && w.temp >= HEAT_REST) || hasWarning("폭염")) return "폭염 휴식";
  // R-04 강수확률 60% 이상 또는 호우특보
  if ((w && w.rain >= RAIN_WARN) || hasWarning("호우")) return "우천 주의";

  // R-05 날씨를 아직 못 받았으면 판단 보류, 받았는데 어느 규칙에도 안 걸리면 진행
  if (!w) return "날씨 확인 전";
  return "진행";
}
