import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Image, TouchableOpacity } from 'react-native';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const StoreScreen = ({ navigation }) => {
  const { user, coinBalance, setCoinBalance } = useQuestStore();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        let querySnapshot = await getDocs(collection(db, 'vouchers'));
        
        // Tự động tạo dữ liệu mẫu nếu collection trống
        if (querySnapshot.empty) {
          const dummyVouchers = [
            { name: "Voucher Highlands 20k", coinCost: 100, isActive: true, stock: -1, imageUrl: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=300&h=200" },
            { name: "Mã Freeship Shopee", coinCost: 50, isActive: true, stock: -1, imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=300&h=200" },
            { name: "Vé xem phim CGV", coinCost: 300, isActive: true, stock: -1, imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&h=200" },
            { name: "Mã giảm 30k Grab", coinCost: 150, isActive: true, stock: -1, imageUrl: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=300&h=200" },
          ];
          for (const v of dummyVouchers) {
            await addDoc(collection(db, 'vouchers'), v);
          }
          querySnapshot = await getDocs(collection(db, 'vouchers'));
        }

        const voucherList = [];
        querySnapshot.forEach((doc) => {
          voucherList.push({ id: doc.id, ...doc.data() });
        });

        // Sắp xếp voucher theo giá xu tăng dần
        voucherList.sort((a, b) => (a.coinCost || a.cost || 0) - (b.coinCost || b.cost || 0));
        setVouchers(voucherList);
      } catch (error) {
        console.error("Error fetching vouchers:", error);
        Alert.alert('Lỗi', 'Không thể tải danh sách cửa hàng.');
      } finally {
        setLoading(false);
      }
    };

    fetchVouchers();
  }, []);

  const handleBuyVoucher = (voucher) => {
    if (!user || !user.uid) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
      return;
    }

    const price = voucher.coinCost || voucher.cost || 0;

    Alert.alert(
      'Xác nhận đổi quà',
      `Bạn có chắc muốn đổi ${voucher.name} với giá ${price} Xu không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đổi ngay', 
          onPress: () => confirmBuyVoucher(voucher.id) 
        }
      ]
    );
  };

  const confirmBuyVoucher = async (voucherId) => {
    setIsBuying(true);
    try {
      const response = await api.post('/api/buy-voucher', {
        userId: user.uid,
        voucherId: voucherId
      });
      
      if (response.data && response.data.remainingCoinBalance !== undefined) {
        setCoinBalance(response.data.remainingCoinBalance);
      }
      
      Alert.alert('Thành công!', 'Bạn đã đổi voucher thành công!');
    } catch (error) {
      console.error(error);
      Alert.alert('Đổi thất bại', error.response?.data?.message || 'Có lỗi xảy ra khi đổi voucher.');
    } finally {
      setIsBuying(false);
    }
  };

  const renderVoucherCard = ({ item }) => {
    const price = item.coinCost || item.cost || 0;
    const isAffordable = coinBalance >= price;
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.costContainer}>
            <Ionicons name="star" size={16} color="#E67700" />
            <Text style={styles.costText}>{price} Xu</Text>
          </View>
          <TouchableOpacity 
            style={[styles.buyButton, !isAffordable && styles.buyButtonDisabled]} 
            onPress={() => handleBuyVoucher(item)}
            disabled={isBuying}
          >
            <Text style={styles.buyButtonText}>Đổi ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00fbfb" />
        <Text style={styles.loadingText}>Đang tải cửa hàng...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cửa Hàng</Text>
          <Text style={styles.headerSubtitle}>Đổi xu lấy quà xịn</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.coinBadge}>
            <Ionicons name="star" size={20} color="#E67700" />
            <Text style={styles.coinBalanceText}>{coinBalance}</Text>
          </View>
          <TouchableOpacity 
            style={styles.walletButton}
            onPress={() => navigation.navigate('MyVouchers')}
          >
            <Ionicons name="wallet-outline" size={14} color="#00fbfb" />
            <Text style={styles.walletButtonText}>Ví voucher</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid List */}
      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id}
        renderItem={renderVoucherCard}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Overlay khi đang mua */}
      {isBuying && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00fbfb" />
          <Text style={styles.overlayText}>Đang xử lý giao dịch...</Text>
        </View>
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
  },
  headerTitle: {
    fontSize: 28,
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
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  coinBalanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E67700',
    marginLeft: 6,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  walletButtonText: {
    color: '#00fbfb',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.15)',
  },
  cardImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#151d1d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 251, 251, 0.15)',
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    minHeight: 40,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  costText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#E67700',
    marginLeft: 4,
  },
  buyButton: {
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
  },
  buyButtonDisabled: {
    backgroundColor: 'rgba(58, 74, 73, 0.3)',
    borderColor: 'rgba(58, 74, 73, 0.1)',
  },
  buyButtonText: {
    color: '#00fbfb',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  }
});

export default StoreScreen;
