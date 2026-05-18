import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import useQuestStore from '../store/useQuestStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const MyVouchersScreen = ({ navigation }) => {
  const user = useQuestStore((state) => state.user);
  const [myVouchers, setMyVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  useEffect(() => {
    const fetchMyVouchers = async () => {
      if (!user || !user.uid) return;
      try {
        const q = query(
          collection(db, 'user_vouchers'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });

        // Sắp xếp theo thời gian đổi gần nhất lên đầu
        list.sort((a, b) => {
          const timeA = a.redeemedAt?.toMillis ? a.redeemedAt.toMillis() : 0;
          const timeB = b.redeemedAt?.toMillis ? b.redeemedAt.toMillis() : 0;
          return timeB - timeA;
        });

        setMyVouchers(list);
      } catch (error) {
        console.error("Lỗi khi fetch user_vouchers:", error);
        Alert.alert('Lỗi', 'Không thể tải ví voucher.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyVouchers();
  }, [user]);

  const renderVoucherItem = ({ item }) => {
    const isPending = item.status === 'pending' && !item.cardCode && !item.id;
    const dateStr = item.redeemedAt?.toDate ? item.redeemedAt.toDate().toLocaleDateString('vi-VN') : 'Đang cập nhật';
    
    const expiryDateStr = item.redeemedAt?.toDate 
      ? new Date(item.redeemedAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN')
      : 'Đang cập nhật';

    const displayCode = item.cardCode || (item.id ? item.id.substring(0, 10).toUpperCase() : 'PENDING');
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(displayCode)}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="gift" size={24} color="#00fbfb" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.voucherName} numberOfLines={2}>{item.voucherName}</Text>
            <Text style={styles.dateText}>HSD: {expiryDateStr}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>-{item.coinSpent} Xu</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>Voucher Code:</Text>
          <TouchableOpacity 
            style={[styles.codeBox, isPending && styles.codeBoxPending]} 
            onPress={() => !isPending && setSelectedVoucher({ item, displayCode, qrCodeUrl })}
            disabled={isPending}
          >
            <Text style={[styles.codeText, isPending && styles.codeTextPending]}>
              {isPending ? 'Đang chờ cấp mã...' : 'Nhấn xem QR & Mã'}
            </Text>
            {!isPending && <Ionicons name="qr-code-outline" size={16} color="#00fbfb" style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#071010', '#0d1515', '#0d1515']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ví Voucher Của Tôi</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00fbfb" />
        </View>
      ) : (
        <FlatList
          data={myVouchers}
          keyExtractor={(item) => item.id}
          renderItem={renderVoucherItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={60} color="#3a4a49" />
              <Text style={styles.emptyText}>Bạn chưa đổi chiếc voucher nào.</Text>
            </View>
          }
        />
      )}

      {/* QR Modal */}
      <Modal visible={!!selectedVoucher} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedVoucher?.item?.voucherName}</Text>
            <Image source={{ uri: selectedVoucher?.qrCodeUrl }} style={styles.modalQrImage} />
            <Text style={styles.modalHelperText}>Đưa mã này cho nhân viên để sử dụng</Text>
            
            <View style={styles.modalCodeBox}>
              <Text style={styles.modalCodeText}>{selectedVoucher?.displayCode}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedVoucher(null)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(13, 21, 21, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 74, 73, 0.3)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00fbfb',
    textShadowColor: 'rgba(0, 251, 251, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: 'rgba(41, 50, 50, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  voucherName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#839493',
  },
  priceTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  codeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 14,
    color: '#dbe4e3',
    fontWeight: '600',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  codeBoxPending: {
    backgroundColor: 'rgba(58, 74, 73, 0.3)',
    borderColor: 'rgba(58, 74, 73, 0.1)',
  },
  codeText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#00fbfb',
    letterSpacing: 1,
  },
  codeTextPending: {
    color: '#839493',
    fontSize: 13,
    letterSpacing: 0,
    fontStyle: 'italic',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  qrImage: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },
  qrHelperText: {
    fontSize: 12,
    color: '#868E96',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#839493',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0d1515',
    width: '85%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00fbfb',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalQrImage: {
    width: 200,
    height: 200,
    marginBottom: 12,
  },
  modalHelperText: {
    fontSize: 13,
    color: '#839493',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  modalCodeBox: {
    backgroundColor: 'rgba(0, 251, 251, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.4)',
    marginBottom: 24,
  },
  modalCodeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00fbfb',
    letterSpacing: 2,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 251, 251, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 251, 0.3)',
  },
  closeButtonText: {
    color: '#00fbfb',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default MyVouchersScreen;
