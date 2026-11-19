# ARVO R5.3 — EDITORIAL REFINEMENT / 2026-11-19

**상태:** 내부 검토 시안 · 운영 배포/공개 승인 미실시 · GitHub 원본 보존.

## 실행하기
1. 압축 해제 후 이 폴더 자체를 VS Code에서 엽니다.
2. Node.js 18 이상: `npm run dev` → 로컬 주소 `http://127.0.0.1:5304` (포트 사용 중이면 `node scripts/serve.mjs --port 5305`).
3. 수정 위치: `dist/styles.css` 맨 아래 `ARVO R5.3 — EDITORIAL REFINEMENT` 블록. 실제 원본 CSS/사진/상품 데이터는 보존했습니다.
4. 속도 미세 조절: `dist/styles.css`의 `--arvo-marquee-duration` 기본 44초, 모바일 47초. 대안은 38초(경쾌함)·44초(현재)·52초(더 느림).
5. 이미지·문장: `dist/index.html` / `dist/data.js`.
6. 파일 하나로 보기: `npm run build:standalone`, 출력은 `../deliverables/ARVO_R5_3_EDITORIAL_PREVIEW_20261119.html`.

## 이번에 실제 변경한 항목
- 영문 대형 제목/객실 카드/예약 문장 굵기 700~900 → 500~600으로 완화; 글자 크기 5~10% 내 조정.
- 한글 서체는 기존 Noto Sans KR 유지하며 본문과 강조의 굵기 격차를 줄임.
- Marquee 28초 → 44초 (모바일 47초)로 느리게. 스크롤 등장 0.75초 → 1.1초, 사진 전환 완화.
- 800px 축소본을 쓴 PC/욕실 갤러리 카드는 작게 표시. 확대보기에서는 기존 1400~1700px 원본 유지.
- 모바일 대형 제목 균형, 사진 간 여백, 히어로 첫 CTA 문구 간결화.
- 각 정적 이미지의 실제 width/height 메타데이터 수정, decoding=async 추가.

## 변경하지 않은 것
- R5.2 메인 아이보리 + 실제 사진, 객실 선택 데이터, NOL·여기어때 예약 링크, 사진 리소스 자체, 지도, FAQ, 로고, noindex.
- 백엔드·재고·가격·결제·운영 배포·GitHub main/PR, 호텔/식당 운영 조건.

## 공개 전 확인
객실·OTA 정확 매핑과 현재 시설·운영정보, 사진 사용 승인·현재성, 지도 공식 핀, 예약 링크의 실제 모바일 연결, 대표자 공개 승인. 현재는 내부 시안이며 트윈 계열 등 정보는 최종 운영 원장과 별도 검증 필요.

자세한 변경 기록 및 QA는 `docs/R5_3_CHANGELOG_AND_QA.md`에서 확인하세요.
