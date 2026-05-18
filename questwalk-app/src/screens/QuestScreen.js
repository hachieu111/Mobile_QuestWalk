import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const QuestScreen = () => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const totalSteps = useQuestStore((state) => state.totalSteps);

  useEffect(() => {
    const fetchQuests = async () => {
      try {
        let querySnapshot = await getDocs(collection(db, 'quests'));
        
        // Tự động tạo dữ liệu mẫu nếu collection trống
        if (querySnapshot.empty) {
          const dummyQuests = [
            { title: 'Khởi động ngày mới', targetSteps: 1000, rewardCoins: 50, description: 'Đi bộ 1000 bước để làm nóng cơ thể.' },
            { title: 'Chinh phục 5000 bước', targetSteps: 5000, rewardCoins: 200, description: 'Đi bộ 5000 bước để nâng cao sức khỏe.' },
            { title: 'Chiến thần marathon', targetSteps: 10000, rewardCoins: 500, description: 'Hoàn thành 10000 bước trong ngày hôm nay.' }
          ];
          for (const q of dummyQuests) {
            await addDoc(collection(db, 'quests'), q);
          }
          // Fetch lại sau khi tạo
          querySnapshot = await getDocs(collection(db, 'quests'));
        }

        const questList = [];
        querySnapshot.forEach((doc) => {
          questList.push({ id: doc.id, ...doc.data() });
        });
        
        // Sắp xếp nhiệm vụ: Chưa hoàn thành lên trước, Hoàn thành xuống dưới, sau đó theo targetSteps
        questList.sort((a, b) => {
          const aCompleted = totalSteps >= a.targetSteps;
          const bCompleted = totalSteps >= b.targetSteps;
          if (aCompleted === bCompleted) {
            return a.targetSteps - b.targetSteps;
          }
          return aCompleted ? 1 : -1;
        });

        setQuests(questList);
      } catch (error) {
        console.error("Error fetching quests:", error);
        Alert.alert('Lỗi', 'Không thể tải danh sách nhiệm vụ.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuests();
  }, [totalSteps]);

  const renderQuestCard = ({ item }) => {
    // Ép kiểu đảm bảo targetSteps hợp lệ
    const target = item.targetSteps || 1;
    const isCompleted = totalSteps >= target;
    const progressPercent = Math.min((totalSteps / target) * 100, 100);

    return (
      <View style={[styles.card, isCompleted ? styles.cardCompleted : styles.cardInProgress]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Ionicons 
              name={isCompleted ? "checkmark-circle" : "walk"} 
              size={24} 
              color={isCompleted ? "#00fbfb" : "#FFD700"} 
            />
            <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
              {item.title}
            </Text>
          </View>
          <View style={styles.rewardBadge}>
            <Ionicons name="star" size={16} color="#FCC419" />
            <Text style={styles.rewardText}>+{item.rewardCoins || item.reward}</Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Tiến độ</Text>
            <Text style={styles.progressValue}>
              {totalSteps} / {target} bước
            </Text>
          </View>
          
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${progressPercent}%` },
                isCompleted && styles.progressBarFillCompleted
              ]} 
            />
          </View>
        </View>
      </View>
    );
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhiệm Vụ Thử Thách</Text>
        <Text style={styles.headerSubtitle}>Vượt qua giới hạn bản thân mỗi ngày!</Text>
      </View>

      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Hiện tại không có nhiệm vụ nào.</Text>
        }
      />
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
    padding: 24,
    paddingTop: 60,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00fbfb',
    textShadowColor: 'rgba(0, 251, 251, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#dbe4e3',
    marginTop: 4,
  },
  listContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.1)',
  },
  cardInProgress: {
    borderLeftColor: '#FFD700',
  },
  cardCompleted: {
    borderLeftColor: '#00fbfb',
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
    flexShrink: 1,
  },
  titleCompleted: {
    color: '#00fbfb',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  rewardText: {
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 4,
    fontSize: 14,
  },
  description: {
    color: '#dbe4e3',
    fontSize: 15,
    marginBottom: 16,
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00fbfb',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 5,
  },
  progressBarFillCompleted: {
    backgroundColor: '#00fbfb',
  },
  emptyText: {
    textAlign: 'center',
    color: '#839493',
    fontSize: 16,
    marginTop: 40,
  },
});

export default QuestScreen;
