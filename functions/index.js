/**
 * @file index.js
 * @description Entry point cho Firebase Cloud Functions — QuestWalk Backend.
 *
 * Cấu trúc module:
 *  - functions/src/api/syncSteps.js       → Hàm đồng bộ bước chân + push notification
 *  - functions/src/api/buyVoucher.js      → Hàm mua voucher bằng Xu
 *  - functions/src/triggers/onUserCreate.js → Tự động tạo user document khi đăng ký
 *
 * Deploy: firebase deploy --only functions
 */

const { initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");

// ─── Khởi tạo Firebase Admin SDK (chỉ gọi 1 lần duy nhất ở đây) ─────────────
// Phải gọi trước khi import bất kỳ module nào dùng firebase-admin
initializeApp();

// ─── Cấu hình toàn cục cho các V2 Cloud Functions ─────────────────────────────
// Lưu ý: setGlobalOptions KHÔNG áp dụng cho V1 functions (onUserCreate dùng V1 auth trigger)
setGlobalOptions({
  maxInstances: 10,
  region: "asia-southeast1", // Singapore — gần Việt Nam nhất
});

// ─── Callable API Functions (V2) ─────────────────────────────────────────────
const { syncSteps } = require("./src/api/syncSteps");
const { buyVoucher } = require("./src/api/buyVoucher");

exports.syncSteps = syncSteps;
exports.buyVoucher = buyVoucher;

// ─── Auth Triggers (V1) ───────────────────────────────────────────────────────
const { onUserCreate } = require("./src/triggers/onUserCreate");

exports.onUserCreate = onUserCreate;
