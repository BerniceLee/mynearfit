// ========== 전역 변수 및 상수 ==========
let map;
let currentMarker;
const FALLBACK_COORDS = { lat: 37.5665, lng: 126.9780 }; // 서울 시청

// ========== DOM 요소 참조 ==========
const onboardingPage = document.getElementById("onboarding-page");
const loadingPage = document.getElementById("loading-page");
const appPage = document.getElementById("app-page");
const startButton = document.getElementById("start-button");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const recenterButton = document.getElementById("recenter-button");

// ========== 초기화 ==========
window.addEventListener("load", () => {
    console.log("페이지 로드 완료 - 온보딩 화면만 표시");

    // 이벤트 리스너 등록
    if (startButton) {
        startButton.addEventListener("click", handleStart);
    }

    if (recenterButton) {
        recenterButton.addEventListener("click", handleRecenter);
    }
});

// ========== 시작 버튼 클릭 핸들러 ==========
function handleStart() {
    console.log("시작 버튼 클릭됨 - 로딩 페이지로 전환");

    // 1) 온보딩 페이지 숨기고 로딩 페이지 표시
    if (onboardingPage) onboardingPage.classList.add("hidden");
    if (loadingPage) loadingPage.classList.remove("hidden");

    // 2) Kakao Maps SDK 로드 및 지도 초기화
    kakao.maps.load(function () {
        console.log("카카오맵 SDK 로드 완료");

        const container = document.getElementById("map");
        const options = {
            center: new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng),
            level: 4
        };

        // fallback 좌표로 지도 생성
        map = new kakao.maps.Map(container, options);
        console.log("지도 생성 완료 (fallback 좌표)");

        // fallback 위치에 마커 생성
        const fallbackPos = new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        currentMarker = new kakao.maps.Marker({ position: fallbackPos });
        currentMarker.setMap(map);
        console.log("기본 마커 생성 완료");

        // 3) 지도 준비 완료 → 로딩 페이지 숨기고 메인 페이지 표시
        if (loadingPage) loadingPage.classList.add("hidden");
        if (appPage) appPage.classList.remove("hidden");
        console.log("메인 앱 화면 표시 완료");

        // 4) 상태 메시지 표시 및 현재 위치 요청
        showStatusMessage("현재 위치를 불러오는 중입니다...");
        requestCurrentPosition();
    });
}

// ========== Geolocation 요청 함수 ==========
function requestCurrentPosition() {
    console.log("Geolocation 요청 시작");

    if (!navigator.geolocation) {
        console.warn("Geolocation not supported");
        showStatusMessage("현재 위치를 가져올 수 없어 기본 위치로 지도를 보여드리고 있어요. 잠시 후 다시 접속해 주세요.");
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
            showStatusMessage("현재 위치를 가져올 수 없어 기본 위치로 지도를 보여드리고 있어요. 잠시 후 다시 접속해 주세요.");

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

// ========== 내 위치로 다시 보기 버튼 핸들러 ==========
function handleRecenter() {
    console.log("내 위치로 다시 보기 버튼 클릭");

    if (!map || !currentMarker) {
        console.warn("지도 또는 마커가 없습니다");
        return;
    }

    // 현재 마커 위치로 지도 중심 이동
    const markerPosition = currentMarker.getPosition();
    map.setCenter(markerPosition);
    console.log("지도 중심을 마커 위치로 이동 완료");
}

// ========== 리사이즈 대응 ==========
window.addEventListener("resize", () => {
    if (map && currentMarker) {
        map.relayout();
        map.setCenter(currentMarker.getPosition());
        console.log("지도 리사이즈 완료");
    }
});
