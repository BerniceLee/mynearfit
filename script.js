// 버튼이 안 눌리던 문제: kakao 객체 사용 위치 정리 + 이벤트 바인딩 확인
// - 전역에서 kakao.* API 호출 제거
// - 모든 Kakao 관련 객체는 kakao.maps.load 콜백 내부에서만 생성
// - 이벤트 바인딩을 확실하게 window.load 시점에 실행

// ========== 전역 변수 및 상수 ==========
let map;
let currentMarker; // 내 위치 마커 (빨간색)
let searchMarker;  // 검색 결과 마커
let placesService; // Kakao Places 서비스
let userMarkerImage; // 내 위치 마커 아이콘 (kakao.maps.load 안에서 생성)

const FALLBACK_COORDS = { lat: 37.5665, lng: 126.9780 }; // 서울 시청

// ========== DOM 요소 참조 (전역) ==========
let onboardingPage;
let loadingPage;
let appPage;
let startButton;
let statusBar;
let statusText;
let recenterButton;
let searchInput;
let searchButton;

// ========== UI 인터랙션 변수 ==========
let drawer;
let drawerHandle;
let isDragging = false;
let startY = 0;
let startHeight = 0;
let drawerMinHeight;
let drawerMaxHeight;

let recommendSection;
let recommendHideTimer;
let hasRecommendHiddenOnce = false;

// ========== 시설 데이터 및 마커 관리 ==========
let facilities = []; // 전체 시설 데이터
let visibleFacilities = []; // 현재 필터링된 시설
let facilityMarkers = []; // 지도에 표시된 시설 마커들
let facilityMarkerImage; // 시설 마커 아이콘

// ========== 검색 결과 관리 ==========
let searchResults = [];
let searchResultsSheet;

// ========== 초기화 ==========
window.addEventListener("load", () => {
    console.log("[DEBUG] script loaded");

    // 모바일 100vh 이슈 해결
    function updateVh() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    updateVh();
    window.addEventListener('resize', updateVh);

    // DOM 요소 참조
    onboardingPage = document.getElementById("onboarding-page");
    loadingPage = document.getElementById("loading-page");
    appPage = document.getElementById("app-page");
    startButton = document.getElementById("start-button");
    statusBar = document.getElementById("status-bar");
    statusText = document.getElementById("status-text");
    recenterButton = document.getElementById("recenter-button");
    searchInput = document.getElementById("search-input");
    searchButton = document.getElementById("search-button");

    console.log("[DEBUG] startButton:", !!startButton);
    console.log("[DEBUG] recenterButton:", !!recenterButton);

    // 이벤트 리스너 등록
    if (startButton) {
        startButton.addEventListener("click", handleStart);
        console.log("[DEBUG] startButton 이벤트 등록 완료");
    } else {
        console.error("[ERROR] startButton을 찾을 수 없습니다");
    }

    if (recenterButton) {
        recenterButton.addEventListener("click", handleRecenter);
        console.log("[DEBUG] recenterButton 이벤트 등록 완료");
    }
});

// ========== 시작 버튼 클릭 핸들러 ==========
function handleStart() {
    console.log("[DEBUG] handleStart called");
    console.log("시작 버튼 클릭됨 - 로딩 페이지로 전환");

    // 1) 온보딩 숨기기
    if (onboardingPage) onboardingPage.classList.add("hidden");

    // 2) 메인 페이지는 미리 보이게 (지도 div 크기 확보)
    if (appPage) appPage.classList.remove("hidden");

    // 3) 로딩 페이지를 위에 띄우기
    if (loadingPage) loadingPage.classList.remove("hidden");

    // 4) Kakao 지도 생성 (여기서부터 kakao 객체 사용 가능)
    kakao.maps.load(function () {
        console.log("카카오맵 SDK 로드 완료");

        // 내 위치 마커 아이콘 생성 (빨간색, 크기 축소)
        userMarkerImage = new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
            new kakao.maps.Size(32, 36),
            { offset: new kakao.maps.Point(16, 36) }
        );
        console.log("빨간 마커 이미지 생성 완료");

        // 시설 마커 아이콘 생성 (별 모양, 작은 크기)
        facilityMarkerImage = new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            new kakao.maps.Size(24, 35),
            { offset: new kakao.maps.Point(12, 35) }
        );
        console.log("시설 마커 이미지 생성 완료");

        // Places 서비스 초기화
        placesService = new kakao.maps.services.Places();
        console.log("Places 서비스 초기화 완료");

        const container = document.getElementById("map");
        const center = new kakao.maps.LatLng(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        const options = { center, level: 4 };

        map = new kakao.maps.Map(container, options);
        console.log("지도 생성 완료 (fallback 좌표)");

        currentMarker = new kakao.maps.Marker({
            position: center,
            image: userMarkerImage
        });
        currentMarker.setMap(map);
        console.log("기본 마커 생성 완료 (빨간색)");

        // 검색 기능 초기화
        setupSearch();

        // UI 초기화 (Drawer, 반경칩, 필터칩, 시설 버튼)
        setupDrawerUI();
        setupRadiusChips();
        setupFilterChips();
        setupFacilityButtons();

        // 검색 결과 sheet 초기화
        setupSearchResultsSheet();

        // 더미 시설 데이터 초기화 (실제로는 API에서 가져올 데이터)
        initializeFacilities();

        // 5) 로딩 페이지 숨기고 상태메시지 + 위치 요청
        if (loadingPage) loadingPage.classList.add("hidden");

        // 지도 레이아웃 재계산 (모든 UI가 준비된 후)
        setTimeout(() => {
            map.relayout();
            map.setCenter(center);
            console.log("지도 레이아웃 재계산 완료");
        }, 100);

        showStatusMessage("현재 위치를 불러오는 중입니다...");
        requestCurrentPosition();

        // 6) 추천 카드 자동 숨김 타이머 시작
        startRecommendHideTimer();
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
        image: userMarkerImage
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

    if (!placesService) {
        console.error("Places 서비스가 초기화되지 않았습니다");
        return;
    }

    function doSearch() {
        const keyword = searchInput.value.trim();
        if (!keyword) {
            showStatusMessage("검색어를 입력해 주세요.");
            return;
        }

        console.log("장소 검색 시작:", keyword);

        placesService.keywordSearch(keyword, function (result, status) {
            if (status !== kakao.maps.services.Status.OK || !result.length) {
                showStatusMessage("검색 결과를 찾지 못했어요.");
                console.log("검색 실패:", status);
                return;
            }

            // 검색 결과를 최대 10개까지 저장
            searchResults = result.slice(0, 10);
            console.log("검색 결과:", searchResults.length, "개");

            // 검색 결과를 sheet에 렌더링
            renderSearchResults();

            // 검색 결과 sheet 표시
            if (searchResultsSheet) {
                searchResultsSheet.classList.remove("hidden");
            }
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

// ========== Drawer UI 드래그 가능 Bottom Sheet ==========
function setupDrawerUI() {
    drawer = document.getElementById("drawer");
    drawerHandle = document.getElementById("drawer-handle");

    if (!drawer || !drawerHandle) return;

    const vh = window.innerHeight;
    drawerMinHeight = vh * 0.30; // 30vh
    drawerMaxHeight = vh * 0.80; // 80vh

    drawer.style.height = drawerMinHeight + "px";
    drawer.classList.add("collapsed");

    function onDragStart(event) {
        isDragging = true;
        startY = event.touches ? event.touches[0].clientY : event.clientY;
        startHeight = drawer.offsetHeight;
        drawer.style.transition = "none";
    }

    function onDragMove(event) {
        if (!isDragging) return;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const deltaY = startY - clientY; // 위로 드래그 = 양수

        let newHeight = startHeight + deltaY;
        newHeight = Math.max(drawerMinHeight, Math.min(drawerMaxHeight, newHeight));
        drawer.style.height = newHeight + "px";
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        drawer.style.transition = "height 0.2s ease-out";

        const currentHeight = drawer.offsetHeight;
        const middle = (drawerMinHeight + drawerMaxHeight) / 2;

        if (currentHeight < middle) {
            drawer.style.height = drawerMinHeight + "px";
            drawer.classList.add("collapsed");
            drawer.classList.remove("expanded");
        } else {
            drawer.style.height = drawerMaxHeight + "px";
            drawer.classList.add("expanded");
            drawer.classList.remove("collapsed");
        }
    }

    drawerHandle.addEventListener("mousedown", onDragStart);
    drawerHandle.addEventListener("touchstart", onDragStart);

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("touchmove", onDragMove);

    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("touchend", onDragEnd);

    console.log("[DEBUG] Drawer UI 드래그 기능 초기화 완료");
}

// ========== 반경 칩 UI ==========
function setupRadiusChips() {
    const radiusChips = document.querySelectorAll(".radius-chip");

    radiusChips.forEach(chip => {
        chip.addEventListener("click", () => {
            // 모든 칩에서 active 제거
            radiusChips.forEach(c => c.classList.remove("active"));
            // 클릭한 칩에 active 추가
            chip.classList.add("active");

            const radius = chip.getAttribute("data-radius");
            showStatusMessage(`반경 ${radius}km 내 시설을 보고 있어요.`);
            console.log("반경 칩 클릭:", radius + "km");

            // 3초 후 상태바 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        });
    });

    console.log("[DEBUG] 반경 칩 UI 초기화 완료");
}

// ========== 필터 칩 UI ==========
function setupFilterChips() {
    const filterChips = document.querySelectorAll("#drawer-filters .filter-chip");

    filterChips.forEach(chip => {
        chip.addEventListener("click", () => {
            // active 토글
            chip.classList.toggle("active");

            const filter = chip.getAttribute("data-filter");
            const isActive = chip.classList.contains("active");

            if (isActive) {
                showStatusMessage(`"${chip.textContent}" 필터를 적용했어요.`);
            } else {
                showStatusMessage(`"${chip.textContent}" 필터를 해제했어요.`);
            }

            console.log("필터 칩 클릭:", filter, isActive ? "활성화" : "비활성화");

            // 3초 후 상태바 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        });
    });

    console.log("[DEBUG] 필터 칩 UI 초기화 완료");
}

// ========== 시설 카드 버튼 UI (더미) ==========
function setupFacilityButtons() {
    // 지도에서 보기 버튼
    const mapButtons = document.querySelectorAll(".facility-map-button");
    mapButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const facilityName = e.target.closest(".facility-card").querySelector(".facility-name").textContent;
            showStatusMessage(`"${facilityName}"를 지도에서 보여드릴게요.`);
            console.log("지도에서 보기:", facilityName);

            setTimeout(() => {
                hideStatusMessage();
            }, 2000);
        });
    });

    // 길찾기 버튼
    const navButtons = document.querySelectorAll(".facility-nav-button");
    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const facilityName = e.target.closest(".facility-card").querySelector(".facility-name").textContent;
            showStatusMessage(`"${facilityName}" 길찾기를 시작합니다.`);
            console.log("길찾기:", facilityName);

            setTimeout(() => {
                hideStatusMessage();
            }, 2000);
        });
    });

    console.log("[DEBUG] 시설 카드 버튼 UI 초기화 완료");
}

// ========== 추천 카드 자동 숨김 기능 ==========
function hideRecommendSection() {
    if (!recommendSection || hasRecommendHiddenOnce) return;
    recommendSection.classList.add("hidden");
    hasRecommendHiddenOnce = true;
    console.log("[DEBUG] 추천 카드 숨김");
}

function startRecommendHideTimer() {
    recommendSection = document.getElementById("recommend-section");
    const mapWrapper = document.getElementById("map-wrapper");

    if (!recommendSection) return;

    // 초기에는 보이도록
    recommendSection.classList.remove("hidden");

    // 4초 후 자동 숨김
    if (recommendHideTimer) clearTimeout(recommendHideTimer);
    recommendHideTimer = setTimeout(hideRecommendSection, 4000);

    // 지도 상호작용 시 즉시 숨김
    if (mapWrapper) {
        mapWrapper.addEventListener("mousedown", hideRecommendSection, { once: true });
        mapWrapper.addEventListener("touchstart", hideRecommendSection, { once: true });
    }

    // drawer 드래그 시작 시 즉시 숨김
    if (drawerHandle) {
        drawerHandle.addEventListener("mousedown", hideRecommendSection, { once: true });
        drawerHandle.addEventListener("touchstart", hideRecommendSection, { once: true });
    }

    console.log("[DEBUG] 추천 카드 자동 숨김 타이머 시작");
}

// ========== 리사이즈 대응 ==========
window.addEventListener("resize", () => {
    if (map && currentMarker) {
        map.relayout();
        map.setCenter(currentMarker.getPosition());
        console.log("지도 리사이즈 완료");
    }

    // drawer 높이 재조정
    if (drawer && drawerMinHeight && drawerMaxHeight) {
        const vh = window.innerHeight;
        drawerMinHeight = vh * 0.30;
        drawerMaxHeight = vh * 0.80;

        // 현재 상태 유지하면서 높이 재조정
        if (drawer.classList.contains("collapsed")) {
            drawer.style.height = drawerMinHeight + "px";
        } else if (drawer.classList.contains("expanded")) {
            drawer.style.height = drawerMaxHeight + "px";
        }
    }
});

// ========== 시설 데이터 초기화 ==========
function initializeFacilities() {
    // 더미 시설 데이터 (실제로는 API에서 가져올 데이터)
    facilities = [
        { id: 1, name: "동네 근린공원", lat: 37.5665, lng: 126.9790, type: "outdoor", isFree: true, isIndoor: false, isOpenNow: true, isCourse: false, distance: 350 },
        { id: 2, name: "시립 체육관", lat: 37.5670, lng: 126.9785, type: "indoor", isFree: false, isIndoor: true, isOpenNow: true, isCourse: false, distance: 720 },
        { id: 3, name: "올림픽 둘레길 5구간", lat: 37.5655, lng: 126.9795, type: "course", isFree: true, isIndoor: false, isOpenNow: true, isCourse: true, distance: 1200 },
        { id: 4, name: "구립 수영장", lat: 37.5680, lng: 126.9775, type: "indoor", isFree: false, isIndoor: true, isOpenNow: false, isCourse: false, distance: 1500 },
        { id: 5, name: "야외 농구장", lat: 37.5675, lng: 126.9800, type: "outdoor", isFree: true, isIndoor: false, isOpenNow: true, isCourse: false, distance: 850 }
    ];

    // 초기에는 모든 시설을 표시
    visibleFacilities = [...facilities];

    // 시설 개수 업데이트
    updateFacilityCount(visibleFacilities.length);

    // 시설 마커 렌더링
    renderFacilityMarkers(visibleFacilities);

    console.log("[DEBUG] 시설 데이터 초기화 완료:", facilities.length, "개");
}

// ========== 시설 개수 업데이트 ==========
function updateFacilityCount(count) {
    const countEl = document.getElementById("facility-count");
    if (!countEl) return;
    countEl.textContent = `${count}곳`;
    console.log("[DEBUG] 시설 개수 업데이트:", count, "곳");
}

// ========== 시설 마커 렌더링 ==========
function renderFacilityMarkers(facilitiesToShow) {
    if (!map || !facilityMarkerImage) return;

    // 기존 마커 모두 제거
    facilityMarkers.forEach(marker => marker.setMap(null));
    facilityMarkers = [];

    // 새 마커 생성
    facilitiesToShow.forEach(facility => {
        const position = new kakao.maps.LatLng(facility.lat, facility.lng);
        const marker = new kakao.maps.Marker({
            position: position,
            image: facilityMarkerImage,
            title: facility.name
        });
        marker.setMap(map);
        facilityMarkers.push(marker);
    });

    console.log("[DEBUG] 시설 마커 렌더링 완료:", facilityMarkers.length, "개");
}

// ========== 검색 결과 Sheet 초기화 ==========
function setupSearchResultsSheet() {
    searchResultsSheet = document.getElementById("search-results-sheet");
    const closeButton = document.getElementById("search-results-close");

    if (!searchResultsSheet) {
        console.warn("검색 결과 sheet를 찾을 수 없습니다");
        return;
    }

    // 닫기 버튼 이벤트
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            searchResultsSheet.classList.add("hidden");
        });
    }

    console.log("[DEBUG] 검색 결과 sheet 초기화 완료");
}

// ========== 검색 결과 렌더링 ==========
function renderSearchResults() {
    const listContainer = document.getElementById("search-results-list");
    if (!listContainer) return;

    // 기존 내용 제거
    listContainer.innerHTML = "";

    // 검색 결과가 없으면
    if (searchResults.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">검색 결과가 없습니다.</div>';
        return;
    }

    // 각 검색 결과를 아이템으로 추가
    searchResults.forEach(place => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.setAttribute("data-lat", place.y);
        item.setAttribute("data-lng", place.x);

        const name = document.createElement("div");
        name.className = "result-name";
        name.textContent = place.place_name;

        const address = document.createElement("div");
        address.className = "result-address";
        address.textContent = place.road_address_name || place.address_name || "주소 정보 없음";

        item.appendChild(name);
        item.appendChild(address);

        // 클릭 이벤트
        item.addEventListener("click", () => {
            handleSearchResultClick(place.y, place.x, place.place_name);
        });

        listContainer.appendChild(item);
    });

    console.log("[DEBUG] 검색 결과 렌더링 완료:", searchResults.length, "개");
}

// ========== 검색 결과 아이템 클릭 핸들러 ==========
function handleSearchResultClick(lat, lng, placeName) {
    const newPos = new kakao.maps.LatLng(lat, lng);

    // 지도 중심 이동
    map.setCenter(newPos);
    map.setLevel(3); // 약간 줌인

    // 기존 검색 마커 제거
    if (searchMarker) {
        searchMarker.setMap(null);
    }

    // 새 검색 마커 생성
    searchMarker = new kakao.maps.Marker({
        position: newPos
    });
    searchMarker.setMap(map);

    // 검색 결과 sheet 닫기
    if (searchResultsSheet) {
        searchResultsSheet.classList.add("hidden");
    }

    // 상태 메시지 표시
    showStatusMessage(`"${placeName}" 근처로 이동했어요.`);
    console.log("[DEBUG] 검색 결과 선택:", placeName);

    // 3초 후 상태 메시지 숨김
    setTimeout(() => {
        hideStatusMessage();
    }, 3000);
}
