# ARVO R5.1 — 검수 상태 (2026-11-19)

## 완료
- 정적 소스의 HTML 내 각 영역·예약/지도 링크, CSS/JS 존재 확인.
- Node.js의 `node --check`로 기존 `app.js`, `data.js`, standalone builder 문법 검사 통과.
- `node scripts/build-standalone.mjs --output ...`로 사진·스크립트가 포함된 HTML 생성 완료 (약 4 MB).
- Chromium에 HTML 내용을 직접 `set_content()`한 단회 테스트에서 1440×900 첫 화면이 렌더링되고, 화면 가로 넘침 없이(`scrollWidth=1440`) 영문 타이포/히어로 배경 사진이 표시됨.

## 미완료·환경 제약
- 로컬 `file://` 페이지 직접 열람은 `ERR_BLOCKED_BY_ADMINISTRATOR`로 거부됨.
- 네트워크 지도 iframe의 실제 렌더링·핀 정확도·길찾기는 확인하지 못함. 주소 기반 지도 프리뷰는 공식 업체 지도 핀으로 교체 요망.
- Chromium 390/320/1366 반응형 일괄 테스트 및 객실 선택·예약 모달 자동 테스트는 자동화 대기/시간 제한으로 완료하지 못함. 이전 R5 단계에서 확인된 사실을 이번 R5.1 검수로 승계하지 않음.
- Google 웹 폰트는 인터넷 연결이 있을 때만 사용 가능. 외부 연결 불가 시 시스템 대체 서체.
- 공개 승인·운영정보 최종 대조·실제 기기 검수·운영 배포 모두 미실시.

## 권장 다음 QA
1. VS Code `npm run dev` → 1440/1366/390/320px 화면 비교.
2. `STAY YOUR WAY` 글자와 CTA 겹침, 한글 폰트 대체 상태, 모바일 헤더 확인.
3. 마키 무한 반복 이음매, `prefers-reduced-motion`, 사용자 수동 움직임 끄기.
4. 객실 탭/사진/비교/예약 모달, 키보드/터치.
5. Google Maps 실제 업체 핀 + 위치/출입구가 맞는지 현장 담당자 확인.
