# QuestWalk 🎮🏃‍♂️

QuestWalk là một ứng dụng di động kết hợp giữa vận động (đếm bước chân), mạng xã hội và thực tế ảo tăng cường (AR). Ứng dụng mang phong cách thiết kế **Cyber/eSports Dark Theme** sang trọng, giúp việc tập thể dục hàng ngày trở thành một chuyến đi săn kho báu và làm nhiệm vụ đầy thú vị.

---

## 🛠 Công Nghệ Sử Dụng

- **Frontend:** React Native (Expo)
- **Backend/Database:** Firebase (Authentication, Cloud Firestore)
- **API Server:** Express.js (Deployed on Render)
- **Giao diện:** Tối ưu hóa UI/UX với phong cách Glassmorphism, Dark Mode, Neon Cyan, Gold accents.
- **Tính năng phần cứng:** Pedometer (Cảm biến bước chân), Geolocation (GPS), Camera (AR View).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Yêu cầu hệ thống
- Đã cài đặt **Node.js** và **npm**.
- Cài đặt ứng dụng **Expo Go** trên điện thoại (iOS/Android) hoặc sử dụng Emulator (Android Studio / Xcode).

### 2. Các bước khởi chạy

**Bước 1:** Clone hoặc tải source code về máy.

**Bước 2:** Di chuyển vào thư mục dự án React Native:
```bash
cd questwalk-app
```

**Bước 3:** Cài đặt các thư viện cần thiết:
```bash
npm install
```

**Bước 4:** Khởi chạy server phát triển của Expo (có xóa cache để tránh lỗi):
```bash
npx expo start -c
```

**Bước 5:** Sử dụng ứng dụng:
- **Trên điện thoại thật:** Mở ứng dụng camera (iOS) hoặc ứng dụng Expo Go (Android) và quét mã QR hiển thị trên Terminal.
- **Trên máy ảo:** Nhấn phím `a` để mở trên Android Emulator, hoặc `i` để mở trên iOS Simulator.

---

## 📱 Các Tính Năng Chi Tiết Từng Trang

### 1. Trang Đăng Nhập / Đăng Ký (`LoginScreen`)
- **Mô tả:** Nơi bắt đầu hành trình. Giao diện tối mờ huyền bí với chữ QuestWalk phát sáng.
- **Tính năng:** Đăng ký tài khoản mới hoặc đăng nhập bằng Email/Mật khẩu. Dữ liệu sẽ tự động đồng bộ lên Firebase.

### 2. Trang Chủ - Đi Bộ (`HomeScreen`)
- **Mô tả:** Bảng điều khiển trung tâm (Dashboard).
- **Tính năng:**
  - Theo dõi số bước chân thời gian thực (sử dụng Pedometer của thiết bị).
  - Nút đồng bộ hóa (Sync) để đẩy số bước lên máy chủ và nhận tính toán cấp độ.
  - Hiển thị số dư Xu, Số huy hiệu AR, thông tin người dùng.
  - Lối tắt truy cập nhanh các tính năng: Tạo Quest, Xếp hạng, Đổi Voucher.

### 3. Bản Đồ & Khám Phá (`MapScreen`)
- **Mô tả:** Bản đồ GPS tương tác để tìm kiếm kho báu.
- **Tính năng:**
  - Hiển thị các nhiệm vụ/rương kho báu xung quanh bạn dựa trên vị trí GPS.
  - **Nhận diện Marker thông minh:** Cờ vàng (Hệ thống), Hộp quà xanh (Của mình tạo), Avatar người chơi (Nhiệm vụ do bạn bè tạo).
  - Tự do "thả rương Xu" (Tạo Custom Quest) tại vị trí hiện tại với tùy chọn quyền riêng tư: **Công Khai** hoặc **Chỉ Bạn Bè**.

### 4. Bắt Kho Báu AR (`ARCheckInScreen`)
- **Mô tả:** Giao diện Camera kết hợp thực tế ảo (AR).
- **Tính năng:** Khi người chơi di chuyển đến vị trí rương trên bản đồ trong bán kính cho phép (20 mét), họ có thể mở Camera để "quét" không gian. Huy hiệu ảo (Hologram) sẽ hiện ra, cho phép nhấn chụp để thu thập Xu và Huy hiệu thẳng vào ví.

### 5. Bảng Xếp Hạng (`AnalyticsScreen`)
- **Mô tả:** Đấu trường danh vọng của các Thợ Săn.
- **Tính năng:** Cập nhật thời gian thực (Real-time) danh sách những người chơi có tổng số bước chân cao nhất. Chỉ hiển thị tên thật (hoặc tiền tố email) và số bước để đảm bảo tính cạnh tranh minh bạch.

### 6. Cửa Hàng (`StoreScreen`)
- **Mô tả:** Nơi tiêu xài Xu thưởng kiếm được.
- **Tính năng:** Danh sách các phần quà thực tế (Highlands, Shopee, CGV, Grab...). Nhấn "Đổi ngay" để dùng Xu trong ví mua Voucher.

### 7. Ví Voucher (`MyVouchersScreen`)
- **Mô tả:** Nơi lưu trữ chiến lợi phẩm.
- **Tính năng:** Danh sách các Voucher đã mua. Nhấn vào một Voucher để hiển thị Popup **Mã QR Code** và chuỗi mã số, giúp đưa cho nhân viên quét trực tiếp tại cửa hàng ngoài đời thực.

### 8. Hội Thợ Săn / Bạn Bè (`FriendsScreen`)
- **Mô tả:** Nơi kết nối mạng xã hội trong game.
- **Tính năng:** 
  - Gõ Email để gửi lời mời kết bạn.
  - Quản lý danh sách lời mời chờ duyệt (Chấp nhận/Từ chối).
  - Hiển thị danh sách Bạn Bè đã kết nối cùng avatar và cấp độ của họ.

### 9. Nhắn Tin (`ChatScreen`)
- **Mô tả:** Trò chuyện thời gian thực 1-1.
- **Tính năng:** Truy cập từ danh sách Bạn bè. Cho phép chat, hỏi thăm tiến độ chạy bộ hoặc rủ rê nhau đi nhặt rương kho báu. Trải nghiệm nhắn tin mượt mà, bàn phím không che lấp tin nhắn.

### 10. Hồ Sơ Của Tôi (`ProfileScreen`)
- **Mô tả:** Trang quản lý cá nhân.
- **Tính năng:** 
  - Xem tổng quan bước chân, xu hiện có.
  - Đổi ảnh đại diện (Avatar).
  - Link đến Ví Voucher.
  - Đăng xuất an toàn khỏi thiết bị.

---

*Phát triển bởi đội ngũ đam mê Game Hóa Thể Thao (Gamification of Fitness).*