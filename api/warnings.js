// api/warnings.js – Vercel 서버 함수 (주소: /api/warnings)
// 기상청 특보현황조회(getPwnStatus)를 인증키를 숨긴 채 대신 불러 줍니다.
// 인증키는 Vercel 환경변수 KMA_KEY 에만 있고, 브라우저로 보내는 응답에는 절대 담지 않습니다.

const KMA_URL = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";

module.exports = async (req, res) => {
  // 더블클릭(file://)이나 다른 주소에서 열어도 이 함수를 부를 수 있게 허용합니다
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.KMA_KEY;
  if (!key) {
    res.status(500).json({ ok: false, message: "서버에 KMA_KEY 환경변수가 없습니다." });
    return;
  }

  try {
    const params = new URLSearchParams({
      serviceKey: key,
      numOfRows: "10",
      pageNo: "1",
      dataType: "JSON",
    });
    const response = await fetch(`${KMA_URL}?${params}`);
    if (!response.ok) throw new Error(`기상청 응답 오류 (${response.status})`);

    // 키가 틀리면 기상청이 JSON 이 아닌 XML 오류를 보내기도 하므로 글자로 먼저 받습니다
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("기상청 응답이 JSON 이 아닙니다 (인증키를 확인하세요).");
    }

    const header = data.response && data.response.header;
    const code = header && header.resultCode;

    // "03" = 데이터 없음: 지금 발효 중인 특보가 하나도 없다는 뜻이라 정상으로 처리
    if (code === "03") {
      res.setHeader("Cache-Control", "s-maxage=600");
      res.status(200).json({ ok: true, tmFc: null, t6: "" });
      return;
    }
    if (code !== "00") {
      throw new Error(`기상청 결과 코드 ${code} (${header && header.resultMsg})`);
    }

    // item 은 목록(배열)으로 오며, [0] 이 가장 최근 특보현황입니다
    const items = data.response.body.items.item;
    const latest = Array.isArray(items) ? items[0] : items;

    // Vercel 이 10분 동안 결과를 저장해 두고 재사용 → 기상청 호출 횟수를 줄임
    res.setHeader("Cache-Control", "s-maxage=600");
    res.status(200).json({
      ok: true,
      tmFc: latest.tmFc,   // 발표시각 (예: 202610271600)
      t6: latest.t6 || "", // 특보발효현황 내용 (지역 해석은 logic.js 가 담당)
    });
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message });
  }
};
