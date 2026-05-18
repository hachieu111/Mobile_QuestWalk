import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Image, ScrollView } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useFocusEffect } from '@react-navigation/native';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import useQuestStore from '../store/useQuestStore';
import api from '../services/api';
import { db } from '../services/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';

const HomeScreen = ({ navigation }) => {
  const { user, totalSteps, currentStepCount, coinBalance, avatarUrl, setTotalSteps, setCurrentStepCount, addSteps, setCoinBalance, setAvatarUrl } = useQuestStore();
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [isSyncing, setIsSyncing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [badgeCount, setBadgeCount] = useState(0);
  const subscriptionRef = React.useRef(null);
  const lastPedometerStepsRef = React.useRef(0);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.coinBalance !== undefined) setCoinBalance(data.coinBalance);
            if (data.totalSteps !== undefined) setTotalSteps(data.totalSteps);
            if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
          }
        } catch (error) {
          console.error("Lỗi khi fetch user data:", error);
        }
      }
    };
    fetchUserData();
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        getDocs(collection(db, `users/${user.uid}/badges`))
          .then(snap => setBadgeCount(snap.size))
          .catch(err => console.error(err));
      }
    }, [user])
  );

  const checkPermissionAndSubscribe = async () => {
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      setPermissionStatus(status);

      if (status === 'granted') {
        const isAvailable = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(String(isAvailable));

        if (isAvailable) {
          if (subscriptionRef.current) {
            subscriptionRef.current.remove();
          }
          lastPedometerStepsRef.current = 0;
          subscriptionRef.current = Pedometer.watchStepCount((result) => {
            const delta = result.steps - lastPedometerStepsRef.current;
            lastPedometerStepsRef.current = result.steps;
            if (delta > 0) {
              addSteps(delta);
            }
          });
        }
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    checkPermissionAndSubscribe();
    return () => {
      if (subscriptionRef.current && subscriptionRef.current.remove) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  const handleSyncSteps = async () => {
    if (!user || !user.uid) return;
    const stepsToSync = currentStepCount;
    if (stepsToSync === 0) return;

    // 1. Phản hồi giao diện tức thì trong 0ms (Optimistic Update)
    const expectedNewTotal = totalSteps + stepsToSync;
    setTotalSteps(expectedNewTotal);
    setCurrentStepCount(0);
    setIsSyncing(true);

    // 2. Chạy API đồng bộ ngầm dưới background
    try {
      const response = await api.post('/api/sync-steps', {
        userId: user.uid,
        steps: stepsToSync,
      });

      if (response.data) {
        if (response.data.coinBalance !== undefined) setCoinBalance(response.data.coinBalance);
        if (response.data.totalSteps !== undefined) setTotalSteps(response.data.totalSteps);
      }
    } catch (error) {
      console.error("Lỗi đồng bộ ngầm:", error);
      // Hoàn tác lại (Rollback) số bước local để người dùng không bị mất bước đi bộ nếu mất mạng hoàn toàn
      setCurrentStepCount(stepsToSync);
      setTotalSteps(expectedNewTotal - stepsToSync);
      Alert.alert('Đồng bộ thất bại', 'Kết nối mạng không ổn định. Vui lòng nhấn thử lại.');
    } finally {
      setIsSyncing(false);
    }
  };

  const displaySteps = totalSteps + currentStepCount;

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>Xin chào Thợ săn,</Text>
            <Text style={styles.userEmailText}>{user?.email?.split('@')[0] || 'User'}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.coinContainer}>
            <Ionicons name="star" size={16} color="#E67700" style={{ marginRight: 4 }} />
            <Text style={styles.coinText}>{coinBalance} Xu</Text>
          </View>
          <TouchableOpacity 
            style={styles.friendsBtn}
            onPress={() => navigation.navigate('Friends')}
          >
            <Ionicons name="people" size={24} color="#00fbfb" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Banner Chính */}
        <TouchableOpacity 
          style={styles.heroCard}
          onPress={() => navigation.navigate('Explore')}
        >
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Sẵn sàng Khám phá?</Text>
            <Text style={styles.heroSubtitle}>Bật GPS và săn các rương kho báu ẩn giấu xung quanh bạn ngay hôm nay!</Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Mở Bản Đồ GPS</Text>
              <Ionicons name="arrow-forward" size={16} color="#00fbfb" />
            </View>
          </View>
          <Ionicons name="map" size={100} color="rgba(255,255,255,0.2)" style={styles.heroIcon} />
        </TouchableOpacity>

        {/* Thống kê nhanh */}
        <Text style={styles.sectionTitle}>Chỉ số Game của bạn</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(64, 192, 87, 0.1)' }]}>
              <Ionicons name="footsteps" size={28} color="#40C057" />
            </View>
            <Text style={styles.statValue}>{displaySteps}</Text>
            <Text style={styles.statLabel}>Bước chân</Text>
            
            {currentStepCount > 0 ? (
              <TouchableOpacity 
                style={styles.smallSyncBtn} 
                onPress={handleSyncSteps}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#00fbfb" />
                ) : (
                  <>
                    <Ionicons name="sync-outline" size={12} color="#00fbfb" style={styles.syncIcon} />
                    <Text style={styles.syncBtnText}>Đồng bộ (+{currentStepCount})</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.syncedBadge}>
                <Ionicons name="checkmark-circle-outline" size={12} color="#839493" style={styles.syncIcon} />
                <Text style={styles.syncedText}>Đã đồng bộ</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Profile')}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
              <Ionicons name="medal" size={28} color="#FFD700" />
            </View>
            <Text style={styles.statValue}>{badgeCount}</Text>
            <Text style={styles.statLabel}>Huy hiệu AR</Text>
            <Text style={[styles.syncHint, { color: '#3a4a49' }]}>Bộ sưu tập</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Tính năng */}
        <Text style={styles.sectionTitle}>Tính năng Nổi bật</Text>
        <View style={styles.featuresGrid}>
          <TouchableOpacity style={styles.featureItem} onPress={() => navigation.navigate('Explore')}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(0, 251, 251, 0.15)' }]}>
              <Ionicons name="add-circle" size={32} color="#00fbfb" />
            </View>
            <Text style={styles.featureText}>Tạo Quest cho Bạn bè</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.featureItem} onPress={() => navigation.navigate('Analytics')}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
              <Ionicons name="podium" size={32} color="#FFD700" />
            </View>
            <Text style={styles.featureText}>Bảng xếp hạng</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.featureItem} onPress={() => navigation.navigate('Store')}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(0, 251, 251, 0.15)' }]}>
              <Ionicons name="ticket" size={32} color="#00fbfb" />
            </View>
            <Text style={styles.featureText}>Đổi Voucher</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Floating Quest Button (RPG game style) */}
      <TouchableOpacity 
        style={styles.floatingQuestBtn}
        onPress={() => navigation.navigate('Quest')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#1c2929', '#0d1515']}
          style={styles.floatingQuestGradient}
        >
          <Ionicons name="trophy" size={26} color="#FFD700" style={styles.floatingQuestIcon} />
          {/* Active indicator dot */}
          <View style={styles.floatingQuestBadge} />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1515',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00fbfb',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#151d1d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00fbfb',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 13,
    color: '#839493',
  },
  userEmailText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  },
  coinText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  friendsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  heroCard: {
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  heroContent: {
    zIndex: 2,
    width: '80%',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00fbfb',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 251, 251, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#dbe4e3',
    lineHeight: 20,
    marginBottom: 16,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
  },
  heroButtonText: {
    color: '#00fbfb',
    fontWeight: 'bold',
    marginRight: 8,
  },
  heroIcon: {
    position: 'absolute',
    right: -15,
    bottom: -15,
    zIndex: 1,
    transform: [{ rotate: '-15deg' }]
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.15)',
  },
  statIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 14,
    color: '#839493',
    marginTop: 4,
  },
  smallSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 10,
    shadowColor: '#00fbfb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  syncBtnText: {
    color: '#00fbfb',
    fontSize: 11,
    fontWeight: 'bold',
  },
  syncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58, 74, 73, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 73, 0.2)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  syncedText: {
    color: '#839493',
    fontSize: 11,
    fontWeight: '600',
  },
  syncIcon: {
    marginRight: 4,
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '31%',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.1)',
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dbe4e3',
    textAlign: 'center',
    lineHeight: 18,
  },
  floatingQuestBtn: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#0d1515',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  floatingQuestGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingQuestIcon: {
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  floatingQuestBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#0d1515',
  }
});

export default HomeScreen;
