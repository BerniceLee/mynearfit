// ========== 전역 변수 ==========
let map;

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
    // 카카오맵 SDK 로드 (autoload=false 옵션 사용)
    kakao.maps.load(() => {
        initializeMap();
    });
});

/**
 * 카카오맵 초기화
 * 테스트용으로 서울 시청 좌표 사용
 */
function initializeMap() {
    // 서울 시청 좌표 (테스트용)
    const seoulCityHall = {
        lat: 37.5665,
        lng: 126.9780
    };

    const container = document.getElementById('map');
    const options = {
        center: new kakao.maps.LatLng(seoulCityHall.lat, seoulCityHall.lng),
        level: 4 // 확대 레벨 (1~14, 숫자가 작을수록 확대)
    };

    // 지도 생성
    map = new kakao.maps.Map(container, options);

    // 서울 시청 위치 마커 표시
    const markerPosition = new kakao.maps.LatLng(seoulCityHall.lat, seoulCityHall.lng);
    new kakao.maps.Marker({
        position: markerPosition,
        map: map
    });

    console.log('맵 초기화 완료: 서울 시청 좌표');

    // TODO: 실제 사용자 위치 기반으로 변경하려면 requestUserLocation() 활성화
}

// ========== TODO: 향후 구현 함수들 ==========

/**
 * 사용자 위치 권한 요청 및 좌표 획득 (현재 미사용)
 * 실제 위치 기반 서비스를 위해 나중에 활성화
 */
/*
function requestUserLocation() {
    if (!navigator.geolocation) {
        alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            console.log('사용자 위치:', userLocation);

            // 지도 중심을 사용자 위치로 이동
            const moveLatLon = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
            map.setCenter(moveLatLon);

            // 사용자 위치 마커 추가
            new kakao.maps.Marker({
                position: moveLatLon,
                map: map
            });
        },
        (error) => {
            console.error('위치 권한 오류:', error);
            alert('위치 정보를 가져올 수 없습니다.');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}
*/

/**
 * 주변 시설 데이터 가져오기
 * TODO: 실제 API 엔드포인트 연결 필요
 */
/*
async function fetchData(location) {
    try {
        const response = await fetch(`/api/facilities?lat=${location.lat}&lng=${location.lng}`);
        const data = await response.json();
        displayFacilities(data);
    } catch (error) {
        console.error('데이터 로딩 실패:', error);
        alert('주변 시설 정보를 불러오는데 실패했습니다.');
    }
}
*/

/**
 * 시설 정보를 맵에 마커로 표시
 * TODO: 시설 데이터 배열을 받아서 마커 생성
 */
/*
function displayFacilities(facilities) {
    facilities.forEach(facility => {
        const position = new kakao.maps.LatLng(facility.lat, facility.lng);
        const marker = new kakao.maps.Marker({
            position: position,
            map: map
        });

        kakao.maps.event.addListener(marker, 'click', () => {
            showFacilityInfo(facility);
        });
    });
}
*/

/**
 * 시설 상세 정보 표시
 * TODO: 인포윈도우 또는 사이드 패널 구현
 */
/*
function showFacilityInfo(facility) {
    const content = `
        <div style="padding:5px;">
            <h3>${facility.name}</h3>
            <p>${facility.address}</p>
        </div>
    `;

    const infowindow = new kakao.maps.InfoWindow({
        content: content
    });

    infowindow.open(map, marker);
}
*/

// TODO: 추가 기능
// - 검색 기능
// - 필터링 (시설 종류별)
// - 경로 안내
// - 즐겨찾기
// - 리스트 뷰 / 맵 뷰 전환
