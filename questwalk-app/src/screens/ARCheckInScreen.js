import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Animated, 
  Dimensions 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';

const { width, height } = Dimensions.get('window');
const TARGET_X = width - 75; // Vị trí X của cụm hiển thị Xu ở góc phải
const TARGET_Y = 65;         // Vị trí Y của cụm hiển thị Xu ở góc phải

const ARCheckInScreen = ({ route, navigation }) => {
  const { quest } = route.params;
  const user = useQuestStore((state) => state.user);
  const { coinBalance, setCoinBalance } = useQuestStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Trạng thái hạt coin bay nổi
  const [particles, setParticles] = useState([]);
  const coinScaleAnim = useRef(new Animated.Value(1)).current;

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>App cần quyền sử dụng Camera để AR Check-in</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cấp Quyền Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hoạt ảnh nổ sao và bay lượn ngập tràn rực rỡ
  const playClaimAnimation = (rewardAmount) => {
    const newParticles = Array.from({ length: 12 }).map((_, index) => {
      return {
        id: index,
        position: new Animated.ValueXY({ x: width / 2, y: height / 2 }),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(0.5),
      };
    });

    setParticles(newParticles);

    const animations = newParticles.map((particle, index) => {
      const angle = (index / 12) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const radius = 60 + Math.random() * 50;
      const explodeX = width / 2 + Math.cos(angle) * radius;
      const explodeY = (height / 2) + Math.sin(angle) * radius;
      const delay = index * 40;

      return Animated.sequence([
        // 1. Nổ tung tròn từ tâm hologram
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
        // Trễ nhịp bay
        Animated.delay(delay),
        // 2. Thu hút bay thẳng lên rương xu góc trên phải
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

    Animated.parallel(animations).start(() => {
      setParticles([]);

      // Hiệu ứng Pulse nhẹ cho hòm xu khi nhận sao thành công
      Animated.sequence([
        Animated.timing(coinScaleAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(coinScaleAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ]).start();

      // Cập nhật số ví local sau khi bay xong
      const questStoreState = useQuestStore.getState();
      setCoinBalance(questStoreState.coinBalance + rewardAmount);

      // Hiển thị thông báo thành công sau cùng cực kỳ hợp lý
      Alert.alert(
        '🎉 Check-in Thành Công!',
        `Tuyệt vời! Bạn đã nhận được Huy hiệu "${quest.badgeName}" và ${rewardAmount} Xu!`,
        [{ text: 'Về Bản Đồ', onPress: () => navigation.goBack() }]
      );
    });
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    
    // Giả lập hiệu ứng chụp ảnh check-in ảo mất 1.5 giây
    setTimeout(async () => {
      try {
        if (!user?.uid) return;

        // Lưu huy hiệu vào bảng badges của user
        const badgeRef = doc(db, `users/${user.uid}/badges`, quest.id);
        await setDoc(badgeRef, {
          questId: quest.id,
          badgeName: quest.badgeName,
          badgeRewardId: quest.badgeReward,
          earnedAt: serverTimestamp(),
        });

        // Cộng xu trên server Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          coinBalance: increment(quest.coinReward),
          totalBadges: increment(1)
        }, { merge: true });

        // Chạy hiệu ứng bay tiền bùng nổ đẹp đẽ
        playClaimAnimation(quest.coinReward);

      } catch (error) {
        console.error("Lỗi khi save badge:", error);
        Alert.alert("Lỗi", "Không thể lưu kết quả. Vui lòng thử lại.");
        setIsCapturing(false);
      }
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        
        {/* Nút Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={32} color="#FFF" />
        </TouchableOpacity>

        {/* Floating Coin Container (Góc trên phải) */}
        <Animated.View style={[styles.coinHeaderContainer, { transform: [{ scale: coinScaleAnim }] }]}>
          <Ionicons name="star" size={16} color="#FFD700" style={{ marginRight: 4 }} />
          <Text style={styles.coinText}>{coinBalance} Xu</Text>
        </Animated.View>

        {/* Lớp phủ AR ảo diệu */}
        <View style={styles.arOverlay}>
          <View style={styles.badgeHologram}>
            <Ionicons name="medal" size={80} color="#FCC419" />
            <Text style={styles.hologramTitle}>{quest.badgeName}</Text>
            <Text style={styles.hologramDesc}>Cách bạn 0 mét</Text>
          </View>
        </View>

        {/* Nút Chụp Check-in */}
        <View style={styles.bottomControls}>
          <Text style={styles.instruction}>Căn chỉnh vật thể vào khung hình và bấm nút</Text>
          <TouchableOpacity 
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]} 
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#00fbfb" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
        </View>
      </CameraView>

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
    backgroundColor: '#0d1515'
  },
  text: {
    color: '#FFF',
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)'
  },
  buttonText: {
    color: '#00fbfb',
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 4,
  },
  coinHeaderContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 21, 21, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  coinText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  arOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeHologram: {
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderWidth: 2,
    borderColor: '#00fbfb',
    borderRadius: 100,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  hologramTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0, 251, 251, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  hologramDesc: {
    color: '#00fbfb',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomControls: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  instruction: {
    color: '#00fbfb',
    fontSize: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
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
});

export default ARCheckInScreen;
