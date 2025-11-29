// ========== 전역 변수 및 상수 ==========
let map;
let currentMarker;
const FALLBACK_COORDS = { lat: 37.5665, lng: 126.9780 }; // 서울 시청

// ========== DOM 요소 참조 (페이지 로드 후 초기화) ==========
let permissionScreen;
let loadingScreen;
let app;
let startButton;
let statusBar;
let statusText;

// ========== 초기화 ==========
window.addEventListener("load", () => {
    // DOM 요소 참조 초기화
    permissionScreen = document.getElementById("permission-screen");
    loadingScreen = document.getElementById("loading-screen");
    app = document.getElementById("app");
    startButton = document.getElementById("start-button");
    statusBar = document.getElementById("status-bar");
    statusText = document.getElementById("status-text");

    // 오직 "내 위치로 시작하기" 버튼 이벤트만 연결
    if (startButton) {
        startButton.addEventListener("click", handleStart);
    }

    // 초기 상태 확인 (디버깅용)
    console.log("페이지 로드 완료 - 온보딩 화면만 표시");
});

// ========== 시작 버튼 클릭 핸들러 ==========
function handleStart() {
    console.log("시작 버튼 클릭됨");

    // 1) 권한 안내 화면 숨기고 로딩 화면 표시
    if (permissionScreen) permissionScreen.classList.add("hidden");
    if (loadingScreen) loadingScreen.classList.remove("hidden");

    // 2) kakao.maps.load 내부에서 fallback 좌표로 지도를 먼저 생성
    kakao.maps.load(function () {
        console.log("카카오맵 SDK 로드 완료");

        const container = document.getElementById("map");
        const options = {
            center: new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng),
            level: 4
        };

        // 지도 생성 (fallback 위치 기준)
        map = new kakao.maps.Map(container, options);
        console.log("지도 생성 완료 (fallback 좌표)");

        // fallback 위치에 기본 마커
        const fallbackPosition = new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        currentMarker = new kakao.maps.Marker({ position: fallbackPosition });
        currentMarker.setMap(map);
        console.log("기본 마커 생성 완료");

        // 3) 지도 준비 완료 → 로딩 화면 숨기고 앱 화면 표시
        if (loadingScreen) loadingScreen.classList.add("hidden");
        if (app) app.classList.remove("hidden");
        console.log("메인 앱 화면 표시 완료");

        // 4) 상태 메시지 표시
        showStatusMessage("현재 위치를 불러오는 중입니다...");

        // 5) 이제 비동기로 현재 위치 요청
        requestCurrentPosition();
    });
}

// ========== Geolocation 요청 함수 ==========
function requestCurrentPosition() {
    console.log("Geolocation 요청 시작");

    if (!navigator.geolocation) {
        console.warn("Geolocation not supported");
        showStatusMessage("현재 위치를 가져오지 못해 기본 위치로 지도를 보여드리고 있어요.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // 성공 콜백
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log("위치 정보 획득 성공:", latitude, longitude);

            // 지도 중심을 현재 위치로 이동
            updateMapToCurrentPosition(latitude, longitude);

            // 상태 메시지 업데이트
            showStatusMessage("현재 위치 기준으로 지도를 보여드리고 있어요.");

            // 3초 후 상태 메시지 자동 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        },
        // 실패 콜백
        (error) => {
            // 콘솔에만 상세 에러 로그 출력
            console.error("Geolocation error:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);

            // 에러 타입별 콘솔 로그
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    console.error("PERMISSION_DENIED: 사용자가 위치 권한을 거부했습니다.");
                    break;
                case error.POSITION_UNAVAILABLE:
                    console.error("POSITION_UNAVAILABLE: 위치 정보를 가져올 수 없습니다.");
                    break;
                case error.TIMEOUT:
                    console.error("TIMEOUT: 위치 정보 요청 시간이 초과되었습니다.");
                    break;
                default:
                    console.error("UNKNOWN ERROR:", error);
            }

            // 사용자에게는 간단한 메시지만 표시
            showStatusMessage("현재 위치를 가져오지 못해 기본 위치로 지도를 보여드리고 있어요. 잠시 후 다시 접속해 주세요.");

            // 5초 후 상태 메시지 자동 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 5000);
        },
        // 옵션 (속도 개선을 위해 완화)
        {
            enableHighAccuracy: false, // GPS 사용 안 함 (빠른 응답)
            timeout: 5000, // 5초 타임아웃
            maximumAge: 60000 // 1분 이내 캐시 허용
        }
    );
}

// ========== 지도 업데이트 함수 ==========
function updateMapToCurrentPosition(lat, lng) {
    console.log("지도 중심 업데이트:", lat, lng);

    if (!map) return;

    const newCenter = new kakao.maps.LatLng(lat, lng);

    // 지도 중심 이동
    map.setCenter(newCenter);

    // 기존 마커 제거
    if (currentMarker) {
        currentMarker.setMap(null);
    }

    // 새 위치에 마커 생성
    currentMarker = new kakao.maps.Marker({ position: newCenter });
    currentMarker.setMap(map);

    console.log("마커 업데이트 완료");
}

// ========== 상태 메시지 유틸리티 ==========
function showStatusMessage(message) {
    if (!statusBar || !statusText) return;
    statusText.textContent = message;
    statusBar.classList.remove("hidden");
    console.log("상태 메시지 표시:", message);
}

function hideStatusMessage() {
    if (!statusBar) return;
    statusBar.classList.add("hidden");
    console.log("상태 메시지 숨김");
}

// ========== 리사이즈 대응 ==========
window.addEventListener("resize", () => {
    if (map && currentMarker) {
        map.relayout();
        map.setCenter(currentMarker.getPosition());
        console.log("지도 리사이즈 완료");
    }
});

// ========== TODO: 향후 구현 예정 ==========

/**
 * 주변 시설 데이터 가져오기
 * TODO: 실제 API 엔드포인트 연결 필요
 */
/*
async function fetchNearbyFacilities(latitude, longitude) {
    try {
        const response = await fetch(`/api/facilities?lat=${latitude}&lng=${longitude}&radius=1000`);
        const data = await response.json();
        displayFacilities(data);
    } catch (error) {
        console.error('시설 데이터 로딩 실패:', error);
        showStatusMessage('주변 시설 정보를 불러오는데 실패했습니다.');
    }
}
*/

/**
 * 시설 정보를 지도에 마커로 표시
 * TODO: 시설 데이터 배열을 받아서 마커 생성
 */
/*
function displayFacilities(facilities) {
    facilities.forEach(facility => {
        const position = new kakao.maps.LatLng(facility.latitude, facility.longitude);
        const marker = new kakao.maps.Marker({
            position: position,
            map: map
        });

        // 마커 클릭 이벤트
        kakao.maps.event.addListener(marker, 'click', () => {
            showFacilityInfo(facility);
        });
    });
}
*/

/**
 * 시설 상세 정보 인포윈도우 표시
 * TODO: 인포윈도우 또는 사이드 패널 구현
 */
/*
function showFacilityInfo(facility) {
    const content = `
        <div style="padding:10px; min-width:200px;">
            <h3 style="margin:0 0 10px 0; font-size:16px;">${facility.name}</h3>
            <p style="margin:0; font-size:13px; color:#666;">${facility.address}</p>
            <p style="margin:5px 0 0 0; font-size:12px; color:#999;">거리: ${facility.distance}m</p>
        </div>
    `;

    const infowindow = new kakao.maps.InfoWindow({
        content: content
    });

    infowindow.open(map, marker);
}
*/

// TODO: 추가 기능
// - 검색 기능 (주소, 시설명)
// - 필터링 (시설 종류별: 헬스장, 수영장, 공원 등)
// - 경로 안내 (현재 위치 → 선택한 시설)
// - 즐겨찾기 (로컬 스토리지 활용)
// - 리스트 뷰 / 맵 뷰 전환
// - 현재 위치 재탐색 버튼
