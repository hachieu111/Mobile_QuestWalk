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
        const friendIds = userDocSnap.data()?.friendIds || [];

        // Lấy thông tin bạn bè để lấy Avatar trên bản đồ
        const fMap = {};
        if (friendIds.length > 0) {
          try {
            const qFriends = query(collection(db, 'users'), where('__name__', 'in', friendIds.slice(0, 10)));
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

        // Lọc quest dựa trên quyền riêng tư
        questList = questList.filter(q => {
          if (!q.visibility || q.visibility === 'public') return true;
          if (q.createdBy === user.uid) return true; // Của mình tạo thì luôn thấy
          if (q.visibility === 'friends' && friendIds.includes(q.createdBy)) return true; // Của bạn bè thì thấy
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
    if (!location) return;
    setLoading(true);
    try {
      const newQuests = [];
      for (let i = 0; i < 3; i++) {
        // Tạo ngẫu nhiên trong bán kính ~500m từ vị trí hiện tại
        const latOffset = (Math.random() - 0.5) * 0.01;
        const lonOffset = (Math.random() - 0.5) * 0.01;
        
        const newQuest = {
          id: `rand_${Date.now()}_${i}`,
          title: `Nhiệm vụ Ẩn danh #${Math.floor(Math.random() * 1000)}`,
          description: 'Hệ thống vừa phát hiện tín hiệu ở tọa độ này. Hãy đến kiểm tra!',
          latitude: location.latitude + latOffset,
          longitude: location.longitude + lonOffset,
          radius: 150 + Math.floor(Math.random() * 100),
          coinReward: 50 + Math.floor(Math.random() * 100),
          badgeReward: `Random_${Math.floor(Math.random()*100)}`,
          badgeName: 'Thợ săn Bóng đêm'
        };
        await setDoc(doc(db, 'gps_quests', newQuest.id), newQuest);
        newQuests.push(newQuest);
      }
      setQuests(prev => [...prev, ...newQuests]);
      Alert.alert('Nhiệm vụ mới!', 'Đã dò ra 3 khu vực bí ẩn quanh bạn. Hãy mở bản đồ để xem!');
    } catch (e) {
      console.error(e);
      Alert.alert('Lỗi', 'Không thể tạo nhiệm vụ mới.');
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

      const newQuest = {
        id: `custom_${Date.now()}`,
        title: customQuestTitle,
        description: `Thử thách đặc biệt từ ${user.email?.split('@')[0]}!`,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: 80, // Vòng tròn hẹp hơn để tăng độ khó
        coinReward: coins,
        badgeReward: 'Friend_Quest',
        badgeName: 'Người Được Chọn',
        createdBy: user.uid,
        visibility: customQuestVisibility // Lưu trạng thái công khai hay bạn bè
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
          latitude: location.latitude,
          longitude: location.longitude,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          isSystem: false
        });
      }

      setShowCreateModal(false);
      setCustomQuestTitle('');
      setCustomQuestCoins('');
      setSelectedTargetFriendId(null);
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
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={location}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {quests.map((quest) => {
          const isCompleted = completedQuestIds.includes(quest.id);
          const isMyQuest = quest.createdBy === user?.uid;
          const isFriendQuest = quest.createdBy && quest.createdBy !== user?.uid && friendsMap[quest.createdBy];
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
                  !isCompleted && !isFriendQuest && !isMyQuest && styles.systemQuestMarker,
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
                  ) : (
                    <Ionicons name="flag" size={18} color="#FFF" />
                  )}
                </Animated.View>
              </Marker>
              <Circle
                center={{ latitude: quest.latitude, longitude: quest.longitude }}
                radius={quest.radius}
                fillColor={isCompleted ? 'rgba(43, 138, 62, 0.2)' : isMyQuest ? 'rgba(51, 154, 240, 0.2)' : isFriendQuest ? 'rgba(255, 146, 43, 0.2)' : 'rgba(252, 196, 25, 0.25)'}
                strokeColor={isCompleted ? 'rgba(43, 138, 62, 0.5)' : isMyQuest ? 'rgba(51, 154, 240, 0.8)' : isFriendQuest ? 'rgba(255, 146, 43, 0.8)' : 'rgba(252, 196, 25, 0.8)'}
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

          {selectedQuest.createdBy === user?.uid ? (
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
    top: 60,
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
