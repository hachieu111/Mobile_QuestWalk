import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing, Modal, TextInput, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, addDoc, doc, setDoc, query, where, increment, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';

// Hàm tính khoảng cách giữa 2 tọa độ (Haversine Formula)
const getDistance = (coords1, coords2) => {
  if (!coords1 || !coords2) return Infinity;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3; 
  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);
  const lat1 = toRad(coords1.latitude);
  const lat2 = toRad(coords2.latitude);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const POI_CATEGORIES = [
  {
    titles: ["Highlands Coffee", "The Coffee House", "Cộng Cà Phê", "Phúc Long Tea", "Aha Coffee", "Katinat Corner", "Tiệm Trà Chiều"],
    descriptions: [
      "Hương thơm cà phê rang xay lan tỏa khắp không gian. Check-in tại đây để nhận Xu thưởng và tận hưởng một buổi chiều cực chill!",
      "Điểm hẹn lý tưởng để nạp caffeine tỉnh táo. Hãy bước tới và check-in ngay để nhận Xu thưởng từ QuestWalk!"
    ],
    badgeReward: "Coffee_Lover",
    badgeName: "Thần Cà Phê"
  },
  {
    titles: ["Công viên Thống Nhất", "Công viên Nghĩa Đô", "Công viên Cầu Giấy", "Hồ Tây Windy Park", "Công viên Hòa Bình", "Khu Phố Đi Bộ"],
    descriptions: [
      "Hít thở bầu không khí trong lành dưới những tán cây xanh mát. Hãy check-in tại đây để nhận Huy hiệu đại sứ môi trường và Xu tích lũy nhé!",
      "Địa điểm dạo bộ tuyệt vời tràn ngập gió trời trong lành. Cùng QuestWalk check-in nạp đầy năng lượng xanh cho cơ thể nào!"
    ],
    badgeReward: "Park_Explorer",
    badgeName: "Đại Sứ Môi Trường"
  },
  {
    titles: ["Phở Thìn Lò Đúc", "Bún Chả Hương Liên", "Bánh Mì Dân Tổ", "Nhà hàng Sen Tây Hồ", "Tiệm Bún Đậu Mắm Tôm", "Quán Lẩu Cua Đồng"],
    descriptions: [
      "Hương vị tinh túy ẩm thực Việt Nam đậm đà thơm nức lòng. Check-in ngay để gia nhập câu lạc bộ thợ săn mỹ vị ẩm thực thành phố!",
      "Nạp năng lượng tuyệt vời sau chặng đường dài đi bộ bằng món ngon truyền thống. Check-in nhận Xu thưởng cực khủng!"
    ],
    badgeReward: "Gourmet_Hunter",
    badgeName: "Thợ Săn Mỹ Vị"
  },
  {
    titles: ["California Fitness", "Elite Active Gym", "Sân vận động Mỹ Đình", "CLB Cầu lông Ngôi Sao", "Phòng Gym Fitness Zone", "Sân Bóng Đá Mini"],
    descriptions: [
      "Nơi bùng nổ mồ hôi và năng lượng bứt phá giới hạn bản thân. Hãy bước vào check-in ngay để nhận chứng nhận ý chí thép Warrior!",
      "Không có gì tốt hơn việc rèn luyện sức khỏe bền bỉ mỗi ngày. Check-in tại đây để nhận Xu thưởng thể thao năng động!"
    ],
    badgeReward: "Fit_Warrior",
    badgeName: "Chiến Binh Thép"
  },
  {
    titles: ["Nhà hát Lớn Hà Nội", "Hồ Gươm Tháp Rùa", "Bảo tàng Dân tộc học", "Văn Miếu Quốc Tử Giám", "Hoàng Thành Thăng Long", "Cầu Long Biên"],
    descriptions: [
      "Địa danh lịch sử văn hóa cổ kính mang đậm dấu ấn hào hùng của thời gian. Đến check-in mở khóa Huy hiệu di sản văn hóa đặc sắc!",
      "Chiêm ngưỡng kiến trúc lịch sử tuyệt mỹ giao hòa giữa lòng đô thị năng động. Check-in ngay để nhận Xu thưởng thám hiểm!"
    ],
    badgeReward: "Culture_Explorer",
    badgeName: "Nhà Thám Hiểm Di Sản"
  }
];

const MapScreen = ({ navigation, route }) => {
  const user = useQuestStore((state) => state.user);
  const coinBalance = useQuestStore((state) => state.coinBalance);
  const setCoinBalance = useQuestStore((state) => state.setCoinBalance);

  const [location, setLocation] = useState(null);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [completedQuestIds, setCompletedQuestIds] = useState([]);
  
  // Custom Quest states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customQuestTitle, setCustomQuestTitle] = useState('');
  const [customQuestCoins, setCustomQuestCoins] = useState('');
  const [customQuestVisibility, setCustomQuestVisibility] = useState('public'); // 'public' | 'friends'
  const [selectedTargetFriendId, setSelectedTargetFriendId] = useState(null);
  const [friendsMap, setFriendsMap] = useState({}); // Lưu map UID -> { id, avatarUrl, email }
  const [friendIds, setFriendIds] = useState([]); // Lưu danh sách UIDs bạn bè
  
  // Các state tìm kiếm & ghim tọa độ đặt rương
  const [selectedPlacementCoords, setSelectedPlacementCoords] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const mapRef = useRef(null);
  const pulseValue = useRef(new Animated.Value(0.8)).current;
  const fadeValue = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Hiệu ứng nhấp nháy (nhịp đập) thay vì nhảy lên xuống để không bị cắt viền trên Android
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          })
        ]),
        Animated.sequence([
          Animated.timing(fadeValue, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(fadeValue, {
            toValue: 0.6,
            duration: 600,
            useNativeDriver: true,
          })
        ])
      ])
    ).start();

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Không có quyền truy cập vị trí. Hãy cấp quyền để chơi chế độ Khám Phá!');
        setLoading(false);
        return;
      }

      let userLoc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (newLoc) => {
          setLocation((prev) => ({
            ...prev,
            latitude: newLoc.coords.latitude,
            longitude: newLoc.coords.longitude,
          }));
        }
      );

      fetchQuests();
    })();
  }, []); // Only run once on mount for animations and location setup

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        getDocs(collection(db, `users/${user.uid}/badges`))
          .then(snap => {
            const completedIds = [];
            snap.forEach(doc => completedIds.push(doc.id));
            setCompletedQuestIds(completedIds);
          })
          .catch(err => console.error(err));
      }
    }, [user])
  );

  useEffect(() => {
    if (route?.params?.focusLatitude && route?.params?.focusLongitude) {
      const { focusLatitude, focusLongitude, questId } = route.params;
      const newLoc = {
        latitude: focusLatitude,
        longitude: focusLongitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      };
      
      // Delay slightly to ensure map is loaded
      setTimeout(() => {
        mapRef.current?.animateToRegion(newLoc, 1000);
        if (questId) {
          const quest = quests.find(q => q.id === questId);
          if (quest) {
            setSelectedQuest(quest);
          }
        }
      }, 800);
    }
  }, [route?.params, quests]);

  const fetchQuests = async () => {
    try {
      const qSnap = await getDocs(collection(db, 'gps_quests'));
      let questList = [];
      if (qSnap.empty) {
        console.log('Tạo dữ liệu GPS Quests mẫu...');
        const sampleQuests = [
          {
            id: 'hdt',
            title: 'Khám phá Hồ Gươm',
            description: 'Check-in tại Tháp Rùa để nhận Huy hiệu Explorer và Xu!',
            latitude: 21.028511,
            longitude: 105.854165,
            radius: 200,
            coinReward: 100,
            badgeReward: 'HoGuom_Explorer',
            badgeName: 'Nhà thám hiểm Hồ Gươm'
          },
          {
            id: 'lq',
            title: 'Check-in Lăng Bác',
            description: 'Tham quan và check-in khu vực Quảng trường Ba Đình.',
            latitude: 21.036720,
            longitude: 105.834710,
            radius: 300,
            coinReward: 200,
            badgeReward: 'BaDinh_Explorer',
            badgeName: 'Thành viên yêu nước'
          }
        ];
        
        for (let q of sampleQuests) {
          await setDoc(doc(db, 'gps_quests', q.id), q);
        }
        questList = sampleQuests;
      } else {
        qSnap.forEach(doc => questList.push({ id: doc.id, ...doc.data() }));
      }

      if (user?.uid) {
        // Lấy danh sách badge
        const userBadgesSnap = await getDocs(collection(db, `users/${user.uid}/badges`));
        const completedIds = [];
        userBadgesSnap.forEach(doc => completedIds.push(doc.id));
        setCompletedQuestIds(completedIds);
        
        // Lấy danh sách bạn bè để lọc quest
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const fetchedFriendIds = userDocSnap.data()?.friendIds || [];
        setFriendIds(fetchedFriendIds);

        // Lấy thông tin bạn bè để lấy Avatar trên bản đồ
        const fMap = {};
        if (fetchedFriendIds.length > 0) {
          try {
            const qFriends = query(collection(db, 'users'), where('__name__', 'in', fetchedFriendIds.slice(0, 10)));
            const friendsSnap = await getDocs(qFriends);
            friendsSnap.forEach(doc => {
              const data = doc.data();
              fMap[doc.id] = {
                id: doc.id,
                avatarUrl: data.avatarUrl || '',
                email: data.email || ''
              };
            });
          } catch (err) {
            console.error("Lỗi fetch avatar bạn bè:", err);
          }
        }
        setFriendsMap(fMap);

        // Lọc quest dựa trên quyền riêng tư chuẩn hóa nghiêm ngặt
        questList = questList.filter(q => {
          // 1. Nếu là nhiệm vụ hệ thống (không có người tạo createdBy), mọi người đều thấy
          if (!q.createdBy) return true;
          
          // 2. Nếu là nhiệm vụ do chính User này tạo ra (radar/tự tạo), luôn thấy
          if (q.createdBy === user.uid) return true;

          // 3. Nhiệm vụ công khai (public) do người chơi khác tạo -> Ai cũng thấy
          if (q.visibility === 'public') return true;
          
          // 4. Nhiệm vụ chế độ bạn bè (friends) do BẠN BÈ tạo ra -> Chỉ bạn bè mới thấy
          if (q.visibility === 'friends' && fetchedFriendIds.includes(q.createdBy)) {
            return true;
          }
          
          // Mặc định: Ẩn tất cả nhiệm vụ riêng tư hoặc của người lạ khác
          return false;
        });
      }

      setQuests(questList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestPress = (quest) => {
    setSelectedQuest(quest);
    mapRef.current?.animateToRegion({
      latitude: quest.latitude,
      longitude: quest.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };

  const handleCheckIn = () => {
    if (!selectedQuest || !location) return;

    const dist = getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: selectedQuest.latitude, longitude: selectedQuest.longitude }
    );

    if (dist <= selectedQuest.radius) {
      navigation.navigate('ARCheckIn', { quest: selectedQuest });
    } else {
      Alert.alert(
        'Chưa đến nơi!',
        `Bạn đang cách mục tiêu ${Math.round(dist)} mét.\nHãy di chuyển vào phạm vi ${selectedQuest.radius} mét để check-in nhé!`
      );
    }
  };

  const handleTeleport = async () => {
    // Tìm nhiệm vụ chưa hoàn thành
    const uncompleted = quests.filter(q => !completedQuestIds.includes(q.id));
    
    if (uncompleted.length === 0) {
      Alert.alert(
        'Chúc mừng!', 
        'Bạn đã hoàn thành toàn bộ nhiệm vụ khám phá hiện tại!\nHệ thống sẽ tạo thêm nhiệm vụ mới quanh bạn...',
        [{ text: 'Tạo Nhiệm Vụ', onPress: generateRandomQuests }]
      );
      return;
    }
    
    // Teleport đến nhiệm vụ chưa làm đầu tiên
    const nextQuest = uncompleted[0];
    const newLoc = {
      latitude: nextQuest.latitude,
      longitude: nextQuest.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    };
    setLocation(newLoc);
    mapRef.current?.animateToRegion(newLoc, 1500);
    Alert.alert('Đã Teleport!', `Bạn đã được dịch chuyển đến khu vực: ${nextQuest.title}`);
  };

  const generateRandomQuests = async () => {
    if (!location || !user || !user.uid) return;
    setLoading(true);
    try {
      const { latitude, longitude } = location;
      
      // 1. Gửi request tìm địa điểm THỰC TẾ xung quanh bằng OpenStreetMap Overpass API (Miễn phí, không cần key)
      const queryStr = `
        [out:json][timeout:15];
        (
          node["amenity"="cafe"](around:800, ${latitude}, ${longitude});
          node["amenity"="restaurant"](around:800, ${latitude}, ${longitude});
          node["leisure"="park"](around:800, ${latitude}, ${longitude});
          node["amenity"="fast_food"](around:800, ${latitude}, ${longitude});
        );
        out body 10;
      `;

      let osmVenues = [];
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: queryStr,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.elements && data.elements.length > 0) {
            osmVenues = data.elements.filter(el => el.lat && el.lon && el.tags && el.tags.name);
          }
        }
      } catch (osmError) {
        console.warn("Lỗi gọi Overpass API, chuyển sang chế độ tạo thông minh dự phòng:", osmError);
      }

      const newQuests = [];
      
      if (osmVenues.length >= 3) {
        // Xáo trộn danh sách địa điểm thực tế tìm được
        const shuffledVenues = [...osmVenues].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < Math.min(3, shuffledVenues.length); i++) {
          const venue = shuffledVenues[i];
          const name = venue.tags.name;
          const venueLat = venue.lat;
          const venueLon = venue.lon;
          const amenity = venue.tags.amenity || venue.tags.leisure || '';

          // Áp dụng bộ theme phù hợp
          let cat = POI_CATEGORIES[0]; // Mặc định Cà phê
          if (amenity === 'cafe') {
            cat = POI_CATEGORIES[0];
          } else if (amenity === 'park' || amenity === 'leisure') {
            cat = POI_CATEGORIES[1];
          } else if (amenity === 'restaurant' || amenity === 'fast_food') {
            cat = POI_CATEGORIES[2];
          } else {
            cat = POI_CATEGORIES[Math.floor(Math.random() * POI_CATEGORIES.length)];
          }

          const randomDesc = cat.descriptions[Math.floor(Math.random() * cat.descriptions.length)];
          const coinReward = 100 + Math.floor(Math.random() * 151); // 100 - 250 xu

          const newQuest = {
            id: `osm_${venue.id}_${Date.now()}`,
            title: name,
            description: randomDesc,
            latitude: venueLat,
            longitude: venueLon,
            radius: 100, // Thẻ thực tế chỉ cần bán kính 100m để đi bộ chuẩn xác
            coinReward: coinReward,
            badgeReward: cat.badgeReward + `_${Date.now()}`,
            badgeName: cat.badgeName,
            createdBy: user.uid,     // <-- QUYỀN RIÊNG TƯ: Do user hiện tại tạo
            visibility: 'friends'    // <-- QUYỀN RIÊNG TƯ: Chỉ hiển thị cho mình và bạn bè
          };

          await setDoc(doc(db, 'gps_quests', newQuest.id), newQuest);
          newQuests.push(newQuest);
        }

        // Tải lại dữ liệu bản đồ để lọc quyền riêng tư nghiêm ngặt
        await fetchQuests();
        Alert.alert(
          'Radar Vệ Tinh Quét Thực Tế!', 
          'Tuyệt vời! QuestWalk đã dò quét thành công 3 ĐỊA ĐIỂM THỰC TẾ (Quán cà phê, Nhà hàng, Công viên...) xung quanh vị trí của bạn trên bản đồ!'
        );
      } else {
        // --- CHẾ ĐỘ DỰ PHÒNG THÔNG MINH (FALLBACK) ---
        // Nếu không có mạng hoặc khu vực không có dữ liệu OSM, tự động tạo tọa độ thực tế có ý nghĩa
        const shuffledCategories = [...POI_CATEGORIES].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < Math.min(3, shuffledCategories.length); i++) {
          const cat = shuffledCategories[i];
          
          const randomTitle = cat.titles[Math.floor(Math.random() * cat.titles.length)] + ` #${Math.floor(Math.random() * 90 + 10)}`;
          const randomDesc = cat.descriptions[Math.floor(Math.random() * cat.descriptions.length)];
          
          // Tạo tọa độ ngẫu nhiên gần ~100m - 250m xung quanh user
          const latOffset = (Math.random() - 0.5) * 0.004;
          const lonOffset = (Math.random() - 0.5) * 0.004;
          
          const coinReward = 80 + Math.floor(Math.random() * 121); // 80 - 200 xu

          const newQuest = {
            id: `fallback_${Date.now()}_${i}`,
            title: randomTitle,
            description: randomDesc,
            latitude: location.latitude + latOffset,
            longitude: location.longitude + lonOffset,
            radius: 120 + Math.floor(Math.random() * 60),
            coinReward: coinReward,
            badgeReward: cat.badgeReward + `_${Date.now()}`,
            badgeName: cat.badgeName,
            createdBy: user.uid,     // <-- QUYỀN RIÊNG TƯ: Do user hiện tại tạo
            visibility: 'friends'    // <-- QUYỀN RIÊNG TƯ: Chỉ hiển thị cho mình và bạn bè
          };
          
          await setDoc(doc(db, 'gps_quests', newQuest.id), newQuest);
          newQuests.push(newQuest);
        }
        
        // Tải lại dữ liệu bản đồ để lọc quyền riêng tư nghiêm ngặt
        await fetchQuests();
        Alert.alert(
          'Dò tìm vệ tinh thành công!', 
          'QuestWalk đã phát hiện và tạo 3 địa điểm dạo bộ thú vị ngay xung quanh vị trí của bạn!'
        );
      }

    } catch (e) {
      console.error(e);
      Alert.alert('Lỗi', 'Không thể quét radar địa điểm thực tế.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomQuest = async () => {
    const coins = parseInt(customQuestCoins);
    if (!customQuestTitle.trim() || isNaN(coins) || coins <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên và số xu phần thưởng hợp lệ.');
      return;
    }
    if (coinBalance < coins) {
      Alert.alert('Lỗi', 'Bạn không có đủ Xu trong ví để tạo nhiệm vụ này!');
      return;
    }
    if (customQuestVisibility === 'friends' && !selectedTargetFriendId) {
      Alert.alert('Lỗi', 'Vui lòng chọn 1 người bạn để gửi thông báo Rương Xu!');
      return;
    }
    
    try {
      // Trừ xu của user
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { coinBalance: increment(-coins) }, { merge: true });
      setCoinBalance(coinBalance - coins);

      // Xác định tọa độ đặt rương (Tọa độ đã chọn hoặc tọa độ GPS hiện tại của user)
      const lat = selectedPlacementCoords ? selectedPlacementCoords.latitude : location.latitude;
      const lon = selectedPlacementCoords ? selectedPlacementCoords.longitude : location.longitude;

      const newQuest = {
        id: `custom_${Date.now()}`,
        title: customQuestTitle,
        description: `Thử thách đặc biệt từ ${user.email?.split('@')[0]}!`,
        latitude: lat,
        longitude: lon,
        radius: 80, // Vòng tròn hẹp hơn để tăng độ khó
        coinReward: coins,
        badgeReward: customQuestVisibility === 'public' ? 'Public_Quest' : 'Friend_Quest',
        badgeName: customQuestVisibility === 'public' ? 'Thợ Săn Kho Báu' : 'Người Được Chọn',
        createdBy: user.uid,
        visibility: customQuestVisibility, // Lưu trạng thái công khai hay bạn bè
        isCustom: true // Đánh dấu là rương tự thả tốn xu, được quyền thu hồi nhận lại xu
      };
      
      await setDoc(doc(db, 'gps_quests', newQuest.id), newQuest);
      setQuests(prev => [...prev, newQuest]);
      
      if (customQuestVisibility === 'friends' && selectedTargetFriendId) {
        const chatId = [user.uid, selectedTargetFriendId].sort().join('_');
        await addDoc(collection(db, 'messages'), {
          chatId,
          text: `🎁 Tớ vừa thả rương Xu bí mật "${customQuestTitle}" chứa ${coins} Xu! Nhấn để xem vị trí!`,
          type: 'location',
          questId: newQuest.id,
          latitude: lat,
          longitude: lon,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          isSystem: false
        });
      }

      setShowCreateModal(false);
      setCustomQuestTitle('');
      setCustomQuestCoins('');
      setSelectedTargetFriendId(null);
      setSelectedPlacementCoords(null); // Xóa ghim xem trước sau khi thả thành công
      Alert.alert('Thành công', 'Bạn đã thả Thử thách tại vị trí này! Rương Xu và tin nhắn đã được gửi tới người bạn của bạn.');
    } catch (e) {
      console.error(e);
      Alert.alert('Lỗi', 'Không thể tạo thử thách.');
    }
  };

  const handleRevokeQuest = (quest) => {
    Alert.alert(
      'Thu hồi Nhiệm vụ',
      `Bạn có muốn hủy nhiệm vụ này và thu hồi lại ${quest.coinReward} Xu vào ví không?`,
      [
        { text: 'Không', style: 'cancel' },
        { 
          text: 'Thu hồi', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Xóa quest khỏi database
              await deleteDoc(doc(db, 'gps_quests', quest.id));
              
              // Hoàn tiền cho user
              const userRef = doc(db, 'users', user.uid);
              await setDoc(userRef, { coinBalance: increment(quest.coinReward) }, { merge: true });
              setCoinBalance(coinBalance + quest.coinReward);
              
              // Cập nhật giao diện
              setQuests(prev => prev.filter(q => q.id !== quest.id));
              setSelectedQuest(null);
              Alert.alert('Thành công', `Đã thu hồi rương! Cộng lại ${quest.coinReward} Xu vào ví.`);
            } catch (error) {
              console.error(error);
              Alert.alert('Lỗi', 'Không thể thu hồi nhiệm vụ lúc này.');
            }
          }
        }
      ]
    );
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1`, {
        headers: {
          'User-Agent': 'QuestWalkMobileApp/1.0 (contact@questwalk.app)' // Bắt buộc Nominatim User-Agent
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const result = data[0];
          const searchLat = parseFloat(result.lat);
          const searchLon = parseFloat(result.lon);
          
          const targetCoords = {
            latitude: searchLat,
            longitude: searchLon,
          };
          
          setSelectedPlacementCoords(targetCoords);
          
          mapRef.current?.animateToRegion({
            ...targetCoords,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006
          }, 1500);

          Alert.alert(
            'Tìm thấy địa chỉ!',
            `Đã định vị bản đồ đến:\n${result.display_name.split(',')[0]}\n\nBấm nút [+] ở góc dưới để điền thông tin thả rương xu tại vị trí này!`
          );
        } else {
          Alert.alert('Không tìm thấy', 'Không tìm thấy địa điểm phù hợp. Hãy nhập chi tiết hơn (VD: Hồ Tây, Keangnam...).');
        }
      } else {
        Alert.alert('Lỗi kết nối', 'Không thể liên kết đến máy chủ định vị địa lý.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể tìm kiếm địa điểm lúc này.');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#40C057" />
        <Text style={{ marginTop: 10 }}>Đang dò tìm vệ tinh GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Thanh Tìm Kiếm Bản Đồ Nominatim */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="rgba(0, 251, 251, 0.7)" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm địa chỉ đặt rương (VD: Hồ Tây...)"
          placeholderTextColor="#839493"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchLocation}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 8 }}>
            <Ionicons name="close-circle" size={18} color="#839493" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.searchBtn} 
          onPress={handleSearchLocation}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#00fbfb" />
          ) : (
            <Text style={{ color: '#00fbfb', fontWeight: 'bold' }}>Tìm</Text>
          )}
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={location}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onLongPress={(e) => {
          const coords = e.nativeEvent.coordinate;
          setSelectedPlacementCoords(coords);
          Alert.alert(
            'Đã chọn vị trí!',
            'QuestWalk đã đặt ghim xem trước Rương xu tại tọa độ này! Nhấn nút [+] để bắt đầu thả Rương!'
          );
        }}
      >
        {/* Ghim xem trước vị trí thả rương xu dự kiến */}
        {selectedPlacementCoords && (
          <Marker
            coordinate={selectedPlacementCoords}
            title="Điểm thả rương xu dự kiến"
            description="Nhấn giữ địa điểm khác trên bản đồ để đổi vị trí!"
            onPress={() => setShowCreateModal(true)}
          >
            <View style={[styles.markerBadge, styles.placementPreviewMarker]}>
              <Ionicons name="location" size={18} color="#FFF" />
            </View>
          </Marker>
        )}
        {quests.map((quest) => {
          const isCompleted = completedQuestIds.includes(quest.id);
          const isMyQuest = quest.createdBy === user?.uid && quest.isCustom;
          const isRadarQuest = quest.createdBy === user?.uid && !quest.isCustom;
          const isFriendQuest = quest.createdBy && quest.createdBy !== user?.uid && friendIds.includes(quest.createdBy);
          const friendInfo = isFriendQuest ? friendsMap[quest.createdBy] : null;

          return (
            <View key={`${quest.id}-${isCompleted}`}>
              <Marker
                coordinate={{ latitude: quest.latitude, longitude: quest.longitude }}
                onPress={() => handleQuestPress(quest)}
                tracksViewChanges={true}
              >
                <Animated.View style={[
                  styles.markerBadge,
                  isCompleted && styles.markerCompleted,
                  !isCompleted && !isFriendQuest && isMyQuest && styles.myQuestMarker,
                  !isCompleted && !isFriendQuest && isRadarQuest && styles.radarQuestMarker,
                  !isCompleted && !isFriendQuest && !isMyQuest && !isRadarQuest && styles.systemQuestMarker,
                  !isCompleted && isFriendQuest && [styles.avatarMarker, !friendInfo?.avatarUrl && styles.initialAvatar],
                  !isCompleted && { 
                    transform: [{ scale: pulseValue }],
                    opacity: fadeValue
                  }
                ]} collapsable={false}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                  ) : isFriendQuest ? (
                    friendInfo?.avatarUrl ? (
                      <Image source={{ uri: friendInfo.avatarUrl }} style={styles.avatarMarkerImage} />
                    ) : (
                      <Text style={styles.initialText}>
                        {friendInfo?.email ? friendInfo.email.charAt(0).toUpperCase() : 'F'}
                      </Text>
                    )
                  ) : isMyQuest ? (
                    <Ionicons name="gift" size={18} color="#FFF" />
                  ) : isRadarQuest ? (
                    <Ionicons name="compass" size={18} color="#0d1515" />
                  ) : (
                    <Ionicons name="flag" size={18} color="#FFF" />
                  )}
                </Animated.View>
              </Marker>
              <Circle
                center={{ latitude: quest.latitude, longitude: quest.longitude }}
                radius={quest.radius}
                fillColor={isCompleted ? 'rgba(43, 138, 62, 0.2)' : isRadarQuest ? 'rgba(0, 251, 251, 0.15)' : isMyQuest ? 'rgba(51, 154, 240, 0.2)' : isFriendQuest ? 'rgba(255, 146, 43, 0.2)' : 'rgba(252, 196, 25, 0.25)'}
                strokeColor={isCompleted ? 'rgba(43, 138, 62, 0.5)' : isRadarQuest ? 'rgba(0, 251, 251, 0.6)' : isMyQuest ? 'rgba(51, 154, 240, 0.8)' : isFriendQuest ? 'rgba(255, 146, 43, 0.8)' : 'rgba(252, 196, 25, 0.8)'}
                strokeWidth={2}
              />
            </View>
          );
        })}
      </MapView>

      {selectedQuest && (
        <View style={styles.bottomCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.questTitle}>{selectedQuest.title}</Text>
            <TouchableOpacity onPress={() => setSelectedQuest(null)}>
              <Ionicons name="close-circle" size={24} color="#ADB5BD" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.questDesc}>{selectedQuest.description}</Text>

          {selectedQuest.createdBy && (
            <View style={styles.creatorBadge}>
              <Ionicons name="person" size={14} color="#868E96" />
              <Text style={styles.creatorText}>
                Tạo bởi: {selectedQuest.createdBy === user?.uid ? 'Bạn' : friendsMap[selectedQuest.createdBy]?.email ? friendsMap[selectedQuest.createdBy].email.split('@')[0] : 'Người chơi khác'}
              </Text>
            </View>
          )}
          
          <View style={styles.rewardBox}>
            <Ionicons name="star" size={20} color="#FCC419" />
            <Text style={styles.rewardText}>+{selectedQuest.coinReward} Xu</Text>
            
            <View style={styles.spacer} />
            
            <Ionicons name="medal" size={20} color="#40C057" />
            <Text style={styles.rewardText}>Huy {selectedQuest.badgeName}</Text>
          </View>

          {selectedQuest.createdBy === user?.uid && selectedQuest.isCustom ? (
            <TouchableOpacity 
              style={[styles.checkInButton, { backgroundColor: '#E03131' }]} 
              onPress={() => handleRevokeQuest(selectedQuest)}
            >
              <Ionicons name="trash" size={20} color="#FFF" />
              <Text style={styles.checkInText}>Thu hồi rương ({selectedQuest.coinReward} Xu)</Text>
            </TouchableOpacity>
          ) : completedQuestIds.includes(selectedQuest.id) ? (
            <View style={[styles.checkInButton, { backgroundColor: '#ADB5BD' }]}>
              <Ionicons name="checkmark-done" size={20} color="#FFF" />
              <Text style={styles.checkInText}>Đã Check-in</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.checkInButton} onPress={handleCheckIn}>
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.checkInText}>Mở AR Check-in ngay</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.devButton} onPress={handleTeleport}>
        <Ionicons name="rocket" size={16} color="#FFF" />
        <Text style={styles.devButtonText}>[DEV] Tới mục tiêu tiếp theo</Text>
      </TouchableOpacity>

      {/* Nút Quét Radar Tìm Địa Điểm Thực Tế */}
      <TouchableOpacity 
        style={styles.radarButton} 
        onPress={generateRandomQuests}
        activeOpacity={0.8}
      >
        <Ionicons name="scan" size={26} color="#00fbfb" />
      </TouchableOpacity>

      {/* Nút thả Quest tùy chỉnh */}
      <TouchableOpacity style={styles.fabButton} onPress={() => setShowCreateModal(true)}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Modal Tạo Quest Cho Bạn Bè */}
      <Modal visible={showCreateModal} transparent={true} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo Thử thách mới</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#ADB5BD" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Thả một rương xu ngay tại vị trí bạn đang đứng để thách đố bạn bè tới lấy!
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Tên thử thách (VD: Đến nhà tui chơi)"
              value={customQuestTitle}
              onChangeText={setCustomQuestTitle}
            />

            <TextInput
              style={styles.input}
              placeholder="Treo thưởng bao nhiêu Xu?"
              keyboardType="numeric"
              value={customQuestCoins}
              onChangeText={setCustomQuestCoins}
            />

            {/* Chọn Quyền Riêng Tư */}
            <Text style={styles.visibilityLabel}>Ai có thể nhặt rương này?</Text>
            <View style={styles.visibilityToggle}>
              <TouchableOpacity 
                style={[styles.visibilityBtn, customQuestVisibility === 'public' && styles.visibilityBtnActive]}
                onPress={() => setCustomQuestVisibility('public')}
              >
                <Ionicons name="earth" size={18} color={customQuestVisibility === 'public' ? '#FFF' : '#839493'} />
                <Text style={[styles.visibilityBtnText, customQuestVisibility === 'public' && styles.visibilityBtnTextActive]}>Công khai</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.visibilityBtn, customQuestVisibility === 'friends' && styles.visibilityBtnActive]}
                onPress={() => setCustomQuestVisibility('friends')}
              >
                <Ionicons name="people" size={18} color={customQuestVisibility === 'friends' ? '#FFF' : '#839493'} />
                <Text style={[styles.visibilityBtnText, customQuestVisibility === 'friends' && styles.visibilityBtnTextActive]}>Tặng cho Bạn</Text>
              </TouchableOpacity>
            </View>

            {customQuestVisibility === 'friends' && (
              <View style={styles.friendSelectionContainer}>
                <Text style={styles.visibilityLabel}>Gửi Rương Xu này tới ai?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendScroll}>
                  {Object.values(friendsMap).map(friend => {
                    const isSelected = selectedTargetFriendId === friend.id;
                    const friendName = friend.email?.split('@')[0] || 'User';
                    return (
                      <TouchableOpacity 
                        key={friend.id}
                        style={[styles.friendChip, isSelected && styles.friendChipSelected]}
                        onPress={() => setSelectedTargetFriendId(friend.id)}
                      >
                        {friend.avatarUrl ? (
                          <Image source={{ uri: friend.avatarUrl }} style={styles.friendChipAvatar} />
                        ) : (
                          <View style={styles.friendChipAvatarPlaceholder}>
                            <Text style={styles.friendChipInitials}>{friendName.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={[styles.friendChipName, isSelected && styles.friendChipNameSelected]}>{friendName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {Object.values(friendsMap).length === 0 && (
                    <Text style={{ color: '#839493', fontStyle: 'italic', paddingVertical: 10 }}>Bạn chưa có bạn bè nào.</Text>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.balanceHint}>Số dư của bạn: {coinBalance} Xu</Text>

            <TouchableOpacity style={styles.submitButton} onPress={handleCreateCustomQuest}>
              <Text style={styles.submitButtonText}>Thả rương Xu tại đây</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA'
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerBadge: {
    backgroundColor: '#E67700',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  markerCompleted: {
    backgroundColor: '#2B8A3E',
  },
  myQuestMarker: {
    backgroundColor: '#228BE6',
    borderColor: '#E7F5FF',
  },
  systemQuestMarker: {
    backgroundColor: '#FAB005',
    borderColor: '#FFF3BF',
  },
  radarQuestMarker: {
    backgroundColor: '#00fbfb',
    borderColor: '#e7faff',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  avatarMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: '#FF922B', // Orange border for friend quests
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  initialAvatar: {
    backgroundColor: '#FFE8CC',
    borderColor: '#FF922B',
  },
  initialText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF922B',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: -8,
    marginBottom: 12,
    gap: 4,
  },
  creatorText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(13, 21, 21, 0.95)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00fbfb',
  },
  questDesc: {
    fontSize: 14,
    color: '#dbe4e3',
    marginBottom: 16,
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 6,
  },
  spacer: {
    width: 16,
  },
  checkInButton: {
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
  },
  checkInText: {
    color: '#00fbfb',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  devButton: {
    position: 'absolute',
    top: 110,
    right: 20,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a4a49',
  },
  devButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  placementPreviewMarker: {
    backgroundColor: '#00fbfb',
    borderColor: '#FFF',
    borderWidth: 2,
    shadowColor: '#00fbfb',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  searchBarContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(13, 21, 21, 0.95)',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 251, 251, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    height: 40,
  },
  searchBtn: {
    paddingLeft: 10,
    paddingRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.5)',
  },
  radarButton: {
    position: 'absolute',
    bottom: 95,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(13, 21, 21, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00fbfb',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d1515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00fbfb',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#dbe4e3',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderWidth: 1,
    borderColor: '#3a4a49',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    color: '#FFF',
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  visibilityToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a4a49',
  },
  visibilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  visibilityBtnActive: {
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
  },
  visibilityBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#839493',
  },
  visibilityBtnTextActive: {
    color: '#00fbfb',
  },
  friendSelectionContainer: {
    marginBottom: 16,
  },
  friendScroll: {
    flexDirection: 'row',
  },
  friendChip: {
    alignItems: 'center',
    marginRight: 16,
    opacity: 0.5,
  },
  friendChipSelected: {
    opacity: 1,
  },
  friendChipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#3a4a49',
    marginBottom: 4,
  },
  friendChipAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3a4a49',
    marginBottom: 4,
  },
  friendChipInitials: {
    color: '#dbe4e3',
    fontWeight: 'bold',
    fontSize: 18,
  },
  friendChipName: {
    fontSize: 12,
    color: '#839493',
  },
  friendChipNameSelected: {
    color: '#00fbfb',
    fontWeight: 'bold',
  },
  balanceHint: {
    fontSize: 13,
    color: '#FFD700',
    marginBottom: 24,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
  },
  submitButtonText: {
    color: '#00fbfb',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default MapScreen;
