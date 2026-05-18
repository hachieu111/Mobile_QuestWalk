import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';

const ARCheckInScreen = ({ route, navigation }) => {
  const { quest } = route.params;
  const user = useQuestStore((state) => state.user);
  const { setCoinBalance } = useQuestStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

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

  const handleCapture = async () => {
    setIsCapturing(true);
    
    // Giả lập hiệu ứng chụp ảnh mất 1 giây
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

        // Cộng xu vào ví
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          coinBalance: increment(quest.coinReward),
          totalBadges: increment(1)
        }, { merge: true });

        // Tự động update coin cục bộ (nếu backend đồng bộ chậm, nhưng UI sẽ tự kéo lại sớm)
        const questStoreState = useQuestStore.getState();
        setCoinBalance(questStoreState.coinBalance + quest.coinReward);

        Alert.alert(
          '🎉 Check-in Thành Công!',
          `Tuyệt vời! Bạn đã nhận được Huy hiệu "${quest.badgeName}" và ${quest.coinReward} Xu!`,
          [{ text: 'Về Bản Đồ', onPress: () => navigation.goBack() }]
        );
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
  }
});

export default ARCheckInScreen;
