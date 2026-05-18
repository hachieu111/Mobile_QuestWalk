import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, Animated, Dimensions } from 'react-native';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const LeaderboardScreen = () => {
  const user = useQuestStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // Hàm lấy tên thật hoặc hiển thị mặc định bằng Email
  const getRealName = (userData) => {
    return userData?.name || userData?.displayName || userData?.fullName || userData?.email?.split('@')[0] || 'Người chơi';
  };

  // --- ANIMATIONS ---
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hiệu ứng "nhịp thở" (Pulse & Glow) cho Top 1
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
        ])
      ])
    ).start();

    // Hiệu ứng hạt lơ lửng (Floating Particles)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, { toValue: -15, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim1, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, { toValue: 15, duration: 2500, useNativeDriver: true }),
        Animated.timing(floatAnim2, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    // Real-time Leaderboard
    const q = query(collection(db, 'users'), orderBy('totalSteps', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data()
      }));
      setLeaderboard(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi khi fetch bảng xếp hạng:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00fbfb" />
        <Text style={styles.loadingText}>ĐANG TRUY XUẤT DỮ LIỆU...</Text>
      </View>
    );
  }

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const others = leaderboard.slice(3);

  const renderAvatar = (userData, size, style, fallbackColor) => {
    if (userData?.avatarUrl) {
      return <Image source={{ uri: userData.avatarUrl }} style={[styles.avatarBase, { width: size, height: size }, style]} />;
    }
    const name = getRealName(userData);
    return (
      <View style={[styles.avatarBase, styles.avatarFallback, { width: size, height: size, backgroundColor: fallbackColor }, style]}>
        <Text style={{ color: '#fff', fontSize: size / 2.5, fontWeight: 'bold' }}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderPodiumAvatar = (userData, size, rankColor, rankNumber) => {
    return (
      <View style={styles.avatarWrapper}>
        {renderAvatar(userData, size, { borderColor: rankColor, borderWidth: rankNumber === 1 ? 4 : 3 }, '#151d1d')}
        <View style={[styles.rankBadge, { borderColor: rankColor }]}>
          <Text style={[styles.rankBadgeText, { color: rankColor }]}>#{rankNumber}</Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      
      {/* --- TOP APP BAR --- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="leaderboard" size={28} color="#00fbfb" />
          <Text style={styles.headerTitle}>BẢNG XẾP HẠNG</Text>
        </View>
        {renderAvatar(user, 40, styles.myHeaderAvatar, '#2e3636')}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* --- GRAND PODIUM (TOP 3) --- */}
        <View style={styles.podiumSection}>
          
          {/* ELIP HÀO QUANG NỀN - FIX FULL MÀN HÌNH */}
          <View style={styles.podiumGlowBg} />

          <View style={[styles.podiumItem, { paddingBottom: 20 }]}>
            {top2 && (
              <>
                {renderPodiumAvatar(top2, 80, '#C0C0C0', 2)}
                <Text style={styles.podiumName} numberOfLines={1}>{getRealName(top2)}</Text>
                
                {/* FIX ICON LỬA BẰNG CLASS SCORE PILL CHUẨN */}
                <View style={styles.scorePill}>
                  <Ionicons name="water" size={14} color="#00fbfb" style={{ marginRight: 6 }} />
                  <Text style={styles.podiumScore}>{top2.totalSteps?.toLocaleString('vi-VN')}</Text>
                </View>
              </>
            )}
          </View>

          {/* TOP 1 (GOLD) - KẺ THỐNG TRỊ */}
          <Animated.View style={[styles.podiumItem, styles.top1Wrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View style={[styles.particle, { top: '5%', left: '-10%', transform: [{ translateY: floatAnim1 }] }]} />
            <Animated.View style={[styles.particle, { top: '25%', right: '-10%', transform: [{ translateY: floatAnim2 }] }]} />
            
            <Ionicons name="trophy" size={40} color="#FFD700" style={styles.crownIcon} />
            
            <View style={styles.avatarWrapper}>
              <Animated.View style={[styles.goldAura, { opacity: glowAnim }]} />
              {renderPodiumAvatar(top1, 106, '#FFD700', 1)}
            </View>
            
            <Text style={[styles.podiumName, styles.top1Name]} numberOfLines={1}>{getRealName(top1)}</Text>
            
            <View style={[styles.scorePill, styles.scorePillTop1]}>
              <Ionicons name="flame" size={16} color="#FFD700" style={{ marginRight: 6 }} />
              <Text style={[styles.podiumScore, styles.top1Score]}>{top1?.totalSteps?.toLocaleString('vi-VN')}</Text>
            </View>
          </Animated.View>

          {/* TOP 3 (BRONZE) */}
          <View style={[styles.podiumItem, { paddingBottom: 10 }]}>
            {top3 && (
              <>
                {renderPodiumAvatar(top3, 70, '#CD7F32', 3)}
                <Text style={styles.podiumName} numberOfLines={1}>{getRealName(top3)}</Text>
                
                <View style={styles.scorePill}>
                  <Ionicons name="water" size={14} color="#00fbfb" style={{ marginRight: 6 }} />
                  <Text style={styles.podiumScore}>{top3.totalSteps?.toLocaleString('vi-VN')}</Text>
                </View>
              </>
            )}
          </View>

        </View>

        {/* --- CONTENDERS LIST (TOP 4+) --- */}
        <View style={styles.listSection}>
          {others.map((item) => {
            const isMe = item.id === user?.uid;

            return (
              <View key={item.id} style={[styles.glassCard, isMe && styles.highlightRow]}>
                <View style={styles.listLeft}>
                  <Text style={[styles.listRank, isMe && styles.textGlowCyan]}>{item.rank}</Text>
                  
                  {renderAvatar(item, 44, isMe ? styles.myListAvatar : styles.normalListAvatar, '#151d1d')}
                  
                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, isMe && styles.myNameText]}>
                      {isMe ? 'Bạn' : getRealName(item)}
                    </Text>
                    {isMe && <Text style={styles.climbingText}>CLIMBING</Text>}
                  </View>
                </View>

                <View style={styles.listRight}>
                  <Text style={[styles.listScore, isMe && styles.textGlowCyan]}>
                    {item.totalSteps?.toLocaleString('vi-VN') || 0}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1515',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0d1515',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#00fbfb',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  myHeaderAvatar: {
    borderWidth: 2,
    borderColor: '#00fbfb',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 330,
    paddingHorizontal: 10,
    marginTop: 10,
    zIndex: 10,
  },
  /* FIX HÀO QUANG ELIP FULL MÀN HÌNH */
  podiumGlowBg: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    width: width * 2, // Mở rộng gấp đôi màn hình
    height: width * 1.5,
    borderRadius: width, // Bo tròn tuyệt đối thành hình elip
    backgroundColor: 'rgba(0, 251, 251, 0.08)',
    transform: [{ scaleY: 0.6 }], // Ép dẹt thành hình Oval
    zIndex: 0,
  },
  podiumItem: {
    alignItems: 'center',
    width: '30%',
    marginHorizontal: 4,
    zIndex: 10,
  },
  top1Wrapper: {
    width: '36%',
    paddingBottom: 40,
    zIndex: 20,
  },
  crownIcon: {
    position: 'absolute',
    top: -38,
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    zIndex: 30,
  },
  avatarWrapper: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatarBase: {
    borderRadius: 100,
    resizeMode: 'cover',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldAura: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#071010',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 5,
  },
  rankBadgeTop1: {
    bottom: -12,
    paddingHorizontal: 14,
    paddingVertical: 3,
    backgroundColor: '#071010',
  },
  rankBadgeText: {
    fontWeight: '900',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  podiumName: {
    color: '#dbe4e3',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  top1Name: {
    fontSize: 18,
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  /* FIX FLEX-DIRECTION ROW CHO NÚT ĐIỂM SỐ */
  scorePill: {
    flexDirection: 'row', // Chắc chắn xếp ngang
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 31, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    minWidth: 70, // Giữ độ rộng tối thiểu
  },
  scorePillTop1: {
    borderColor: 'rgba(255, 215, 0, 0.5)',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  podiumScore: {
    color: '#00fbfb',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  top1Score: {
    color: '#FFD700',
    fontSize: 14,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
    zIndex: 40,
  },
  listSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  glassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderColor: 'rgba(0, 251, 251, 0.1)',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  highlightRow: {
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#00fbfb',
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listRank: {
    width: 28,
    fontSize: 18,
    fontWeight: '900',
    color: '#839493',
    textAlign: 'center',
  },
  normalListAvatar: {
    borderWidth: 1,
    borderColor: '#3a4a49',
  },
  myListAvatar: {
    borderWidth: 2,
    borderColor: '#00fbfb',
  },
  listInfo: {
    justifyContent: 'center',
  },
  listName: {
    fontSize: 15,
    color: '#dbe4e3',
    fontWeight: '600',
  },
  myNameText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 251, 251, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  climbingText: {
    fontSize: 10,
    color: '#00fbfb',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1515',
    borderColor: 'rgba(0, 251, 251, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: {
    color: '#00fbfb',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  listScore: {
    fontSize: 15,
    color: '#00fbfb',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    minWidth: 50,
    textAlign: 'right',
  },
  textGlowCyan: {
    color: '#00fbfb',
    textShadowColor: 'rgba(0, 251, 251, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  }
});

export default LeaderboardScreen;