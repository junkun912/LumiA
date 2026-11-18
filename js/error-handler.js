/*
==================================================
LumiA
ファイル名：error-handler.js

【ファイル概要】
LumiA全体で使用する共通エラー処理。

【主な役割】
・エラー情報の管理
・エラー画面への遷移
・画面内エラー表示
・再試行処理の補助
・エラー情報の安全な取り扱い

【関連ファイル】
・error.html
・error.js
・common.css

【注意】
・内部エラー情報を画面に表示しない
・入力中の内容を不必要に消去しない
・すべてのエラーを自動的に画面遷移させない
==================================================
*/

(() => {
  "use strict";

  /* ==================================================
     1. 定数
  ================================================== */

  const ERROR_STORAGE_KEY = "lumia_error_state";

  const ERROR_PAGE_URL = "./error.html";

  const ALLOWED_ERROR_TYPES = [
    "network",
    "auth",
    "data",
    "system",
    "not-found",
  ];

  /* ==================================================
     2. エラー種別の検証
  ================================================== */

  const validateErrorType = (type) => {
    return ALLOWED_ERROR_TYPES.includes(type) ? type : "system";
  };

  /* ==================================================
     3. 再試行URLの検証
  ================================================== */

  const validateRetryUrl = (url) => {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }

    try {
      const target = new URL(url, window.location.href);

      if (target.origin !== window.location.origin) {
        return null;
      }

      if (!["http:", "https:"].includes(target.protocol)) {
        return null;
      }

      if (target.pathname === window.location.pathname) {
        return null;
      }

      return target.href;
    } catch {
      return null;
    }
  };

  /* ==================================================
     4. エラー画面への遷移
  ================================================== */

  const redirect = (type, retryUrl = null) => {
    const errorType = validateErrorType(type);
    const safeRetryUrl = validateRetryUrl(retryUrl);

    const errorState = {
      type: errorType,
      retryUrl: safeRetryUrl,
    };

    try {
      sessionStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errorState));
    } catch (error) {
      // 保存に失敗した場合もエラー画面へ移動する
      console.error("LumiA: エラー情報を保存できませんでした。");
    }

    window.location.assign(ERROR_PAGE_URL);
  };

  /* ==================================================
     5. 画面内エラー表示
  ================================================== */

  const showInline = (target, message, retryCallback = null) => {
    const container =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!(container instanceof Element)) {
      console.error("LumiA: エラー表示先が見つかりません。");

      return null;
    }

    if (typeof message !== "string" || !message.trim()) {
      return null;
    }

    // 既存の画面内エラーを削除
    clearInline(container);

    const errorElement = document.createElement("div");

    errorElement.className = "lumia-inline-error";

    errorElement.setAttribute("role", "alert");

    errorElement.setAttribute("aria-live", "assertive");

    const messageElement = document.createElement("p");

    messageElement.className = "lumia-inline-error__message";

    messageElement.textContent = message;

    errorElement.appendChild(messageElement);

    // 再試行処理が指定されている場合のみボタンを追加
    if (typeof retryCallback === "function") {
      const retryButton = document.createElement("button");

      retryButton.type = "button";

      retryButton.className = "lumia-inline-error__retry";

      retryButton.textContent = "もう一度試す";

      retryButton.addEventListener("click", async () => {
        if (retryButton.disabled) {
          return;
        }

        retryButton.disabled = true;

        try {
          await retryCallback();
        } catch (error) {
          console.error("LumiA: 再試行に失敗しました。");
        } finally {
          if (retryButton.isConnected) {
            retryButton.disabled = false;
          }
        }
      });

      errorElement.appendChild(retryButton);
    }

    container.appendChild(errorElement);

    return errorElement;
  };

  /* ==================================================
     6. 画面内エラーの削除
  ================================================== */

  const clearInline = (target) => {
    const container =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!(container instanceof Element)) {
      return;
    }

    container.querySelectorAll(".lumia-inline-error").forEach((element) => {
      element.remove();
    });
  };

  /* ==================================================
     7. 共通APIの公開
  ================================================== */

  window.LumiAError = Object.freeze({
    redirect,
    showInline,
    clearInline,
  });
})();
