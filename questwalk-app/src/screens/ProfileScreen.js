import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileScreen = ({ navigation }) => {
  const { user, totalSteps, coinBalance, avatarUrl, setUser, setTotalSteps, setCoinBalance, setAvatarUrl } = useQuestStore();
  const [isUploading, setIsUploading] = useState(false);

  const handleChangeAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Thiếu quyền", "Bạn cần cấp quyền truy cập thư viện ảnh để đổi Avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể mở thư viện ảnh.");
    }
  };

  const uploadAvatar = async (imageUri) => {
    if (!user || !user.uid) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      const response = await api.post('/api/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data && response.data.url) {
        const newAvatarUrl = response.data.url;
        
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { avatarUrl: newAvatarUrl }, { merge: true });

        setAvatarUrl(newAvatarUrl);
        Alert.alert('Thành công', 'Đổi avatar thành công!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Lỗi', 'Không thể upload avatar. ' + (error.response?.data?.message || error.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đăng xuất', 
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            setUser(null);
            setTotalSteps(0);
            setCoinBalance(0);
          } catch (error) {
            console.error("Lỗi đăng xuất:", error);
            Alert.alert("Lỗi", "Không thể đăng xuất lúc này.");
          }
        }
      }
    ]);
  };

  const getRealName = (userData) => {
    return userData?.name || userData?.displayName || userData?.fullName || userData?.email?.split('@')[0] || 'User';
  };

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Avatar Section */}
        <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={handleChangeAvatar} disabled={isUploading}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getRealName(user).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFF" size="large" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.userName}>{getRealName(user)}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="footsteps" size={28} color="#00fbfb" />
          <Text style={styles.statValue}>{totalSteps}</Text>
          <Text style={styles.statLabel}>Tổng số bước</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="star" size={28} color="#FFD700" />
          <Text style={styles.statValue}>{coinBalance}</Text>
          <Text style={styles.statLabel}>Xu hiện có</Text>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Cài đặt & Tiện ích</Text>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={() => navigation.navigate('MyVouchers')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 251, 251, 0.1)' }]}>
              <Ionicons name="wallet-outline" size={22} color="#00fbfb" />
            </View>
            <Text style={styles.settingText}>Ví Voucher của tôi</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ADB5BD" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={() => Alert.alert('Thông báo', 'Tính năng đang phát triển')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
              <Ionicons name="settings-outline" size={22} color="#dbe4e3" />
            </View>
            <Text style={styles.settingText}>Cài đặt ứng dụng</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ADB5BD" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleLogout}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#FFF5F5' }]}>
              <Ionicons name="log-out-outline" size={22} color="#F03E3E" />
            </View>
            <Text style={[styles.settingText, { color: '#F03E3E' }]}>Đăng xuất</Text>
          </View>
        </TouchableOpacity>

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
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderColor: 'rgba(58, 74, 73, 0.3)',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#00fbfb',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#151d1d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#00fbfb',
  },
  avatarText: {
    fontSize: 48,
    color: '#FFF',
    fontWeight: 'bold',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00fbfb',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#071010',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  userEmail: {
    fontSize: 15,
    color: '#839493',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.15)',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 13,
    color: '#839493',
  },
  settingsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dbe4e3',
  },
});

export default ProfileScreen;
