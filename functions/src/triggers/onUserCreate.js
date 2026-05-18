/**
 * @file onUserCreate.js
 * @description Auth Trigger: Tự động tạo document trong collection `users`
 *              khi có tài khoản Firebase Auth mới được đăng ký.
 *
 * Trigger: functions.auth.user().onCreate()
 * Kích hoạt: Mỗi khi user đăng ký lần đầu (Email/Password, Google, Apple, v.v.)
 *
 * Dữ liệu khởi tạo:
 *  - uid          : Firebase Auth UID (= Document ID)
 *  - email        : Email đăng ký
 *  - displayName  : Tên hiển thị (nếu có, ví dụ từ Google Sign-In)
 *  - avatarUrl    : Ảnh đại diện (nếu có từ provider)
 *  - coinBalance  : 0  (chưa có Xu)
 *  - totalSteps   : 0  (chưa có bước)
 *  - fcmToken     : null (sẽ được cập nhật sau từ app khi user đăng nhập)
 *  - createdAt    : Server timestamp
 *  - updatedAt    : Server timestamp
 */

const { auth } = require("firebase-functions/v1");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

/**
 * onUserCreate - Auth Trigger (V1 API — auth triggers không có V2 tương đương ổn định).
 * Hàm này được gọi tự động bởi Firebase, KHÔNG phải bởi app.
 */
const onUserCreate = auth.user().onCreate(async (user) => {
  const db = getFirestore();

  const { uid, email, displayName, photoURL } = user;

  logger.info(`[onUserCreate] Người dùng mới đăng ký: uid=${uid}, email=${email}`);

  const newUserDoc = {
    uid,
    email: email || null,
    displayName: displayName || null,
    avatarUrl: photoURL || null,  // URL từ provider (Google, Facebook...), lưu vào Firestore
    coinBalance: 0,
    totalSteps: 0,
    fcmToken: null,               // Sẽ được app cập nhật sau khi user đăng nhập thành công
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await db.collection("users").doc(uid).set(newUserDoc);
    logger.info(`[onUserCreate] Đã tạo document users/${uid} thành công.`);
  } catch (error) {
    logger.error(`[onUserCreate] Lỗi khi tạo document users/${uid}:`, error);
    // Không throw lỗi — nếu throw, Firebase sẽ retry trigger này nhiều lần
    // gây tạo document trùng. Chỉ log lỗi là đủ.
  }
});

module.exports = { onUserCreate };
