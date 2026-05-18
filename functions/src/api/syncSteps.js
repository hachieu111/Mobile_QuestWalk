/**
 * @file syncSteps.js
 * @description Cloud Function: Đồng bộ số bước chân từ app.
 *
 * Luồng xử lý:
 * 1. Xác thực người dùng qua Firebase Auth context.
 * 2. Validate dữ liệu đầu vào (steps, source, recordedAt).
 * 3. Tạo document mới trong collection `step_logs`.
 * 4. Cộng dồn số bước vào `users.totalSteps` bằng FieldValue.increment (atomic).
 * 5. Truy vấn tất cả quest đang active, kiểm tra mốc nhiệm vụ vừa đạt được.
 * 6. Cộng Xu (coinReward) vào `users.coinBalance` cho mỗi quest vừa hoàn thành.
 * 7. [MỚI] Gửi Push Notification qua FCM nếu user có fcmToken đã đăng ký.
 *
 * @rule Mọi logic tính toán Xu và bước chân phải nằm ở Backend (xem .cursorrules).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

/**
 * syncSteps - Callable Cloud Function (gọi từ app React Native).
 *
 * @param {object} data - Dữ liệu gửi từ app.
 * @param {number} data.steps       - Số bước chân ghi nhận được (> 0).
 * @param {string} [data.source]    - Nguồn dữ liệu: "health_kit" | "google_fit" | "manual".
 * @param {string} [data.recordedAt] - ISO 8601 timestamp thời điểm ghi nhận trên thiết bị.
 *
 * @returns {{ success: boolean, totalSteps: number, coinBalance: number, completedQuests: string[] }}
 */
const syncSteps = onCall(async (request) => {
  // ─── 1. Xác thực người dùng ───────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Yêu cầu phải đăng nhập để đồng bộ bước chân."
    );
  }

  const userId = request.auth.uid;
  const { steps, source = "manual", recordedAt } = request.data;

  // ─── 2. Validate dữ liệu đầu vào ─────────────────────────────────────────
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "Trường `steps` phải là số nguyên dương."
    );
  }

  const VALID_SOURCES = ["health_kit", "google_fit", "manual"];
  if (!VALID_SOURCES.includes(source)) {
    throw new HttpsError(
      "invalid-argument",
      `Trường \`source\` phải là một trong: ${VALID_SOURCES.join(", ")}.`
    );
  }

  // Giới hạn tối đa 100.000 bước/lần sync để chống gian lận
  const MAX_STEPS_PER_SYNC = 100000;
  if (steps > MAX_STEPS_PER_SYNC) {
    throw new HttpsError(
      "invalid-argument",
      `Số bước mỗi lần đồng bộ không được vượt quá ${MAX_STEPS_PER_SYNC}.`
    );
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);

  // ─── 3. Ghi log vào step_logs ─────────────────────────────────────────────
  const stepLogData = {
    userId,
    steps,
    source,
    recordedAt: recordedAt ? new Date(recordedAt) : FieldValue.serverTimestamp(),
    syncedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("step_logs").add(stepLogData);

  // ─── 4. Cộng dồn totalSteps vào users (atomic increment) ─────────────────
  await userRef.update({
    totalSteps: FieldValue.increment(steps),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // ─── 5. Đọc trạng thái user mới nhất để kiểm tra quest ───────────────────
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", `Không tìm thấy user với ID: ${userId}`);
  }

  const userData = userSnap.data();
  const newTotalSteps = userData.totalSteps;
  const previousTotalSteps = newTotalSteps - steps;

  // ─── 6. Kiểm tra và thưởng Xu cho các quest vừa đạt mốc ──────────────────
  const questsSnap = await db
    .collection("quests")
    .where("isActive", "==", true)
    .get();

  const completedQuestTitles = [];
  let totalCoinReward = 0;

  questsSnap.forEach((doc) => {
    const quest = doc.data();
    const { stepGoal, coinReward, title } = quest;

    // Quest hoàn thành nếu: TRƯỚC đây chưa đạt mốc, nhưng BÂY GIỜ đã đạt
    // Điều kiện: previousTotalSteps < stepGoal <= newTotalSteps
    if (previousTotalSteps < stepGoal && stepGoal <= newTotalSteps) {
      completedQuestTitles.push(title);
      totalCoinReward += coinReward || 0;
    }
  });

  // Cộng Xu nếu có quest hoàn thành (1 lần write duy nhất để tiết kiệm)
  if (totalCoinReward > 0) {
    await userRef.update({
      coinBalance: FieldValue.increment(totalCoinReward),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Đọc lại coinBalance cuối cùng sau khi cộng Xu
  const finalUserSnap = await userRef.get();
  const finalData = finalUserSnap.data();
  const finalCoinBalance = finalData.coinBalance;

  // ─── 7. Gửi Push Notification nếu có quest vừa hoàn thành ────────────────
  if (completedQuestTitles.length > 0) {
    const fcmToken = finalData.fcmToken;

    if (fcmToken && typeof fcmToken === "string" && fcmToken.trim() !== "") {
      try {
        const message = {
          token: fcmToken,
          notification: {
            title: "🏆 Nhiệm vụ hoàn thành!",
            body: `Ting ting! Bạn đã hoàn thành nhiệm vụ và nhận được ${totalCoinReward} Xu!`,
          },
          // Dữ liệu thêm để app xử lý navigation nếu cần
          data: {
            type: "quest_completed",
            coinReward: String(totalCoinReward),
            completedQuests: completedQuestTitles.join(","),
          },
          android: {
            notification: {
              channelId: "quest_notifications",
              priority: "high",
              sound: "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        await getMessaging().send(message);
        logger.info(
          `[syncSteps] Đã gửi FCM notification tới user ${userId}. Quest: ${completedQuestTitles.join(", ")}`
        );
      } catch (fcmError) {
        // Không throw lỗi FCM — push notification thất bại không nên làm hỏng toàn bộ hàm
        // Lỗi phổ biến: token hết hạn (messaging/registration-token-not-registered)
        if (fcmError.code === "messaging/registration-token-not-registered") {
          logger.warn(
            `[syncSteps] FCM token của user ${userId} đã hết hạn. Cần xóa token.`
          );
          // Xóa token cũ để tránh gửi lại lần sau
          await userRef.update({
            fcmToken: null,
            updatedAt: FieldValue.serverTimestamp(),
          }).catch(() => {}); // Bỏ qua lỗi nếu update thất bại
        } else {
          logger.error(
            `[syncSteps] Lỗi khi gửi FCM tới user ${userId}:`,
            fcmError
          );
        }
      }
    } else {
      logger.info(
        `[syncSteps] User ${userId} không có fcmToken — bỏ qua push notification.`
      );
    }
  }

  // ─── 8. Trả kết quả về app ────────────────────────────────────────────────
  return {
    success: true,
    totalSteps: newTotalSteps,
    coinBalance: finalCoinBalance,
    completedQuests: completedQuestTitles,
  };
});

module.exports = { syncSteps };
