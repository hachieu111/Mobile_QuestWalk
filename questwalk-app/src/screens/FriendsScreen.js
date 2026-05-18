import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const FriendsScreen = ({ navigation }) => {
  const user = useQuestStore((state) => state.user);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchFriendsAndRequests();
  }, []);

  const getDisplayName = (email) => {
    if (!email) return 'Người chơi';
    return email.split('@')[0];
  };

  const fetchFriendsAndRequests = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // 1. Lấy danh sách bạn bè
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      const friendIds = userSnap.data()?.friendIds || [];

      if (friendIds.length > 0) {
        // Firestore only allows "in" query with max 10 elements
        const qFriends = query(collection(db, 'users'), where('__name__', 'in', friendIds.slice(0, 10)));
        const friendsSnap = await getDocs(qFriends);
        const friendsData = [];
        friendsSnap.forEach(doc => {
          friendsData.push({ id: doc.id, ...doc.data() });
        });
        setFriends(friendsData);
      } else {
        setFriends([]);
      }

      // 2. Lấy lời mời kết bạn đang chờ duyệt
      const qReqs = query(
        collection(db, 'friend_requests'),
        where('receiverId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const reqsSnap = await getDocs(qReqs);
      const reqsData = [];
      reqsSnap.forEach(doc => {
        reqsData.push({ id: doc.id, ...doc.data() });
      });
      setIncomingRequests(reqsData);

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu bạn bè:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchEmail.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập email để tìm kiếm');
      return;
    }
    const cleanEmail = searchEmail.trim().toLowerCase();
    if (cleanEmail === user?.email?.toLowerCase()) {
      Alert.alert('Lỗi', 'Không thể tự gửi lời mời cho chính mình!');
      return;
    }

    setIsSearching(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        Alert.alert('Không tìm thấy', 'Không có người chơi nào sử dụng email này.');
        setIsSearching(false);
        return;
      }

      const targetUserDoc = snap.docs[0];
      const targetUserId = targetUserDoc.id;

      // Kiểm tra xem đã là bạn bè chưa
      const userRef = doc(db, 'users', user?.uid);
      const userSnap = await getDoc(userRef);
      const currentFriends = userSnap.data()?.friendIds || [];

      if (currentFriends.includes(targetUserId)) {
        Alert.alert('Thông báo', 'Người này đã là bạn bè của bạn.');
        setIsSearching(false);
        return;
      }

      // Kiểm tra xem đã có lời mời kết bạn đang chờ chưa
      const qCheckSent = query(
        collection(db, 'friend_requests'),
        where('senderId', '==', user.uid),
        where('receiverId', '==', targetUserId),
        where('status', '==', 'pending')
      );
      const checkSentSnap = await getDocs(qCheckSent);
      if (!checkSentSnap.empty) {
        Alert.alert('Thông báo', 'Bạn đã gửi lời mời kết bạn cho người này rồi.');
        setIsSearching(false);
        return;
      }

      // Tạo lời mời kết bạn
      await addDoc(collection(db, 'friend_requests'), {
        senderId: user?.uid,
        senderEmail: user?.email,
        receiverId: targetUserId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${getDisplayName(cleanEmail)}!`);
      setSearchEmail('');
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi lời mời.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      // 1. Chấp nhận yêu cầu kết bạn
      const reqRef = doc(db, 'friend_requests', request.id);
      await updateDoc(reqRef, { status: 'accepted' });

      // 2. Thêm chéo bạn bè
      const myUserRef = doc(db, 'users', user?.uid);
      await updateDoc(myUserRef, {
        friendIds: arrayUnion(request.senderId)
      });

      const friendUserRef = doc(db, 'users', request.senderId);
      await updateDoc(friendUserRef, {
        friendIds: arrayUnion(user?.uid)
      });

      Alert.alert('Thành công', `Hai bạn đã trở thành bạn bè!`);
      fetchFriendsAndRequests();
    } catch (error) {
      console.error("Lỗi chấp nhận kết bạn:", error);
      Alert.alert('Lỗi', 'Không thể chấp nhận kết bạn.');
    }
  };

  const handleDeclineRequest = async (request) => {
    try {
      const reqRef = doc(db, 'friend_requests', request.id);
      await deleteDoc(reqRef);
      Alert.alert('Thông báo', 'Đã từ chối lời mời kết bạn.');
      fetchFriendsAndRequests();
    } catch (error) {
      console.error("Lỗi từ chối kết bạn:", error);
    }
  };

  const renderFriend = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendCard}
      onPress={() => navigation.navigate('Chat', { friendId: item.id, friendName: getDisplayName(item.email), friendAvatar: item.avatarUrl })}
    >
      <View style={styles.friendInfo}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.email ? item.email.charAt(0).toUpperCase() : 'U'}</Text>
          </View>
        )}
        <View style={styles.details}>
          <Text style={styles.name}>{getDisplayName(item.email)}</Text>
          <Text style={styles.stats}>🏆 LVL {Math.floor((item.totalSteps || 0)/1000) + 1} | 👟 {item.totalSteps || 0} bước</Text>
        </View>
      </View>
      <View style={styles.actionBtn}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#00fbfb" />
      </View>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestLeft}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: '#339AF0' }]}>
          <Text style={styles.avatarText}>{item.senderEmail ? item.senderEmail.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.requestName}>{getDisplayName(item.senderEmail)}</Text>
          <Text style={styles.requestSubtitle}>Muốn kết bạn với bạn</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={[styles.reqBtn, styles.acceptBtn]} onPress={() => handleAcceptRequest(item)}>
          <Ionicons name="checkmark" size={18} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.reqBtn, styles.declineBtn]} onPress={() => handleDeclineRequest(item)}>
          <Ionicons name="close" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hội Thợ Săn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Tìm kiếm & Gửi kết bạn */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>Gửi lời mời kết bạn</Text>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập email người chơi..."
              placeholderTextColor="#839493"
              value={searchEmail}
              onChangeText={setSearchEmail}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleSendRequest} disabled={isSearching}>
              {isSearching ? <ActivityIndicator size="small" color="#00fbfb" /> : <Ionicons name="paper-plane" size={20} color="#00fbfb" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Danh sách lời mời nhận được */}
        {incomingRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={[styles.sectionLabel, { color: '#FF922B' }]}>Lời Mời Kết Bạn ({incomingRequests.length})</Text>
            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderRequest}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Danh sách Bạn bè */}
        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Bạn bè ({friends.length})</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#00fbfb" style={{ marginTop: 20 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={60} color="#3a4a49" />
              <Text style={styles.emptyText}>Bạn chưa có người bạn nào.</Text>
              <Text style={styles.emptySubText}>Gửi lời mời bằng email ở trên để bắt đầu lập hội nhé!</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              renderItem={renderFriend}
              scrollEnabled={false}
            />
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#071010',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 251, 251, 0.1)',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#00fbfb',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 12,
    letterSpacing: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderWidth: 1,
    borderColor: '#3a4a49',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    marginRight: 10,
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderWidth: 1,
    borderColor: '#00fbfb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 251, 251, 0.1)',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 146, 43, 0.1)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 146, 43, 0.3)',
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
  },
  requestSubtitle: {
    fontSize: 12,
    color: '#ADB5BD',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reqBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#2B8A3E',
  },
  declineBtn: {
    backgroundColor: '#E03131',
  },
  listSection: {
    flex: 1,
    padding: 20,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.1)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#3a4a49',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3a4a49',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  details: {
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dbe4e3',
    marginBottom: 4,
  },
  stats: {
    fontSize: 12,
    color: '#839493',
    fontFamily: 'monospace',
  },
  actionBtn: {
    padding: 10,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    borderRadius: 12,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#839493',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: '#3a4a49',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  }
});

export default FriendsScreen;
