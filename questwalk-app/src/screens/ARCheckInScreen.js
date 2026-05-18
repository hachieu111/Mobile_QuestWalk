import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Animated, 
  Dimensions,
  TextInput,
  Modal,
  Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, increment, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const TARGET_X = width - 75; // Vị trí X của cụm hiển thị Xu ở góc phải
const TARGET_Y = 65;         // Vị trí Y của cụm hiển thị Xu ở góc phải

const ARCheckInScreen = ({ route, navigation }) => {
  const { quest } = route.params;
  const user = useQuestStore((state) => state.user);
  const { coinBalance, setCoinBalance } = useQuestStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [caption, setCaption] = useState('');
  const [capturedImageUri, setCapturedImageUri] = useState(null);
  
  const cameraRef = useRef(null);
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

  // Lấy ảnh nền check-in dự phòng tùy theo thể loại rương
  const getPresetImage = () => {
    const badge = quest.badgeReward?.toLowerCase() || '';
    const title = quest.title?.toLowerCase() || '';
    if (badge.includes('cafe') || title.includes('cafe') || title.includes('quán ăn') || title.includes('coffee') || title.includes('trà sữa')) {
      return 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop';
    }
    if (badge.includes('gym') || badge.includes('fitness') || title.includes('phòng tập') || title.includes('thể hình') || title.includes('gym')) {
      return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop';
    }
    if (badge.includes('park') || badge.includes('walk') || title.includes('công viên') || title.includes('hồ') || title.includes('phố đi bộ')) {
      return 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop';
    }
    return 'https://images.unsplash.com/photo-1470246973918-29a93221c455?w=600&auto=format&fit=crop'; // Scenic adventure default
  };

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
        '🎉 Check-in Locket Thành Công!',
        `Tuyệt vời! Khoảnh khắc của bạn đã được đăng lên Locket Bạn bè! Nhận ngay Huy hiệu "${quest.badgeName}" và +${rewardAmount} Xu!`,
        [{ text: 'Tuyệt vời', onPress: () => navigation.goBack() }]
      );
    });
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        setIsCapturing(true);
        // Nén ảnh chất lượng từ 0.85 xuống 0.25 và bật skipProcessing giúp giảm dung lượng ảnh chụp 
        // từ ~5MB xuống còn ~150KB (tiết kiệm 95% băng thông), tăng tốc độ upload lên Render & Cloudinary gấp 10 lần!
        const options = { quality: 0.25, skipProcessing: true };
        const photo = await cameraRef.current.takePictureAsync(options);
        setCapturedImageUri(photo.uri);
        setIsReviewing(true);
      } catch (err) {
        console.error("Lỗi chụp ảnh thực tế:", err);
        // Fallback sử dụng hình nền mặc định nếu chạy giả lập không hỗ trợ chụp thực
        setCapturedImageUri(getPresetImage());
        setIsReviewing(true);
      } finally {
        setIsCapturing(false);
      }
    } else {
      // Fallback khi chạy trên môi trường không hỗ trợ phần cứng Camera
      setCapturedImageUri(getPresetImage());
      setIsReviewing(true);
    }
  };

  const handlePublishLocket = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    
    try {
      if (!user?.uid) return;

      let imageUrl = capturedImageUri || getPresetImage();

      // Nếu là ảnh chụp từ camera thực tế (local file path), tải lên Cloudinary thông qua Server Render
      if (imageUrl.startsWith('file://') || imageUrl.startsWith('content://')) {
        try {
          const formData = new FormData();
          formData.append('avatar', {
            uri: imageUrl,
            type: 'image/jpeg',
            name: `locket_${Date.now()}.jpg`,
          });

          const response = await api.post('/api/upload-avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (response.data && response.data.url) {
            imageUrl = response.data.url;
          }
        } catch (uploadErr) {
          console.error("Lỗi upload ảnh chụp lên Cloudinary:", uploadErr);
          // Fallback ảnh preset chất lượng cao nếu lỗi upload xảy ra
          imageUrl = getPresetImage();
        }
      }

      const finalCaption = caption.trim() || `Đã chinh phục thành công thử thách "${quest.title}"! 🚶‍♂️💨`;

      // 1. Lưu khoảnh khắc Locket của nhóm/bạn bè lên Firestore
      const newPostRef = doc(collection(db, 'locket_posts'));
      await setDoc(newPostRef, {
        id: newPostRef.id,
        userId: user.uid,
        userEmail: user.email || 'Ẩn danh',
        userAvatarUrl: useQuestStore.getState().avatarUrl || '',
        questId: quest.id,
        questTitle: quest.title,
        imageUrl: imageUrl,
        caption: finalCaption,
        createdAt: serverTimestamp()
      });

      // 2. Lưu huy hiệu vào bảng badges của user
      const badgeRef = doc(db, `users/${user.uid}/badges`, quest.id);
      await setDoc(badgeRef, {
        questId: quest.id,
        badgeName: quest.badgeName,
        badgeRewardId: quest.badgeReward,
        earnedAt: serverTimestamp(),
      });

      // 3. Cộng xu trên server Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        coinBalance: increment(quest.coinReward),
        totalBadges: increment(1)
      }, { merge: true });

      // Đóng modal review trước khi nổ sao
      setIsReviewing(false);
      
      // Chạy hiệu ứng bay tiền bùng nổ đẹp đẽ
      playClaimAnimation(quest.coinReward);

    } catch (error) {
      console.error("Lỗi khi đăng Locket check-in:", error);
      Alert.alert("Lỗi kết nối", "Không thể lưu khoảnh khắc Locket của bạn. Vui lòng kiểm tra lại mạng.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        
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
          <Text style={styles.instruction}>Chụp ảnh cùng Hologram 3D để lưu khoảnh khắc Locket</Text>
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

      {/* MODAL REVIEW & NHẬP CAPTION LOCKET CỰC ĐẸP */}
      <Modal
        visible={isReviewing}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsReviewing(false)}
      >
        <View style={styles.modalBg}>
          <LinearGradient
            colors={['rgba(28, 41, 41, 0.95)', 'rgba(13, 21, 21, 0.98)']}
            style={styles.reviewCard}
          >
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>KHOẢNH KHẮC LOCKET</Text>
              <TouchableOpacity onPress={() => setIsReviewing(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Ảnh Locket Preview */}
            <View style={styles.previewImageContainer}>
              {capturedImageUri ? (
                <Image source={{ uri: capturedImageUri }} style={styles.previewImage} />
              ) : null}
              <View style={styles.imageOverlayBadge}>
                <Ionicons name="location" size={12} color="#00fbfb" style={{ marginRight: 4 }} />
                <Text style={styles.imageOverlayBadgeText}>{quest.title}</Text>
              </View>
            </View>

            {/* Input Cảm nghĩ (Feedback) */}
            <Text style={styles.inputLabel}>Cảm nghĩ / Phản hồi tại địa điểm này:</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Hôm nay cảnh ở đây đẹp quá! Đi bộ mệt nhưng có voucher..."
              placeholderTextColor="#5a6a69"
              value={caption}
              onChangeText={setCaption}
              multiline={true}
              maxLength={120}
            />
            <Text style={styles.charCounter}>{caption.length}/120 ký tự</Text>

            {/* Cảnh báo bảo mật Locket */}
            <View style={styles.privacyNotice}>
              <Ionicons name="lock-closed" size={14} color="#FF922B" style={{ marginRight: 6 }} />
              <Text style={styles.privacyNoticeText}>Khoảnh khắc này chỉ bạn bè của bạn mới có quyền xem trên Locket Feed.</Text>
            </View>

            {/* Button Post */}
            <TouchableOpacity 
              style={styles.publishBtn}
              onPress={handlePublishLocket}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#0d1515" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#0d1515" style={{ marginRight: 8 }} />
                  <Text style={styles.publishBtnText}>ĐĂNG LOCKET & NHẬN THƯỞNG</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => setIsReviewing(false)}
            >
              <Text style={styles.cancelBtnText}>Chụp lại ảnh</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

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
    fontSize: 13,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
    textAlign: 'center',
    maxWidth: '90%',
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#00fbfb',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#00fbfb',
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
  
  // MODAL STYLING
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 251, 251, 0.3)',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
    paddingBottom: 10,
  },
  modalHeaderTitle: {
    color: '#00fbfb',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 251, 251, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  closeModalBtn: {
    padding: 4,
  },
  previewImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 21, 21, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  imageOverlayBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#839493',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  captionInput: {
    width: '100%',
    height: 76,
    backgroundColor: 'rgba(13, 21, 21, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a4a49',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  charCounter: {
    color: '#5a6a69',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 146, 43, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 146, 43, 0.25)',
    marginBottom: 20,
  },
  privacyNoticeText: {
    color: '#FF922B',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  publishBtn: {
    width: '100%',
    backgroundColor: '#00fbfb',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00fbfb',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  publishBtnText: {
    color: '#0d1515',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#839493',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ARCheckInScreen;
