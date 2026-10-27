// logic.js – 판단 규칙만 담는 파일
// 화면(document, 버튼, 표 등)을 다루는 코드는 넣지 않습니다. 화면은 app.js 담당입니다.

// PRD 4장: 지역은 이 4곳 중에서만 고릅니다
const REGIONS = ["세종", "대전", "태안", "보령"];

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

// ===================== F-04 날씨 · 판단 =====================

// 지역별 좌표 (위도, 경도). REGIONS 에 지역을 추가하면 여기도 함께 추가해야 합니다.
const REGION_COORDS = {
  세종: { lat: 36.48, lon: 127.29 },
  대전: { lat: 36.35, lon: 127.38 },
  태안: { lat: 36.75, lon: 126.30 },
  보령: { lat: 36.33, lon: 126.61 },
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

// 일정 하나를 판단합니다 (PRD R-01 ~ R-05).
// task   : { title, region, kind, owner }
// weather: 지역별 날씨 객체. 아직 못 받았으면 null
// 결과   : '영향 없음' · '날씨 확인 전' · '중지 검토' · '폭염 휴식' · '우천 주의' · '진행' 중 하나
// 여러 규칙에 걸리면 R-02 → R-03 → R-04 순서로 먼저 걸린 하나만 돌려줍니다 (R-05).
function judgeTask(task, weather) {
  // R-01 실내는 날씨와 관계없이 영향 없음 (날씨를 못 받았어도 마찬가지)
  if (task.kind === "실내") return "영향 없음";

  // R-05 날씨를 아직 못 받았으면 판단 보류
  const w = weather && weather[task.region];
  if (!w) return "날씨 확인 전";

  // R-02 높은 곳 작업 + 강풍
  if (task.kind === "고소" && w.wind >= WIND_STOP) return "중지 검토";
  // R-03 폭염
  if (w.temp >= HEAT_REST) return "폭염 휴식";
  // R-04 비
  if (w.rain >= RAIN_WARN) return "우천 주의";

  // R-05 어느 규칙에도 안 걸림
  return "진행";
}
