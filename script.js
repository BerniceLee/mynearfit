// ========== 전역 변수 ==========
let map;

// ========== 페이지 로드 시 초기화 ==========
window.addEventListener('load', () => {
    // 로딩 화면 표시
    showLoadingScreen();

    // 현재 위치 권한 요청
    requestUserLocation();
});

// ========== 현재 위치 권한 요청 ==========
function requestUserLocation() {
    // Geolocation API 지원 여부 확인
    if (!navigator.geolocation) {
        console.warn('이 브라우저는 위치 서비스를 지원하지 않습니다.');
        alert('이 브라우저는 위치 서비스를 지원하지 않습니다.\n기본 위치(서울)로 지도를 표시합니다.');
        // Fallback: 서울 시청 좌표 사용
        initMap(37.5665, 126.9780);
        return;
    }

    // 위치 정보 요청
    navigator.geolocation.getCurrentPosition(
        // 성공 콜백
        (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            console.log('현재 위치:', latitude, longitude);

            // 현재 위치로 지도 초기화
            initMap(latitude, longitude);
        },
        // 실패 콜백
        (error) => {
            console.error('위치 권한 오류:', error);

            let errorMessage = '위치 정보를 가져올 수 없습니다.\n';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += '위치 권한이 거부되었습니다.\n기본 위치(서울)로 지도를 표시합니다.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += '위치 정보를 사용할 수 없습니다.\n기본 위치(서울)로 지도를 표시합니다.';
                    break;
                case error.TIMEOUT:
                    errorMessage += '위치 정보 요청 시간이 초과되었습니다.\n기본 위치(서울)로 지도를 표시합니다.';
                    break;
                default:
                    errorMessage += '알 수 없는 오류가 발생했습니다.\n기본 위치(서울)로 지도를 표시합니다.';
            }

            alert(errorMessage);

            // Fallback: 서울 시청 좌표 사용
            initMap(37.5665, 126.9780);
        },
        // 옵션
        {
            enableHighAccuracy: true, // 높은 정확도 요청 (GPS 사용)
            timeout: 10000, // 10초 타임아웃
            maximumAge: 0 // 캐시된 위치 사용 안 함
        }
    );
}

// ========== 카카오맵 초기화 ==========
function initMap(latitude, longitude) {
    // 카카오맵 SDK 로드 (autoload=false 옵션 사용)
    kakao.maps.load(() => {
        const container = document.getElementById('map');
        const options = {
            center: new kakao.maps.LatLng(latitude, longitude),
            level: 4 // 확대 레벨 (1~14, 숫자가 작을수록 확대)
        };

        // 지도 생성
        map = new kakao.maps.Map(container, options);

        // 현재 위치 마커 표시
        const markerPosition = new kakao.maps.LatLng(latitude, longitude);
        new kakao.maps.Marker({
            position: markerPosition,
            map: map
        });

        console.log('맵 초기화 완료:', latitude, longitude);

        // 지도 로딩 완료 후 로딩 화면 숨기고 메인 앱 표시
        hideLoadingScreen();
        showMainApp();
    });
}

// ========== UI 제어 함수 ==========

/**
 * 로딩 화면 표시
 */
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}

/**
 * 로딩 화면 숨김
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

/**
 * 메인 앱 화면 표시
 */
function showMainApp() {
    const app = document.getElementById('app');
    if (app) {
        app.classList.remove('hidden');
    }
}

// ========== 반응형 대응 (화면 회전 시 지도 리사이즈) ==========
window.addEventListener('resize', () => {
    if (map) {
        // 지도 리사이즈 (모바일 가로/세로 회전 대응)
        map.relayout();
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
        alert('주변 시설 정보를 불러오는데 실패했습니다.');
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
