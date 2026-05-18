import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChatScreen = ({ route, navigation }) => {
  const { friendId, friendName, friendAvatar } = route.params;
  const user = useQuestStore((state) => state.user);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const insets = useSafeAreaInsets();

  // Tạo Chat ID duy nhất cho 2 người (sắp xếp ID để luôn giống nhau)
  const chatId = user?.uid ? (user.uid < friendId ? `${user.uid}_${friendId}` : `${friendId}_${user.uid}`) : '';

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
        };
      });
      // Sắp xếp tin nhắn theo thời gian giảm dần (FlatList inverted cần tin nhắn mới nhất nằm đầu mảng)
      msgs.sort((a, b) => b.createdAt - a.createdAt);
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const msgText = inputText.trim();
    setInputText(''); // Xóa ô nhập ngay lập tức để UX mượt

    try {
      await addDoc(collection(db, 'messages'), {
        chatId,
        text: msgText,
        senderId: user?.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      setInputText(msgText); // Phục hồi nếu lỗi
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === user?.uid;
    const isLocation = item.type === 'location';

    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.text}
        </Text>
        
        {isLocation && item.latitude && item.longitude && (
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={() => {
              navigation.navigate('MainTabs', { 
                screen: 'Explore',
                params: {
                  focusLatitude: item.latitude, 
                  focusLongitude: item.longitude,
                  questId: item.questId
                }
              });
            }}
          >
            <Ionicons name="map" size={16} color="#00fbfb" style={{ marginRight: 6 }} />
            <Text style={styles.locationButtonText}>Mở trên Bản Đồ</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerProfile}>
          {friendAvatar ? (
            <Image source={{ uri: friendAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{friendName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.headerName}>{friendName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted // Danh sách cuộn ngược từ dưới lên
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      <View style={[styles.inputSection, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TextInput
          style={styles.input}
          placeholder="Nhắn tin..."
          placeholderTextColor="#839493"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={20} color="#00fbfb" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#00fbfb',
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3a4a49',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  chatList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(41, 50, 50, 0.6)',
    borderWidth: 1,
    borderColor: '#3a4a49',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#e0ffff',
  },
  theirMessageText: {
    color: '#dbe4e3',
  },
  inputSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#071010',
    borderTopWidth: 1,
    borderTopColor: 'rgba(58, 74, 73, 0.3)',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(41, 50, 50, 0.4)',
    borderWidth: 1,
    borderColor: '#3a4a49',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 15,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00fbfb',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
    alignSelf: 'flex-start',
  },
  locationButtonText: {
    color: '#00fbfb',
    fontWeight: 'bold',
    fontSize: 14,
  }
});

export default ChatScreen;
