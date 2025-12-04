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
let userPosition = null; // 사용자 현재 위치 { lat, lng }
let searchCenter = null; // 검색으로 선택한 위치 (LatLng 객체)

// ========== 검색 결과 관리 ==========
let searchResults = [];
let searchResultsSheet;

// ========== 필터 관리 ==========
let activeFilters = new Set();
let selectedRadius = 2; // 기본 2km

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

// ========== 페이지 전환 유틸리티 (스크롤 리셋 포함) ==========
function showPage(page) {
    const pages = [onboardingPage, loadingPage, appPage];
    pages.forEach(p => {
        if (!p) return;
        p.classList.add("hidden");
        p.scrollTop = 0;
    });

    // 브라우저 전체 스크롤도 항상 맨 위로
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    if (page) {
        page.classList.remove("hidden");
    }

    console.log("[DEBUG] Page transition:", page ? page.id : "none");
}

// ========== 시작 버튼 클릭 핸들러 ==========
function handleStart() {
    console.log("[DEBUG] handleStart called");
    console.log("시작 버튼 클릭됨 - 로딩 페이지로 전환");

    // 1) 온보딩 → 로딩 전환 + 스크롤 리셋
    showPage(loadingPage);

    // 2) 즉시 위치 권한 요청 (버튼 클릭 체인 안에서)
    requestCurrentPosition();
}

// ========== Geolocation 요청 함수 ==========
function requestCurrentPosition() {
    console.log("Geolocation 요청 시작");

    if (!navigator.geolocation) {
        console.warn("Geolocation not supported");
        initMapWithFallback();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // 성공 콜백
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log("위치 정보 획득 성공:", latitude, longitude);
            initMapWithPosition(latitude, longitude);
        },
        // 실패 콜백
        (error) => {
            console.error("Geolocation error:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);

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

            // Fallback 지도 초기화
            initMapWithFallback();

            // 상단 alert 배너 표시 (3초)
            setTimeout(() => {
                showTopAlert("현재 위치를 알 수 없어요. 우측 하단의 '현재 위치' 버튼을 눌러서 다시 조회해 주세요.", 3000);
            }, 500);
        },
        // 옵션
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ========== 지도 초기화 (사용자 위치 기준) ==========
function initMapWithPosition(lat, lng) {
    console.log("지도 초기화 시작 (사용자 위치):", lat, lng);

    // 사용자 위치 저장 (거리 계산용)
    userPosition = { lat, lng };

    // Kakao 지도 SDK 로드 및 초기화
    kakao.maps.load(function () {
        console.log("카카오맵 SDK 로드 완료");

        // 마커 아이콘 생성
        userMarkerImage = new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
            new kakao.maps.Size(32, 36),
            { offset: new kakao.maps.Point(16, 36) }
        );

        facilityMarkerImage = new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            new kakao.maps.Size(24, 35),
            { offset: new kakao.maps.Point(12, 35) }
        );

        // Places 서비스 초기화
        placesService = new kakao.maps.services.Places();

        // 지도 생성
        const container = document.getElementById("map");
        const center = new kakao.maps.LatLng(lat, lng);
        const options = { center, level: 4 };

        map = new kakao.maps.Map(container, options);
        console.log("지도 생성 완료 (사용자 위치)");

        // 현재 위치 마커 생성
        currentMarker = new kakao.maps.Marker({
            position: center,
            image: userMarkerImage
        });
        currentMarker.setMap(map);
        console.log("현재 위치 마커 생성 완료");

        // UI 초기화
        setupSearch();
        setupDrawerUI();
        setupRadiusChips();
        setupFilterChips();
        setupFacilityButtons();
        setupSearchResultsSheet();
        initializeFacilities();

        // 로딩 → 메인 전환 + 스크롤 맨 위
        showPage(appPage);

        // 지도 레이아웃 재계산
        setTimeout(() => {
            map.relayout();
            map.setCenter(center);
            console.log("지도 레이아웃 재계산 완료");
        }, 100);

        showStatusMessage("현재 위치 기준으로 지도를 보여드리고 있어요.");
        setTimeout(() => hideStatusMessage(), 3000);

        // 추천 카드 자동 숨김 타이머 시작
        startRecommendHideTimer();
    });
}

// ========== 지도 초기화 (Fallback 좌표) ==========
function initMapWithFallback() {
    console.log("지도 초기화 시작 (fallback 좌표)");
    showStatusMessage("위치를 가져올 수 없어 기본 위치로 보여드릴게요.");
    initMapWithPosition(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
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

// ========== 상단 alert 배너 유틸리티 ==========
let topAlertTimeoutId = null;

function showTopAlert(message, durationMs = 3000) {
    const el = document.getElementById("top-alert");
    const msgEl = document.getElementById("top-alert-message");
    if (!el || !msgEl) return;

    msgEl.textContent = message;
    el.classList.remove("hidden");

    if (topAlertTimeoutId) {
        clearTimeout(topAlertTimeoutId);
    }
    topAlertTimeoutId = setTimeout(() => {
        el.classList.add("hidden");
    }, durationMs);
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
    map.setLevel(4); // 기본 줌 레벨로 복귀

    // 검색 마커 제거
    if (searchMarker) {
        searchMarker.setMap(null);
        searchMarker = null;
    }

    // searchCenter 초기화 (현재 위치 기준으로 재설정)
    searchCenter = null;

    // 현재 위치 기준으로 시설 재조회
    // selectedRadius가 null이면 10km 기본값 사용
    const radius = (selectedRadius !== null ? selectedRadius : 10) * 1000; // km → m
    fetchNearbyFacilities(markerPosition, radius);

    showStatusMessage("내 위치 기준으로 시설을 다시 불러왔어요.");
    setTimeout(() => hideStatusMessage(), 3000);

    console.log("지도 중심을 마커 위치로 이동하고 시설 재조회 완료");
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

// ========== Map Layout 업데이트 함수 ==========
function updateMapLayout() {
    if (!map) return;
    const center = map.getCenter();
    map.relayout();
    map.setCenter(center);
}

// ========== Drawer 축소 함수 ==========
function collapseDrawer() {
    if (!drawer) {
        drawer = document.getElementById("drawer");
    }
    if (!drawer || !drawerMinHeight) return;

    drawer.style.transition = "height 0.3s ease-out";
    drawer.style.height = drawerMinHeight + "px";
    drawer.classList.remove("expanded");
    drawer.classList.add("collapsed");

    // 맵 레이아웃 보정
    setTimeout(() => {
        updateMapLayout();
    }, 300);
}

// ========== Drawer 확장 함수 ==========
function expandDrawer() {
    if (!drawer) {
        drawer = document.getElementById("drawer");
    }
    if (!drawer || !drawerMaxHeight) return;

    drawer.style.transition = "height 0.3s ease-out";
    drawer.style.height = drawerMaxHeight + "px";
    drawer.classList.remove("collapsed");
    drawer.classList.add("expanded");

    // 맵 레이아웃 보정
    setTimeout(() => {
        updateMapLayout();
    }, 300);
}

// ========== Drawer 토글 함수 ==========
function toggleDrawer() {
    if (!drawer) {
        drawer = document.getElementById("drawer");
    }
    if (!drawer) return;

    const isExpanded = drawer.classList.contains("expanded");

    if (isExpanded) {
        collapseDrawer();
    } else {
        expandDrawer();
    }
}

// ========== 거리 계산 함수 (Haversine formula, 미터 단위) ==========
function computeDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 지구 반지름 (m)
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

// ========== 거리 계산 기준 좌표 가져오기 ==========
function getDistanceBase() {
    // 우선순위: 검색 위치 > 사용자 위치 > 지도 중심
    if (searchCenter) {
        return { lat: searchCenter.getLat(), lng: searchCenter.getLng() };
    }
    if (userPosition) {
        return userPosition;
    }
    if (map) {
        const center = map.getCenter();
        return { lat: center.getLat(), lng: center.getLng() };
    }
    return null;
}

// ========== 시설 리스트를 거리순으로 정렬 ==========
function sortFacilitiesByDistance(list) {
    if (!list || list.length === 0) return [];

    const base = getDistanceBase();
    if (!base) return list;

    return list
        .map((f) => {
            let d = f.distance;
            // distance가 없으면 기준 좌표로 계산
            if (d == null || d === undefined) {
                d = computeDistanceMeters(base.lat, base.lng, f.lat, f.lng);
            }
            // distance를 시설 객체에 업데이트
            return { ...f, distance: Number(d) || 99999999 };
        })
        .sort((a, b) => a.distance - b.distance);
}

// ========== Drawer UI 드래그 가능 Bottom Sheet ==========
function setupDrawerUI() {
    drawer = document.getElementById("drawer");
    const drawerTop = document.getElementById("drawer-top");
    const facilityList = document.getElementById("facility-list");

    if (!drawer || !drawerTop) return;

    const vh = document.documentElement.clientHeight; // 모바일에서도 안정적
    drawerMinHeight = vh * 0.30; // 30vh
    drawerMaxHeight = vh * 0.80; // 80vh

    drawer.style.height = drawerMinHeight + "px";

    function getClientY(e) {
        if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
        return e.clientY;
    }

    function onDragStart(e) {
        isDragging = true;
        startY = getClientY(e);
        startHeight = drawer.offsetHeight;
        drawer.style.transition = "none";
        e.preventDefault();
    }

    function onDragMove(e) {
        if (!isDragging) return;
        const currentY = getClientY(e);
        const deltaY = startY - currentY; // 위로 드래그 = 양수
        let newHeight = startHeight + deltaY;
        if (newHeight < drawerMinHeight) newHeight = drawerMinHeight;
        if (newHeight > drawerMaxHeight) newHeight = drawerMaxHeight;
        drawer.style.height = newHeight + "px";
        updateMapLayout(); // 드래그 중 지도 레이아웃 업데이트
        e.preventDefault();
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        drawer.style.transition = "height 0.3s ease-out";
        const currentHeight = drawer.offsetHeight;
        const middle = (drawerMinHeight + drawerMaxHeight) / 2;

        if (currentHeight < middle) {
            drawer.style.height = drawerMinHeight + "px";
            drawer.classList.remove("expanded");
            drawer.classList.add("collapsed");
        } else {
            drawer.style.height = drawerMaxHeight + "px";
            drawer.classList.remove("collapsed");
            drawer.classList.add("expanded");
        }

        updateMapLayout(); // 드래그 종료 후 지도 레이아웃 업데이트
    }

    // drawer-grab-area에서만 드래그 시작 (필터/반경 칩과 충돌 방지)
    const grabArea = document.getElementById("drawer-grab-area");
    const drawerHandle = document.getElementById("drawer-handle");
    if (!grabArea) return;

    // 화살표 아이콘 클릭 시 토글
    if (drawerHandle) {
        drawerHandle.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDrawer();
        });
    }

    // 마우스 이벤트 - grab-area에서만 드래그 시작
    grabArea.addEventListener("mousedown", onDragStart);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);

    // 터치 이벤트 (passive:false로 등록) - grab-area에서만 드래그 시작
    grabArea.addEventListener("touchstart", onDragStart, { passive: false });
    window.addEventListener("touchmove", onDragMove, { passive: false });
    window.addEventListener("touchend", onDragEnd);

    if (facilityList) {
        // 리스트 내부에서는 스크롤만 되게 드래그 시작 막기
        facilityList.addEventListener("touchstart", (e) => e.stopPropagation());
        facilityList.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    // 필터 칩 영역에서도 드래그 막기 (스크롤 가능하게)
    const drawerFilters = document.getElementById("drawer-filters");
    if (drawerFilters) {
        drawerFilters.addEventListener("touchstart", (e) => e.stopPropagation());
        drawerFilters.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    // 반경 칩 영역에서도 드래그 막기
    const radiusChipsContainer = document.querySelector(".radius-chips");
    if (radiusChipsContainer) {
        radiusChipsContainer.addEventListener("touchstart", (e) => e.stopPropagation());
        radiusChipsContainer.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    console.log("[DEBUG] Drawer UI 드래그 기능 초기화 완료");
}

// ========== 반경 칩 UI ==========
function setupRadiusChips() {
    const radiusChips = document.querySelectorAll(".radius-chip");

    radiusChips.forEach(chip => {
        const handleRadiusChange = () => {
            const radius = parseInt(chip.getAttribute("data-radius"));
            const isCurrentlyActive = chip.classList.contains("active");

            if (isCurrentlyActive) {
                // 이미 선택된 칩을 다시 클릭 → 거리 제한 해제
                chip.classList.remove("active");
                selectedRadius = null;
                showStatusMessage("거리 제한 없이 모든 시설을 보고 있어요.");
                console.log("반경 필터 해제 (전체 보기)");
            } else {
                // 다른 칩 클릭 → 해당 반경으로 변경
                radiusChips.forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                selectedRadius = radius;
                showStatusMessage(`반경 ${radius}km 내 시설을 보고 있어요.`);
                console.log("반경 칩 클릭:", radius + "km");
            }

            // 필터 재적용
            applyFilters();

            // 3초 후 상태바 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        };

        // 클릭 이벤트 (PC)
        chip.addEventListener("click", handleRadiusChange);

        // 터치 이벤트 (모바일)
        chip.addEventListener("touchend", (e) => {
            e.preventDefault();
            handleRadiusChange();
        }, { passive: false });
    });

    console.log("[DEBUG] 반경 칩 UI 초기화 완료");
}

// ========== 필터 칩 UI ==========
function setupFilterChips() {
    const filterChips = document.querySelectorAll("#drawer-filters .filter-chip");
    console.log("[DEBUG] 필터 칩 개수:", filterChips.length);

    filterChips.forEach((chip, index) => {
        const handleFilterToggle = () => {
            console.log(`[DEBUG] 필터 칩 클릭 이벤트 발생 (chip ${index}):`, chip.textContent);

            // active 토글
            chip.classList.toggle("active");

            const filter = chip.getAttribute("data-filter");
            const isActive = chip.classList.contains("active");

            console.log(`[DEBUG] 필터: ${filter}, 상태: ${isActive ? "활성화" : "비활성화"}`);
            console.log(`[DEBUG] activeFilters before:`, Array.from(activeFilters));

            if (isActive) {
                activeFilters.add(filter);
                showStatusMessage(`"${chip.textContent}" 필터를 적용했어요.`);
            } else {
                activeFilters.delete(filter);
                showStatusMessage(`"${chip.textContent}" 필터를 해제했어요.`);
            }

            console.log(`[DEBUG] activeFilters after:`, Array.from(activeFilters));
            console.log(`[DEBUG] applyFilters() 호출 시작`);

            // 필터 재적용
            applyFilters();

            console.log(`[DEBUG] applyFilters() 호출 완료`);

            // 3초 후 상태바 숨김
            setTimeout(() => {
                hideStatusMessage();
            }, 3000);
        };

        // 클릭 이벤트 (PC)
        chip.addEventListener("click", handleFilterToggle);

        // 터치 이벤트 (모바일) - 중복 실행 방지
        chip.addEventListener("touchend", (e) => {
            e.preventDefault();
            handleFilterToggle();
        }, { passive: false });
    });

    console.log("[DEBUG] 필터 칩 UI 초기화 완료, 이벤트 리스너 등록됨");
}

// ========== 시설 카드 버튼 UI (이벤트 위임 방식) ==========
function setupFacilityButtons() {
    const facilityList = document.getElementById("facility-list");
    if (!facilityList) return;

    facilityList.addEventListener("click", (e) => {
        const card = e.target.closest(".facility-card");
        if (!card) return;

        const facilityId = card.dataset.facilityId;
        const facility = visibleFacilities.find(f => f.id.toString() === facilityId);
        if (!facility) return;

        if (e.target.classList.contains("facility-map-button")) {
            // 지도에서 보기
            const pos = new kakao.maps.LatLng(facility.lat, facility.lng);
            map.setCenter(pos);
            map.setLevel(3); // 줌인
            highlightFacilityCard(facility.id);
            showStatusMessage(`"${facility.name}"를 지도에서 보여드릴게요.`);

            // Drawer를 축소 상태로 내려줌
            collapseDrawer();

            setTimeout(() => {
                hideStatusMessage();
            }, 2000);
        } else if (e.target.classList.contains("facility-nav-button")) {
            // 길찾기 (카카오맵 열기)
            if (facility.url) {
                window.open(facility.url, "_blank");
            } else {
                showStatusMessage("길찾기 정보를 찾을 수 없어요.");
            }
        }
    });

    console.log("[DEBUG] 시설 카드 버튼 UI 초기화 완료 (이벤트 위임)");
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
    // 현재 지도 중심 기준으로 운동시설 검색
    if (!map || !currentMarker) {
        console.warn("[DEBUG] 지도 또는 마커가 준비되지 않음");
        return;
    }

    const centerLatLng = currentMarker.getPosition();
    fetchNearbyFacilities(centerLatLng, selectedRadius * 1000); // km → m
}

// ========== 현재 위치 기준 운동시설 검색 (Kakao Places API) ==========
function fetchNearbyFacilities(centerLatLng, radiusMeters) {
    if (!placesService) {
        console.error("[DEBUG] Places 서비스가 초기화되지 않음");
        return;
    }

    const radius = radiusMeters || 2000; // 기본 2km
    const keywords = ["체육관", "헬스장", "요가", "필라테스", "수영장", "공원", "운동", "피트니스", "산책로", "배드민턴", "테니스"];

    facilities = [];
    let completed = 0;

    console.log("[DEBUG] 시설 검색 시작:", keywords.length, "개 키워드");

    keywords.forEach((keyword) => {
        const options = {
            location: centerLatLng,
            radius: radius,
            page: 1,
            size: 15  // 키워드당 최대 15개
        };

        placesService.keywordSearch(keyword, (results, status) => {
            completed += 1;

            if (status === kakao.maps.services.Status.OK) {
                results.forEach((place) => {
                    const id = place.id;
                    // 중복 제거
                    if (!facilities.find((f) => f.id === id)) {
                        facilities.push({
                            id,
                            name: place.place_name,
                            lat: parseFloat(place.y),
                            lng: parseFloat(place.x),
                            address: place.road_address_name || place.address_name,
                            url: place.place_url,
                            distance: place.distance ? parseInt(place.distance, 10) : null,
                            category: place.category_name,
                            // 무료 시설 판단: 공원, 산책로, 길, 코스 등
                            isFree: keyword.includes("공원") || keyword.includes("산책로") || place.place_name.includes("공원") || place.place_name.includes("길") || place.place_name.includes("코스") || place.place_name.includes("산책") || place.category_name.includes("공원"),
                            isIndoor: keyword.includes("실내") || keyword.includes("체육관") || keyword.includes("헬스") || keyword.includes("요가") || keyword.includes("필라테스") || keyword.includes("수영장") || keyword.includes("피트니스"),
                            isCourse: keyword.includes("공원") || keyword.includes("산책로") || place.place_name.includes("길") || place.place_name.includes("코스") || place.place_name.includes("산책"),
                            isOpenNow: true,
                            isOutdoor: keyword.includes("공원") || keyword.includes("야외") || keyword.includes("산책로")
                        });
                    }
                });
            }

            // 모든 키워드 검색 완료
            if (completed === keywords.length) {
                console.log("[DEBUG] 시설 검색 완료:", facilities.length, "개 발견");
                applyFilters(); // 필터 적용 및 UI 업데이트
            }
        }, options);
    });
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

        // 마커 클릭 이벤트: 해당 카드 강조
        kakao.maps.event.addListener(marker, "click", () => {
            highlightFacilityCard(facility.id);
            map.setCenter(position);
            map.setLevel(3); // 줌인
            showStatusMessage(`"${facility.name}"를 선택했어요.`);
            setTimeout(() => hideStatusMessage(), 2000);
        });

        facilityMarkers.push(marker);
    });

    console.log("[DEBUG] 시설 마커 렌더링 완료:", facilityMarkers.length, "개");
}

// ========== 시설 리스트 렌더링 ==========
function renderFacilityList(facilitiesToShow) {
    const listEl = document.getElementById("facility-list");
    const countEl = document.getElementById("facility-count");
    const emptyEl = document.getElementById("facility-empty");
    if (!listEl || !countEl) return;

    // 기존 내용 제거
    listEl.innerHTML = "";

    // 시설이 없으면
    if (facilitiesToShow.length === 0) {
        if (emptyEl) {
            emptyEl.textContent = "내 주변에 표시할 운동시설이 없습니다.";
            emptyEl.classList.remove("hidden");
        }
        countEl.textContent = "0곳";
        return;
    }

    // 시설이 있으면 empty 메시지 숨김
    if (emptyEl) {
        emptyEl.classList.add("hidden");
    }

    // 각 시설을 카드로 추가
    facilitiesToShow.forEach((f) => {
        const card = document.createElement("div");
        card.className = "facility-card";
        card.dataset.facilityId = f.id;

        // 거리 표시 포맷
        const distanceText = f.distance >= 1000 ? `${(f.distance / 1000).toFixed(1)}km` : `${f.distance}m`;

        // 카테고리 표시
        let categoryText = "";
        if (f.isCourse) categoryText = "걷기코스";
        else if (f.isIndoor) categoryText = "실내";
        else categoryText = "실외";
        categoryText += f.isFree ? " · 무료" : " · 유료";

        card.innerHTML = `
            <div class="facility-main">
                <div class="facility-name">${f.name}</div>
                <div class="facility-meta">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="distance">${distanceText}</span>
                        <span class="category">${categoryText}</span>
                    </div>
                    ${f.address ? `<div class="facility-address">${f.address}</div>` : ""}
                    ${f.rating ? `<div class="facility-rating">⭐ ${f.rating}</div>` : ""}
                </div>
            </div>
            <div class="facility-actions">
                <button class="facility-map-button">지도에서 보기</button>
                <button class="facility-nav-button">길찾기</button>
            </div>
        `;

        listEl.appendChild(card);
    });

    console.log("[DEBUG] 시설 리스트 렌더링 완료:", facilitiesToShow.length, "개");
}

// ========== 시설 카드 강조 ==========
function highlightFacilityCard(facilityId) {
    const allCards = document.querySelectorAll(".facility-card");
    allCards.forEach(card => card.classList.remove("active"));

    const targetCard = document.querySelector(`.facility-card[data-facility-id="${facilityId}"]`);
    if (targetCard) {
        targetCard.classList.add("active");
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log("[DEBUG] 시설 카드 강조:", facilityId);
    }
}

// ========== 필터 적용 ==========
function applyFilters() {
    console.log(`[DEBUG] applyFilters() 실행 시작 - activeFilters:`, Array.from(activeFilters), `selectedRadius: ${selectedRadius}km`);

    // 거리 계산 기준점 가져오기 (검색 위치 > 사용자 위치 > 지도 중심)
    const basePos = getDistanceBase();
    if (!basePos) {
        console.warn("[DEBUG] 거리 계산 기준점이 없어 필터를 적용할 수 없습니다.");
        return;
    }

    console.log(`[DEBUG] 거리 기준점:`, basePos, `/ 전체 시설 수: ${facilities.length}`);

    // 거리 계산 함수 (Haversine formula, km 단위)
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // 지구 반지름 (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // 필터 적용
    visibleFacilities = facilities.filter((f) => {
        // 1. 반경 필터 (selectedRadius가 null이면 거리 제한 없음)
        if (selectedRadius !== null) {
            const distanceKm = calculateDistance(basePos.lat, basePos.lng, f.lat, f.lng);
            if (distanceKm > selectedRadius) {
                return false;
            }
        }

        // 2. 속성 필터 - activeFilters가 비어있으면 모두 통과
        if (activeFilters.size === 0) return true;

        // activeFilters 중 하나라도 만족하면 통과 (OR 조건)
        for (const filter of activeFilters) {
            if (filter === "free" && f.isFree) return true;
            if (filter === "indoor" && f.isIndoor) return true;
            if (filter === "outdoor" && !f.isIndoor && !f.isCourse) return true;
            if (filter === "course" && f.isCourse) return true;
            if (filter === "open_now" && f.isOpenNow) return true;
        }

        return false; // 어떤 필터도 만족하지 못하면 제외
    });

    // 거리순으로 정렬 (가까운 순)
    visibleFacilities = sortFacilitiesByDistance(visibleFacilities);

    console.log(`[DEBUG] 필터링 후 시설 수: ${visibleFacilities.length}`);

    // UI 업데이트
    console.log(`[DEBUG] renderFacilityList() 호출`);
    renderFacilityList(visibleFacilities);

    console.log(`[DEBUG] renderFacilityMarkers() 호출`);
    renderFacilityMarkers(visibleFacilities);

    console.log(`[DEBUG] updateFacilityCount() 호출`);
    updateFacilityCount(visibleFacilities.length);

    console.log("[DEBUG] 필터 적용 완료:", visibleFacilities.length, "/", facilities.length, "개 표시");
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

    // 검색 기준 좌표 저장
    searchCenter = newPos;

    // 선택한 장소를 기준으로 반경 내 시설 재조회
    // selectedRadius가 null이면 10km 기본값 사용
    const radius = (selectedRadius !== null ? selectedRadius : 10) * 1000; // km → m
    fetchNearbyFacilities(newPos, radius);

    // 상태 메시지 표시
    showStatusMessage(`"${placeName}" 근처 시설을 검색중이에요.`);
    console.log("[DEBUG] 검색 결과 선택:", placeName, "- 시설 재조회");

    // 3초 후 상태 메시지 숨김
    setTimeout(() => {
        hideStatusMessage();
    }, 3000);
}
