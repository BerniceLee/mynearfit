// ========== 전역 변수 및 상수 ==========
let map;
let currentMarker; // 내 위치 마커 (빨간색)
let searchMarker;  // 검색 결과 마커
const FALLBACK_COORDS = { lat: 37.5665, lng: 126.9780 }; // 서울 시청

// 내 위치 마커 아이콘 (빨간색)
const USER_MARKER_IMAGE = new kakao.maps.MarkerImage(
    "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
    new kakao.maps.Size(64, 69),
    { offset: new kakao.maps.Point(27, 69) }
);

// ========== DOM 요소 참조 ==========
const onboardingPage = document.getElementById("onboarding-page");
const loadingPage = document.getElementById("loading-page");
const appPage = document.getElementById("app-page");
const startButton = document.getElementById("start-button");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const recenterButton = document.getElementById("recenter-button");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");

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

    const onboardingPage = document.getElementById("onboarding-page");
    const loadingPage = document.getElementById("loading-page");
    const appPage = document.getElementById("app-page");

    // 1) 온보딩 숨기기
    onboardingPage.classList.add("hidden");

    // 2) 메인 페이지는 미리 보이게 (지도 div 크기 확보)
    appPage.classList.remove("hidden");

    // 3) 로딩 페이지를 위에 띄우기
    loadingPage.classList.remove("hidden");

    // 4) Kakao 지도 생성
    kakao.maps.load(function () {
        console.log("카카오맵 SDK 로드 완료");

        const container = document.getElementById("map");
        const center = new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        const options = { center, level: 4 };

        map = new kakao.maps.Map(container, options);
        console.log("지도 생성 완료 (fallback 좌표)");

        currentMarker = new kakao.maps.Marker({
            position: center,
            image: USER_MARKER_IMAGE
        });
        currentMarker.setMap(map);
        console.log("기본 마커 생성 완료 (빨간색)");

        // 지도가 hidden 상태에서 만들어졌을 수 있으니 레이아웃 재계산
        map.relayout();
        map.setCenter(center);
        console.log("지도 레이아웃 재계산 완료");

        // 검색 기능 초기화
        setupSearch();

        // 5) 로딩 페이지 숨기고 상태메시지 + 위치 요청
        loadingPage.classList.add("hidden");

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

    // 새 위치에 마커 생성 (빨간색)
    currentMarker = new kakao.maps.Marker({
        position: newCenter,
        image: USER_MARKER_IMAGE
    });
    currentMarker.setMap(map);

    console.log("마커 업데이트 완료 (빨간색)");
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

// ========== 검색 기능 ==========
function setupSearch() {
    if (!searchInput || !searchButton) {
        console.warn("검색 요소를 찾을 수 없습니다");
        return;
    }

    const places = new kakao.maps.services.Places();

    function doSearch() {
        const keyword = searchInput.value.trim();
        if (!keyword) {
            showStatusMessage("검색어를 입력해 주세요.");
            return;
        }

        console.log("장소 검색 시작:", keyword);

        places.keywordSearch(keyword, function (result, status) {
            if (status !== kakao.maps.services.Status.OK || !result.length) {
                showStatusMessage("검색 결과를 찾지 못했어요.");
                console.log("검색 실패:", status);
                return;
            }

            const first = result[0];
            const newPos = new kakao.maps.LatLng(first.y, first.x);

            console.log("검색 결과:", first.place_name, first.y, first.x);

            // 지도 중심 이동
            map.setCenter(newPos);

            // 기존 검색 마커 제거
            if (searchMarker) {
                searchMarker.setMap(null);
            }

            // 새 검색 마커 생성 (기본 마커)
            searchMarker = new kakao.maps.Marker({
                position: newPos
            });
            searchMarker.setMap(map);

            showStatusMessage(`"${first.place_name}" 근처로 이동했어요.`);
            console.log("검색 마커 생성 완료");

            // 3초 후 상태 메시지 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        });
    }

    // 검색 버튼 클릭 이벤트
    searchButton.addEventListener("click", doSearch);

    // 엔터 키 이벤트
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            doSearch();
        }
    });

    console.log("검색 기능 초기화 완료");
}

// ========== 리사이즈 대응 ==========
window.addEventListener("resize", () => {
    if (map && currentMarker) {
        map.relayout();
        map.setCenter(currentMarker.getPosition());
        console.log("지도 리사이즈 완료");
    }
});
