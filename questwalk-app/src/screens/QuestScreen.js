import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  Dimensions, 
  Animated 
} from 'react-native';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const TARGET_X = width - 75; // Vị trí X của cụm hiển thị Xu ở header
const TARGET_Y = 70;         // Vị trí Y của cụm hiển thị Xu ở header

// Xác định loại nhiệm vụ: Ngày, Tháng, Năm (Helper ngoài để dùng chung)
const getQuestTypeInfo = (item) => {
  const target = item.targetSteps || item.stepGoal || 1;
  const type = item.type ? item.type.toLowerCase() : '';

  if (type === 'daily' || type === 'day' || target < 12000) {
    return {
      label: 'HÀNG NGÀY',
      color: '#40C057', // Xanh lá
      bgColor: 'rgba(64, 192, 87, 0.1)',
      borderColor: 'rgba(64, 192, 87, 0.25)',
      icon: 'time-outline'
    };
  } else if (type === 'monthly' || type === 'month' || (target >= 12000 && target < 18000)) {
    return {
      label: 'HÀNG THÁNG',
      color: '#00fbfb', // Xanh Neon
      bgColor: 'rgba(0, 251, 251, 0.1)',
      borderColor: 'rgba(0, 251, 251, 0.25)',
      icon: 'calendar-outline'
    };
  } else {
    return {
      label: 'HÀNG NĂM',
      color: '#FFD700', // Vàng hoàng kim
      bgColor: 'rgba(255, 215, 0, 0.1)',
      borderColor: 'rgba(255, 215, 0, 0.25)',
      icon: 'trophy-outline'
    };
  }
};

// --- COMPONENT CON: THẺ NHIỆM VỤ HIỆU ỨNG CHUYỂN CẢNH MƯỢT MÀ ---
const QuestCard = ({ item, displaySteps, totalSteps, claimedQuestIds, onClaim }) => {
  const target = item.targetSteps || item.stepGoal || 1;
  const coinReward = item.coinReward || item.rewardCoins || item.reward || 0;
  
  const isClaimed = claimedQuestIds.has(item.id) || item.isOptimisticallyClaimed;
  const isPendingClaim = displaySteps >= target && !isClaimed;
  
  const progressPercent = Math.min((displaySteps / target) * 100, 100);
  const typeInfo = getQuestTypeInfo(item);

  // Animated values cục bộ cho card
  const cardScale = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  // Xử lý hoạt ảnh khi ấn nhận thưởng trước khi báo lên cha
  const handlePressClaim = () => {
    Animated.sequence([
      // 1. Phóng to giật nhẹ card + bùng nổ lớp ánh sáng vàng + thu nhỏ nút nhẹ
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
        Animated.timing(btnScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      ]),
      // 2. Co lại dưới mức bình thường + mờ dần lớp ánh sáng + hòa tan nút biến mất
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 0.97, duration: 200, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(btnOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(btnScale, { toValue: 0.2, duration: 200, useNativeDriver: true }),
      ]),
      // 3. Trả lại trạng thái 1.0 mượt mà
      Animated.timing(cardScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      // Gọi hàm nhận thưởng ở cha sau khi hiệu ứng thẻ đã chạy hoàn tất cực kỳ ăn khớp
      onClaim(item);
    });
  };

  return (
    <Animated.View style={[
      styles.card, 
      isClaimed ? styles.cardClaimed : (isPendingClaim ? styles.cardPending : styles.cardInProgress),
      { transform: [{ scale: cardScale }] }
    ]}>
      {/* Lớp Gold Flash phủ ánh sáng vàng bùng nổ khi nhận thưởng */}
      <Animated.View 
        style={[styles.goldFlashOverlay, { opacity: flashAnim }]} 
        pointerEvents="none" 
      />

      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Ionicons 
            name={isClaimed ? "checkmark-circle" : (isPendingClaim ? "gift" : "walk")} 
            size={24} 
            color={isClaimed ? "#00fbfb" : (isPendingClaim ? "#FFD700" : "#dbe4e3")} 
          />
          <Text style={[
            styles.title, 
            isClaimed && styles.titleClaimed,
            isPendingClaim && styles.titlePending
          ]}>
            {item.title}
          </Text>
        </View>
        <View style={[
          styles.rewardBadge,
          isClaimed && styles.rewardBadgeClaimed,
          isPendingClaim && styles.rewardBadgePending
        ]}>
          <Ionicons name="star" size={16} color={isClaimed ? "#839493" : "#FCC419"} />
          <Text style={[styles.rewardText, isClaimed && { color: '#839493' }]}>+{coinReward}</Text>
        </View>
      </View>

      {/* Huy hiệu loại nhiệm vụ */}
      <View style={styles.typeBadgeContainer}>
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.bgColor, borderColor: typeInfo.borderColor }]}>
          <Ionicons name={typeInfo.icon} size={12} color={typeInfo.color} style={{ marginRight: 4 }} />
          <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>
      </View>

      {item.description && (
        <Text style={[styles.description, isClaimed && { color: '#5b6b6a' }]}>{item.description}</Text>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[
            styles.progressText,
            isClaimed && { color: '#839493' },
            isPendingClaim && { color: '#FFD700' }
          ]}>
            {isClaimed ? 'Đã hoàn thành' : (isPendingClaim ? 'Sẵn sàng nhận thưởng!' : 'Tiến độ')}
          </Text>
          <Text style={[styles.progressValue, isClaimed && { color: '#839493' }]}>
            {displaySteps} / {target} bước
          </Text>
        </View>
        
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${progressPercent}%` },
              isClaimed && styles.progressBarFillClaimed,
              isPendingClaim && styles.progressBarFillPending
            ]} 
          />
        </View>
      </View>

      {/* NÚT NHẬN THƯỞNG VỚI HIỆU ỨNG HÒA TAN MƯỢT MÀ */}
      {isPendingClaim && (
        <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={handlePressClaim}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={18} color="#0d1515" style={{ marginRight: 6 }} />
            <Text style={styles.claimBtnText}>NHẬN THƯỞNG</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// --- COMPONENT CHÍNH ---
const QuestScreen = () => {
  const { 
    user, 
    totalSteps, 
    currentStepCount, 
    coinBalance, 
    setTotalSteps, 
    setCurrentStepCount, 
    setCoinBalance,
    addSteps,
    cachedQuests,
    cachedClaimedQuestIds,
    setCachedQuests,
    setCachedClaimedQuestIds
  } = useQuestStore();

  const [quests, setQuests] = useState(cachedQuests);
  const [claimedQuestIds, setClaimedQuestIds] = useState(cachedClaimedQuestIds);
  const [loading, setLoading] = useState(cachedQuests.length === 0);
  const [claimingQuestId, setClaimingQuestId] = useState(null);

  const displaySteps = totalSteps + currentStepCount;

  // --- HỆ THỐNG ANIMATION & HẠT BAY ---
  const [particles, setParticles] = useState([]);
  const coinScaleAnim = useRef(new Animated.Value(1)).current;
  const [displayedCoins, setDisplayedCoins] = useState(coinBalance);
  const newCoinBalanceRef = useRef(coinBalance);

  useEffect(() => {
    setDisplayedCoins(coinBalance);
  }, []);

  const fetchQuests = async () => {
    try {
      let querySnapshot = await getDocs(collection(db, 'quests'));
      
      // Tự động tạo dữ liệu mẫu nếu collection trống
      if (querySnapshot.empty) {
        const dummyQuests = [
          { title: 'Khởi động ngày mới', targetSteps: 1000, rewardCoins: 50, description: 'Đi bộ 1000 bước để làm nóng cơ thể.', isActive: true, type: 'daily' },
          { title: 'Chinh phục 5000 bước', targetSteps: 5000, rewardCoins: 200, description: 'Đi bộ 5000 bước để nâng cao sức khỏe.', isActive: true, type: 'daily' },
          { title: 'Chiến thần marathon', targetSteps: 10000, rewardCoins: 500, description: 'Hoàn thành 10000 bước trong ngày hôm nay.', isActive: true, type: 'daily' }
        ];
        for (const q of dummyQuests) {
          await addDoc(collection(db, 'quests'), q);
        }
        querySnapshot = await getDocs(collection(db, 'quests'));
      }

      // Tải danh sách các ID nhiệm vụ đã nhận thưởng từ Firestore của user
      const claimedSet = new Set();
      if (user?.uid) {
        const claimedSnap = await getDocs(collection(db, `users/${user.uid}/claimedQuests`));
        claimedSnap.forEach((doc) => {
          claimedSet.add(doc.id);
        });
      }
      
      // Đồng bộ vào cache của store và cập nhật state
      setCachedClaimedQuestIds(claimedSet);
      setClaimedQuestIds(claimedSet);

      const questList = [];
      querySnapshot.forEach((doc) => {
        questList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sắp xếp nhiệm vụ: Chờ nhận thưởng lên đầu -> Chưa hoàn thành -> Đã hoàn thành (Claimed)
      questList.sort((a, b) => {
        const aTarget = a.targetSteps || a.stepGoal || 1;
        const bTarget = b.targetSteps || b.stepGoal || 1;

        const aClaimed = claimedSet.has(a.id);
        const bClaimed = claimedSet.has(b.id);

        const aPending = displaySteps >= aTarget && !aClaimed;
        const bPending = displaySteps >= bTarget && !bClaimed;

        // Ưu tiên 1: Chờ nhận thưởng
        if (aPending !== bPending) return aPending ? -1 : 1;
        // Ưu tiên 2: Chưa hoàn thành
        if (aClaimed !== bClaimed) return aClaimed ? 1 : -1;
        
        return aTarget - bTarget;
      });

      // Đồng bộ vào cache của store và cập nhật state
      setCachedQuests(questList);
      setQuests(questList);
    } catch (error) {
      console.error("Error fetching quests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, [displaySteps]);

  // Hoạt ảnh bay của tiền xu/ngôi sao cực đẹp
  const playClaimAnimation = () => {
    // Tạo 12 hạt bay xuất phát từ tâm màn hình
    const newParticles = Array.from({ length: 12 }).map((_, index) => {
      return {
        id: index,
        position: new Animated.ValueXY({ x: width / 2, y: height / 2 - 50 }),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(0.5),
      };
    });

    setParticles(newParticles);

    // Chuỗi hoạt ảnh chuyển động cho từng hạt
    const animations = newParticles.map((particle, index) => {
      // Góc ngẫu nhiên để tạo hiệu ứng nổ tung tròn trịa lúc đầu
      const angle = (index / 12) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const radius = 60 + Math.random() * 50;
      const explodeX = width / 2 + Math.cos(angle) * radius;
      const explodeY = (height / 2 - 50) + Math.sin(angle) * radius;

      // Trễ nhẹ so le giữa các hạt để tạo cảm giác bay tự nhiên liên tiếp
      const delay = index * 40;

      return Animated.sequence([
        // 1. Hiệu ứng nổ bung ra
        Animated.parallel([
          Animated.timing(particle.position, {
            toValue: { x: explodeX, y: explodeY },
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 1.3,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        // Trễ
        Animated.delay(delay),
        // 2. Thu hút và bay thẳng lên đích (Xu ở góc trên phải)
        Animated.parallel([
          Animated.timing(particle.position, {
            toValue: { x: TARGET_X, y: TARGET_Y },
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 0.6,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(particle.opacity, {
            toValue: 0,
            duration: 550,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    // Chạy toàn bộ song song
    Animated.parallel(animations).start(() => {
      // Dọn dẹp các hạt khi hoàn thành
      setParticles([]);

      // Hiệu ứng co giãn (Pulse) rương xu góc trên phải khi nhận tiền
      Animated.sequence([
        Animated.timing(coinScaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(coinScaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.timing(coinScaleAnim, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      ]).start();

      // Cập nhật số xu hiển thị sang giá trị thực tế sau cộng
      if (newCoinBalanceRef.current !== undefined) {
        setDisplayedCoins(newCoinBalanceRef.current);
        setCoinBalance(newCoinBalanceRef.current);
      }
    });
  };

  // Tối ưu hóa: Phản hồi tức thì trong 0ms (Optimistic Update)
  const handleClaimReward = async (quest) => {
    if (!user || !user.uid) return;
    
    const coinReward = quest.coinReward || quest.rewardCoins || quest.reward || 0;
    
    // 1. Phản hồi lập tức trên UI: Đặt xu dự kiến và kích hoạt animation luôn!
    newCoinBalanceRef.current = coinBalance + coinReward;
    
    // Tạm thời đánh dấu quest đã claimed local để ẩn nút Nhận thưởng ngay tức thì
    setQuests(prev => prev.map(q => {
      if (q.id === quest.id) {
        return { ...q, isOptimisticallyClaimed: true };
      }
      return q;
    }));

    // Chạy hoạt ảnh bay tiền cực đẹp ngay lập tức!
    playClaimAnimation();

    // 2. Đồng bộ nhận thưởng lên Firestore (Chỉ cộng xu và đánh dấu claimed, TUYỆT ĐỐI KHÔNG đồng bộ bước chân)
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Cộng Xu trên server Firestore
      await updateDoc(userRef, {
        coinBalance: increment(coinReward)
      });

      // Lưu trạng thái đã claim vào Firestore subcollection để lưu trữ vĩnh viễn
      await setDoc(doc(db, `users/${user.uid}/claimedQuests`, quest.id), {
        claimedAt: new Date(),
        coinReward: coinReward
      });

      // Cập nhật số xu thực tế vào store để đồng bộ toàn app
      setCoinBalance(coinBalance + coinReward);

      // Thêm ID nhiệm vụ vào danh sách đã claim và cập nhật cả cache của store
      const nextClaimed = new Set(claimedQuestIds);
      nextClaimed.add(quest.id);
      setClaimedQuestIds(nextClaimed);
      setCachedClaimedQuestIds(nextClaimed);

    } catch (error) {
      console.error("Lỗi lưu nhận thưởng ngầm:", error);
    }
  };

  const [creatingTestQuest, setCreatingTestQuest] = useState(false);

  const handleCreateNewTestQuest = async () => {
    setCreatingTestQuest(true);
    try {
      // Đặt mốc bước chân bằng số bước hiện tại + 1000
      const nextTarget = Math.floor(displaySteps / 1000) * 1000 + 1000;
      
      const titles = [
        "Thử thách Chiến binh",
        "Sải bước Thần tốc",
        "Bứt phá Giới hạn",
        "Hành trình Vô song",
        "Bóng ma Tốc độ",
        "Chiến thần QuestWalk"
      ];
      const randomTitle = titles[Math.floor(Math.random() * titles.length)] + ` (${nextTarget} bước)`;
      
      const rewards = [300, 500, 600, 1000];
      const randomReward = rewards[Math.floor(Math.random() * rewards.length)];

      const types = ['daily', 'monthly', 'yearly'];
      const randomType = types[Math.floor(Math.random() * types.length)];

      const newQuest = {
        title: randomTitle,
        targetSteps: nextTarget,
        stepGoal: nextTarget,
        rewardCoins: randomReward,
        coinReward: randomReward,
        description: `Thử thách đặc biệt dành riêng cho bạn. Vượt qua mốc ${nextTarget} bước chân ngay!`,
        isActive: true,
        type: randomType,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'quests'), newQuest);
      
      // Load lại danh sách nhiệm vụ sau khi thêm
      await fetchQuests();
      Alert.alert("Thành công", `Đã tạo nhiệm vụ mới: "${randomTitle}"!`);
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tạo nhiệm vụ test mới.");
    } finally {
      setCreatingTestQuest(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00fbfb" />
        <Text style={styles.loadingText}>Đang tải nhiệm vụ...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      {/* Header với hiển thị Số dư Xu */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Nhiệm Vụ Thử Thách</Text>
            <Text style={styles.headerSubtitle}>Vượt qua giới hạn bản thân mỗi ngày!</Text>
          </View>
          <Animated.View style={[styles.coinContainer, { transform: [{ scale: coinScaleAnim }] }]}>
            <Ionicons name="star" size={16} color="#FFD700" style={{ marginRight: 4 }} />
            <Text style={styles.coinText}>{displayedCoins} Xu</Text>
          </Animated.View>
        </View>
      </View>

      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <QuestCard 
            item={item} 
            displaySteps={displaySteps} 
            totalSteps={totalSteps} 
            claimedQuestIds={claimedQuestIds} 
            onClaim={handleClaimReward} 
          />
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Hiện tại không có nhiệm vụ nào.</Text>
        }
      />

      {/* HIỆU ỨNG HẠT NGÔI SAO BAY PHỦ LÊN TRÊN (OVERLAY) */}
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              transform: [
                { translateX: particle.position.x },
                { translateY: particle.position.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
            },
          ]}
        >
          <Ionicons name="star" size={20} color="#FFD700" style={styles.particleGlow} />
        </Animated.View>
      ))}

      {/* DEV TOOL CHEAT BUTTONS FOR QA/TESTING */}
      <View style={styles.devToolContainer}>
        <TouchableOpacity 
          style={[styles.devToolBtn, { marginRight: 10 }]}
          onPress={() => addSteps(600)}
          activeOpacity={0.7}
        >
          <Ionicons name="flash" size={16} color="#FF922B" style={{ marginRight: 6 }} />
          <Text style={styles.devToolText}>+600 Bước Test</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.devToolBtn, { borderColor: '#00fbfb', backgroundColor: 'rgba(0, 251, 251, 0.05)' }]}
          onPress={handleCreateNewTestQuest}
          activeOpacity={0.7}
          disabled={creatingTestQuest}
        >
          {creatingTestQuest ? (
            <ActivityIndicator size="small" color="#00fbfb" />
          ) : (
            <>
              <Ionicons name="add-circle" size={16} color="#00fbfb" style={{ marginRight: 6 }} />
              <Text style={[styles.devToolText, { color: '#00fbfb' }]}>Tạo Quest Mới</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1515',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1515',
  },
  loadingText: {
    marginTop: 12,
    color: '#00fbfb',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 65,
    paddingBottom: 20,
    backgroundColor: 'rgba(13, 21, 21, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00fbfb',
    textShadowColor: 'rgba(0, 251, 251, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#dbe4e3',
    marginTop: 2,
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  coinText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden', // Quan trọng: Giữ goldFlashOverlay không bị tràn viền card
    position: 'relative',
  },
  cardInProgress: {
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderColor: 'rgba(0, 251, 251, 0.1)',
    borderLeftWidth: 6,
    borderLeftColor: '#FF922B', // Cam xám
  },
  cardPending: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderLeftWidth: 6,
    borderLeftColor: '#FFD700', // Vàng hoàng kim
    // Hiệu ứng phát quang nhẹ cho thẻ chờ nhận thưởng
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardClaimed: {
    backgroundColor: 'rgba(13, 21, 21, 0.4)',
    borderColor: 'rgba(58, 74, 73, 0.2)',
    borderLeftWidth: 6,
    borderLeftColor: '#00fbfb', // Neon Cyan nhạt
  },
  goldFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 215, 0, 0.35)', // Ánh sáng bùng nổ vàng kim dịu mắt
    borderRadius: 20,
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
    flexShrink: 1,
  },
  titlePending: {
    color: '#ffffff',
    textShadowColor: 'rgba(255, 215, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  titleClaimed: {
    color: '#839493',
    textDecorationLine: 'line-through', // Gạch ngang biểu thị xong
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rewardBadgePending: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  rewardBadgeClaimed: {
    backgroundColor: 'rgba(58, 74, 73, 0.05)',
    borderColor: 'rgba(58, 74, 73, 0.15)',
  },
  rewardText: {
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 4,
    fontSize: 13,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    marginLeft: 32, // Đẩy lùi bằng khoảng thụt của icon walking
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  description: {
    color: '#dbe4e3',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  progressSection: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#839493',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF922B',
    borderRadius: 4,
  },
  progressBarFillPending: {
    backgroundColor: '#FFD700',
  },
  progressBarFillClaimed: {
    backgroundColor: '#00fbfb',
  },
  claimBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 18,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  claimBtnText: {
    color: '#0d1515',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#839493',
    fontSize: 16,
    marginTop: 40,
  },
  // Style cho hạt coin bay nổi
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 9999,
  },
  particleGlow: {
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  devToolContainer: {
    paddingBottom: 25,
    paddingTop: 10,
    backgroundColor: '#0d1515',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 146, 43, 0.15)',
  },
  devToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 146, 43, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 146, 43, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  devToolText: {
    color: '#FF922B',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default QuestScreen;
