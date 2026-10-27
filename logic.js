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
