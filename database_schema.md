# 📊 Database Schema — QuestWalk (Firestore)

> **Loại CSDL:** Cloud Firestore (NoSQL Document)
> **Kiến trúc:** Flat Collections — mỗi bảng là một top-level collection.

---

## 1. Collection: `users`

**Đường dẫn:** `/users/{userId}`
**Mô tả:** Lưu hồ sơ người dùng. `userId` = Firebase Auth UID.

| Trường          | Kiểu       | Bắt buộc | Mô tả                                                       |
|-----------------|------------|----------|-------------------------------------------------------------|
| `uid`           | `string`   | ✅        | Firebase Auth UID (trùng với Document ID)                   |
| `displayName`   | `string`   | ✅        | Tên hiển thị của người dùng                                 |
| `email`         | `string`   | ✅        | Địa chỉ email                                               |
| `avatarUrl`     | `string`   | ❌        | URL ảnh đại diện (lưu trên Cloudinary)                      |
| `totalSteps`    | `number`   | ✅        | Tổng số bước chân tích lũy (mặc định: `0`)                  |
| `coinBalance`   | `number`   | ✅        | Số dư Xu hiện tại (mặc định: `0`)                           |
| `createdAt`     | `Timestamp`| ✅        | Thời điểm tạo tài khoản                                     |
| `updatedAt`     | `Timestamp`| ✅        | Thời điểm cập nhật hồ sơ lần cuối                          |

**Ví dụ document:**
```json
{
  "uid": "abc123xyz",
  "displayName": "Nguyễn Văn A",
  "email": "a@example.com",
  "avatarUrl": "https://res.cloudinary.com/.../avatar.jpg",
  "totalSteps": 15000,
  "coinBalance": 250,
  "createdAt": "2026-05-18T10:00:00Z",
  "updatedAt": "2026-05-18T12:00:00Z"
}
```

---

## 2. Collection: `step_logs`

**Đường dẫn:** `/step_logs/{logId}`
**Mô tả:** Ghi lại từng lần đồng bộ bước chân từ app. `logId` = Auto-generated ID.

| Trường        | Kiểu        | Bắt buộc | Mô tả                                                    |
|---------------|-------------|----------|----------------------------------------------------------|
| `userId`      | `string`    | ✅        | UID của người dùng (ref tới `users/{userId}`)            |
| `steps`       | `number`    | ✅        | Số bước được ghi nhận trong lần sync này                 |
| `source`      | `string`    | ❌        | Nguồn dữ liệu: `"health_kit"`, `"google_fit"`, `"manual"` |
| `recordedAt`  | `Timestamp` | ✅        | Thời điểm thực tế ghi nhận bước chân trên thiết bị      |
| `syncedAt`    | `Timestamp` | ✅        | Thời điểm ghi vào Firestore (server timestamp)           |

**Ví dụ document:**
```json
{
  "userId": "abc123xyz",
  "steps": 3000,
  "source": "google_fit",
  "recordedAt": "2026-05-18T11:00:00Z",
  "syncedAt": "2026-05-18T11:05:00Z"
}
```

---

## 3. Collection: `quests`

**Đường dẫn:** `/quests/{questId}`
**Mô tả:** Định nghĩa các nhiệm vụ (thử thách bước chân). Được admin tạo sẵn.

| Trường          | Kiểu       | Bắt buộc | Mô tả                                                        |
|-----------------|------------|----------|--------------------------------------------------------------|
| `title`         | `string`   | ✅        | Tên nhiệm vụ (VD: "Chinh phục 10.000 bước")                 |
| `description`   | `string`   | ❌        | Mô tả chi tiết nhiệm vụ                                     |
| `stepGoal`      | `number`   | ✅        | Số bước cần đạt để hoàn thành nhiệm vụ                      |
| `coinReward`    | `number`   | ✅        | Số Xu thưởng khi hoàn thành nhiệm vụ                        |
| `iconUrl`       | `string`   | ❌        | URL icon nhiệm vụ (lưu trên Cloudinary)                     |
| `isActive`      | `boolean`  | ✅        | Có đang kích hoạt hay không (mặc định: `true`)              |
| `createdAt`     | `Timestamp`| ✅        | Thời điểm tạo nhiệm vụ                                      |

**Ví dụ document:**
```json
{
  "title": "Bước chân đầu tiên",
  "description": "Đạt 5.000 bước trong ngày để nhận thưởng.",
  "stepGoal": 5000,
  "coinReward": 50,
  "iconUrl": "https://res.cloudinary.com/.../quest_icon.png",
  "isActive": true,
  "createdAt": "2026-05-01T00:00:00Z"
}
```

---

## 4. Collection: `vouchers`

**Đường dẫn:** `/vouchers/{voucherId}`
**Mô tả:** Danh mục thẻ cào / ưu đãi có thể mua bằng Xu. Được admin tạo sẵn.

| Trường          | Kiểu       | Bắt buộc | Mô tả                                                     |
|-----------------|------------|----------|-----------------------------------------------------------|
| `name`          | `string`   | ✅        | Tên voucher (VD: "Thẻ cào Viettel 10.000đ")              |
| `description`   | `string`   | ❌        | Mô tả chi tiết                                           |
| `imageUrl`      | `string`   | ❌        | URL ảnh voucher (lưu trên Cloudinary)                    |
| `coinCost`      | `number`   | ✅        | Số Xu cần để đổi voucher này                             |
| `stock`         | `number`   | ✅        | Số lượng voucher còn lại trong kho (`-1` = không giới hạn)|
| `category`      | `string`   | ❌        | Danh mục: `"mobile_card"`, `"food"`, `"shopping"`, ...   |
| `isActive`      | `boolean`  | ✅        | Có đang bán hay không (mặc định: `true`)                 |
| `createdAt`     | `Timestamp`| ✅        | Thời điểm tạo voucher                                    |

**Ví dụ document:**
```json
{
  "name": "Thẻ cào Viettel 10.000đ",
  "description": "Thẻ nạp điện thoại Viettel mệnh giá 10.000đ.",
  "imageUrl": "https://res.cloudinary.com/.../viettel_10k.png",
  "coinCost": 100,
  "stock": 50,
  "category": "mobile_card",
  "isActive": true,
  "createdAt": "2026-05-01T00:00:00Z"
}
```

---

## 5. Collection: `user_vouchers`

**Đường dẫn:** `/user_vouchers/{userVoucherId}`
**Mô tả:** Ghi lại lịch sử đổi thưởng — mỗi document là một thẻ cào thuộc về một user. `userVoucherId` = Auto-generated ID.

| Trường         | Kiểu        | Bắt buộc | Mô tả                                                         |
|----------------|-------------|----------|---------------------------------------------------------------|
| `userId`       | `string`    | ✅        | UID người dùng đã đổi (ref tới `users/{userId}`)             |
| `voucherId`    | `string`    | ✅        | ID của voucher gốc (ref tới `vouchers/{voucherId}`)          |
| `voucherName`  | `string`    | ✅        | Snapshot tên voucher (tránh mất dữ liệu nếu voucher bị xóa) |
| `coinSpent`    | `number`    | ✅        | Số Xu đã dùng để đổi                                         |
| `cardCode`     | `string`    | ❌        | Mã thẻ cào (được điền sau khi xử lý)                        |
| `cardSerial`   | `string`    | ❌        | Serial thẻ (được điền sau khi xử lý)                        |
| `status`       | `string`    | ✅        | Trạng thái: `"pending"`, `"fulfilled"`, `"failed"`           |
| `redeemedAt`   | `Timestamp` | ✅        | Thời điểm user thực hiện đổi thưởng (server timestamp)       |

**Ví dụ document:**
```json
{
  "userId": "abc123xyz",
  "voucherId": "voucher_viettel_10k",
  "voucherName": "Thẻ cào Viettel 10.000đ",
  "coinSpent": 100,
  "cardCode": "123456789012",
  "cardSerial": "SN-987654",
  "status": "fulfilled",
  "redeemedAt": "2026-05-18T14:00:00Z"
}
```

---

## 🔗 Quan hệ giữa các Collection

```
users (1) ──── (N) step_logs        [userId]
users (1) ──── (N) user_vouchers    [userId]
vouchers (1) ── (N) user_vouchers   [voucherId]
quests          ── (kiểm tra qua totalSteps trong users)
```

---

## ⚙️ Luồng xử lý chính (Business Logic)

### Luồng `syncSteps`:
1. App gửi số bước mới → Cloud Function `syncSteps`
2. Cloud Function tạo document mới trong `step_logs`
3. Cộng dồn `steps` vào `users.totalSteps` (dùng `FieldValue.increment`)
4. Truy vấn `quests` collection lấy danh sách nhiệm vụ active
5. Với mỗi quest: nếu `totalSteps` mới đạt `stepGoal` → cộng `coinReward` vào `users.coinBalance`

### Luồng `buyVoucher`:
1. App gửi `voucherId` → Cloud Function `buyVoucher`
2. Cloud Function đọc `vouchers/{voucherId}` kiểm tra tồn tại và `isActive`
3. Đọc `users/{userId}` kiểm tra `coinBalance >= coinCost`
4. Trong một **Transaction** nguyên tử:
   - Trừ `coinCost` khỏi `users.coinBalance`
   - Giảm `vouchers.stock` đi 1 (nếu có giới hạn)
   - Tạo document mới trong `user_vouchers` với `status: "pending"`
5. Trả về kết quả thành công kèm `userVoucherId`
