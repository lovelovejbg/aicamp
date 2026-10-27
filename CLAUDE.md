# CLAUDE.md – 현장 일정 날씨판 작업 규칙

## 프로젝트 개요
- 교육용 프로토타입이다. 무엇을 만들지는 PRD.md를 따른다.
- PRD.md에 없는 기능은 먼저 제안하고, 내가 승인한 뒤에만 구현한다.

## 기술 스택 (변경 금지)
- HTML + CSS + 순수 JavaScript만 사용한다. (React 등 프레임워크, 빌드 도구 사용 금지)
- 외부 스크립트는 supabase-js(CDN) 하나만 쓴다.
- index.html 을 더블클릭해서 열 수 있어야 한다.

## 폴더 구조
- index.html : 화면 구조
- style.css  : 디자인
- logic.js   : 판단 규칙만 (화면을 다루는 코드 금지)
- app.js     : 화면 동작 (목록 그리기, 일정 추가)
- api/       : Vercel 서버 함수 (인증키가 필요한 공공데이터 API 를 대신 호출). 순수 JavaScript, 빌드 도구 없음
- config.js  : Supabase 연결 정보 두 줄만 (SUPABASE_URL · SUPABASE_KEY 공개용 키)
- setup.sql  : Supabase 표 wx_tasks 만들기 · 값 규칙 · RLS 정책 · 가상 일정 6건 (SQL Editor 에서 직접 실행)
- PRD.md · CLAUDE.md · README.md : 문서

## 작업 방식
1. 코드를 고치기 전에 계획(수정할 파일과 이유)을 먼저 보여 주고 승인을 받는다.
2. 한 번에 한 가지만 고친다.
3. 끝나면 바꾼 파일, 내가 확인할 방법(T-번호), 남은 문제를 보고한다.

## 보안 · 데이터 규칙
- 가상 데이터만 사용한다. 실제 이름 · 연락처 · 기관 내부 자료를 넣지 않는다.
- 일정 데이터의 기준은 Supabase 표 wx_tasks 다. 읽기 · 추가 모두 이 표에서 한다.
- 코드(js) · JSON 파일 · 브라우저(localStorage)에 일정 목록을 두지 않는다.
- 표 구조 · 값 규칙 · 권한을 바꿀 때는 setup.sql 을 고치고, 화면 규칙(logic.js)과 DB 규칙(CHECK 제약)을 같게 맞춘다.
- Supabase 는 공개용 키(anon · publishable)만 config.js 에 둔다. service_role · secret 키는 코드 · 채팅 · GitHub 어디에도 쓰지 않는다.
- 공개용 키로는 RLS 정책에 따라 읽기 · 추가만 된다. 수정 · 삭제 정책은 만들지 않는다.
- 사용자가 입력한 글자는 textContent 로 표시한다.
- 비밀 키는 코드 · 채팅 · GitHub 에 넣지 않는다.
- 공공데이터 인증키는 Vercel 환경변수(KMA_KEY)에만 두고, api/ 서버 함수에서만 읽는다. 응답에 키를 담지 않는다.
