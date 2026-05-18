/**
 * @file buyVoucher.js
 * @description Cloud Function: Mua voucher (đổi Xu lấy thẻ cào).
 *
 * Luồng xử lý (dùng Firestore Transaction để đảm bảo tính nguyên tử):
 * 1. Xác thực người dùng qua Firebase Auth context.
 * 2. Validate dữ liệu đầu vào (voucherId).
 * 3. Trong một Transaction:
 *    a. Đọc document `vouchers/{voucherId}` — kiểm tra tồn tại, isActive, và stock.
 *    b. Đọc document `users/{userId}` — kiểm tra coinBalance >= coinCost.
 *    c. Trừ coinCost khỏi users.coinBalance.
 *    d. Giảm vouchers.stock đi 1 (nếu stock !== -1).
 *    e. Tạo document mới trong `user_vouchers` với status: "pending".
 * 4. Trả về kết quả thành công kèm userVoucherId.
 *
 * @rule Mọi logic tính toán Xu phải nằm ở Backend (xem .cursorrules).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * buyVoucher - Callable Cloud Function (gọi từ app React Native).
 *
 * @param {object} data - Dữ liệu gửi từ app.
 * @param {string} data.voucherId - ID của voucher muốn mua.
 *
 * @returns {{ success: boolean, userVoucherId: string, remainingCoinBalance: number }}
 */
const buyVoucher = onCall(async (request) => {
  // ─── 1. Xác thực người dùng ───────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Yêu cầu phải đăng nhập để mua voucher."
    );
  }

  const userId = request.auth.uid;
  const { voucherId } = request.data;

  // ─── 2. Validate dữ liệu đầu vào ─────────────────────────────────────────
  if (!voucherId || typeof voucherId !== "string" || voucherId.trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      "Trường `voucherId` là bắt buộc và phải là chuỗi hợp lệ."
    );
  }

  const db = getFirestore();
  const voucherRef = db.collection("vouchers").doc(voucherId.trim());
  const userRef = db.collection("users").doc(userId);
  const userVouchersRef = db.collection("user_vouchers");

  // ─── 3. Thực hiện Transaction nguyên tử ──────────────────────────────────
  let newUserVoucherId;

  try {
    await db.runTransaction(async (transaction) => {
      // 3a. Đọc document voucher
      const voucherSnap = await transaction.get(voucherRef);

      if (!voucherSnap.exists) {
        throw new HttpsError(
          "not-found",
          `Voucher với ID "${voucherId}" không tồn tại.`
        );
      }

      const voucherData = voucherSnap.data();

      // Kiểm tra voucher còn hoạt động
      if (!voucherData.isActive) {
        throw new HttpsError(
          "failed-precondition",
          "Voucher này hiện không còn khả dụng."
        );
      }

      // Kiểm tra kho hàng (stock = -1 nghĩa là không giới hạn)
      if (voucherData.stock !== -1 && voucherData.stock <= 0) {
        throw new HttpsError(
          "resource-exhausted",
          "Voucher này đã hết hàng. Vui lòng chọn voucher khác."
        );
      }

      // 3b. Đọc document user
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new HttpsError(
          "not-found",
          `Không tìm thấy tài khoản người dùng với ID: ${userId}`
        );
      }

      const userData = userSnap.data();
      const { coinBalance } = userData;
      const { coinCost, name: voucherName, stock } = voucherData;

      // Kiểm tra số dư Xu
      if (coinBalance < coinCost) {
        throw new HttpsError(
          "failed-precondition",
          `Số Xu không đủ. Bạn có ${coinBalance} Xu, cần ${coinCost} Xu để đổi voucher này.`
        );
      }

      // ─── 3c. Trừ Xu khỏi coinBalance của user ─────────────────────────
      transaction.update(userRef, {
        coinBalance: FieldValue.increment(-coinCost),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ─── 3d. Giảm stock của voucher (nếu có giới hạn) ─────────────────
      if (stock !== -1) {
        transaction.update(voucherRef, {
          stock: FieldValue.increment(-1),
        });
      }

      // ─── 3e. Tạo document user_vouchers mới ───────────────────────────
      // Tạo ref trước để có ID, sau đó set trong transaction
      const newUserVoucherRef = userVouchersRef.doc();
      newUserVoucherId = newUserVoucherRef.id;

      transaction.set(newUserVoucherRef, {
        userId,
        voucherId: voucherId.trim(),
        voucherName: voucherName || "Voucher",
        coinSpent: coinCost,
        cardCode: null,      // Sẽ được điền sau khi admin xử lý
        cardSerial: null,    // Sẽ được điền sau khi admin xử lý
        status: "pending",   // Trạng thái ban đầu
        redeemedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    // Re-throw HttpsError gốc (đã có message rõ ràng)
    if (error instanceof HttpsError) {
      throw error;
    }
    // Wrap các lỗi không mong đợi
    console.error("Lỗi không xác định trong buyVoucher transaction:", error);
    throw new HttpsError(
      "internal",
      "Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại."
    );
  }

  // ─── 4. Đọc coinBalance cuối cùng để trả về app ───────────────────────────
  const finalUserSnap = await userRef.get();
  const remainingCoinBalance = finalUserSnap.data().coinBalance;

  // ─── 5. Trả kết quả về app ────────────────────────────────────────────────
  return {
    success: true,
    userVoucherId: newUserVoucherId,
    remainingCoinBalance,
  };
});

module.exports = { buyVoucher };
