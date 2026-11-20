/*
==================================================
LumiA
ファイル名：error.js

【ファイル概要】
LumiAのエラー画面を制御するJavaScript。

【主な役割】
・エラー情報の取得
・エラーの種類に応じたメッセージ表示
・再試行処理
・認証エラー時のログイン画面への誘導
・ホーム画面への誘導
・エラー情報の安全な取り扱い

【関連ファイル】
・error.html
・css/error.css
・js/common.js
・js/error-handler.js

【エラー情報の保存先】
sessionStorage：lumia_error_state

【注意】
・内部エラー情報を画面に表示しない
・入力中の内容を不必要に消去しない
・すべてのエラーを自動的に画面遷移させない
==================================================
*/

(() => {
  "use strict";

  // ==================================================
  // 1. 定数
  // ==================================================

  const ERROR_STORAGE_KEY = "lumia_error_state";

  const LOGIN_PAGE_URL = "./login.html";
  const HOME_PAGE_URL = "./home.html";

  const ALLOWED_ERROR_TYPES = Object.freeze([
    "network",
    "auth",
    "data",
    "system",
    "not-found",
    "permission",
  ]);

  // ==================================================
  // 2. エラー情報の定義
  // ==================================================

  const ERROR_MESSAGES = Object.freeze({
    network: {
      title: "通信がうまくいかなかったみたいです。",
      description: "インターネットへの接続を確認してください。",
      guide: "通信環境を確認して、もう一度お試しください。",
      retryLabel: "もう一度試す",
    },

    auth: {
      title: "ログインが必要みたいです。",
      description: "ログイン状態を確認できませんでした。",
      guide: "お手数ですが、もう一度ログインしてください。",
      retryLabel: "ログイン画面へ",
    },

    data: {
      title: "情報を読み込めませんでした。",
      description: "必要な情報を取得できませんでした。",
      guide: "少し時間をおいて、もう一度お試しください。",
      retryLabel: "もう一度試す",
    },

    permission: {
      title: "この操作は利用できないみたいです。",
      description: "現在のアカウントでは、この操作を行えない可能性があります。",
      guide: "ホーム画面に戻り、別の操作をお試しください。",
      retryLabel: "ホームへ戻る",
    },

    system: {
      title: "うまく表示できなかったみたいです。",
      description: "ただいま、ページを正しく表示できませんでした。",
      guide: "ホーム画面から、もう一度お進みください。",
      retryLabel: "ホームへ戻る",
    },

    "not-found": {
      title: "ページが見つかりませんでした。",
      description: "お探しのページを表示できませんでした。",
      guide: "ホーム画面から、もう一度お進みください。",
      retryLabel: "ホームへ戻る",
    },
  });

  // ==================================================
  // 3. HTML要素
  // ==================================================

  const elements = {
    title: document.querySelector("#error-title"),
    description: document.querySelector("#error-description"),
    guide: document.querySelector("#error-guide"),
    retryButton: document.querySelector("#error-retry"),
    retryLabel: document.querySelector("#error-retry span:first-child"),
  };

  // ==================================================
  // 4. 初期化
  // ==================================================

  function initializeErrorPage() {
    if (
      !elements.title ||
      !elements.description ||
      !elements.guide ||
      !elements.retryButton ||
      !elements.retryLabel
    ) {
      console.error("LumiA: エラー画面に必要なHTML要素が見つかりません。");
      return;
    }

    const errorState = getErrorState();

    displayErrorMessage(errorState);
    setupRetryButton(errorState);
  }

  // ==================================================
  // 5. エラー情報の取得
  // ==================================================

  function getErrorState() {
    try {
      const storedData = sessionStorage.getItem(ERROR_STORAGE_KEY);

      if (!storedData) {
        return {
          type: "system",
          retryUrl: null,
        };
      }

      const parsedData = JSON.parse(storedData);

      if (
        !parsedData ||
        typeof parsedData !== "object" ||
        Array.isArray(parsedData)
      ) {
        return {
          type: "system",
          retryUrl: null,
        };
      }

      const type = ALLOWED_ERROR_TYPES.includes(parsedData.type)
        ? parsedData.type
        : "system";

      const retryUrl = validateRetryUrl(parsedData.retryUrl);

      return {
        type,
        retryUrl,
      };
    } catch (error) {
      console.error(
        "LumiA: エラー情報を取得できませんでした。",
        error?.name || "StorageError",
      );

      return {
        type: "system",
        retryUrl: null,
      };
    }
  }

  // ==================================================
  // 6. 再試行URLの検証
  // ==================================================

  function validateRetryUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      /*
       * 現在のページURLを基準にする。
       *
       * 例：
       * /pages/error.html
       * ./home.html
       * ↓
       * /pages/home.html
       */

      const targetUrl = new URL(value, window.location.href);

      // 同一オリジン以外への移動を禁止
      if (targetUrl.origin !== window.location.origin) {
        return null;
      }

      // HTTP・HTTPS以外のプロトコルを禁止
      if (!["http:", "https:"].includes(targetUrl.protocol)) {
        return null;
      }

      // URLに認証情報が含まれる場合は拒否
      if (targetUrl.username || targetUrl.password) {
        return null;
      }

      // エラー画面への再遷移を禁止
      if (targetUrl.pathname === window.location.pathname) {
        return null;
      }

      return targetUrl.href;
    } catch (error) {
      return null;
    }
  }

  // ==================================================
  // 7. エラーメッセージの表示
  // ==================================================

  function displayErrorMessage(errorState) {
    const message = ERROR_MESSAGES[errorState.type] || ERROR_MESSAGES.system;

    elements.title.textContent = message.title;

    elements.description.textContent = message.description;

    elements.guide.textContent = message.guide;

    /*
     * ボタンのラベルだけを変更する。
     * 矢印などの子要素は維持する。
     */

    elements.retryLabel.textContent = message.retryLabel;

    elements.retryButton.disabled = false;
    elements.retryButton.removeAttribute("aria-busy");
  }

  // ==================================================
  // 8. 再試行ボタンの設定
  // ==================================================

  function setupRetryButton(errorState) {
    const { type, retryUrl } = errorState;

    let destination = HOME_PAGE_URL;

    // ----------------------------------------------
    // 認証エラー
    // ----------------------------------------------

    if (type === "auth") {
      destination = LOGIN_PAGE_URL;
    }

    // ----------------------------------------------
    // 権限・ページ未発見エラー
    // ----------------------------------------------
    else if (type === "permission" || type === "not-found") {
      destination = HOME_PAGE_URL;
    }

    // ----------------------------------------------
    // その他のエラー
    // ----------------------------------------------
    else if (retryUrl) {
      destination = retryUrl;
    }

    // ----------------------------------------------
    // 再試行先がない場合
    // ----------------------------------------------
    else {
      destination = HOME_PAGE_URL;

      elements.retryLabel.textContent = "ホームへ戻る";
    }

    elements.retryButton.disabled = false;

    // 二重登録を防ぐため、イベントを一度だけ設定
    elements.retryButton.addEventListener("click", () => {
      if (elements.retryButton.disabled) {
        return;
      }

      elements.retryButton.disabled = true;

      elements.retryButton.setAttribute("aria-busy", "true");

      navigateTo(destination);
    });
  }

  // ==================================================
  // 9. エラー情報の削除
  // ==================================================

  function clearErrorState() {
    try {
      sessionStorage.removeItem(ERROR_STORAGE_KEY);
    } catch (error) {
      /*
       * 削除に失敗してもページ遷移は継続する。
       */
      console.error(
        "LumiA: エラー情報を削除できませんでした。",
        error?.name || "StorageError",
      );
    }
  }

  // ==================================================
  // 10. ページ遷移
  // ==================================================

  function navigateTo(url) {
    // 遷移先を再検証
    const safeUrl = validateRetryUrl(url);

    if (!safeUrl) {
      clearErrorState();

      const fallbackUrl = validateRetryUrl(HOME_PAGE_URL);

      if (fallbackUrl) {
        window.location.assign(fallbackUrl);
      }

      return;
    }

    // エラー情報を削除
    clearErrorState();

    // 指定ページへ移動
    window.location.assign(safeUrl);
  }

  // ==================================================
  // 11. 初期化処理の実行
  // ==================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeErrorPage, {
      once: true,
    });
  } else {
    initializeErrorPage();
  }
})();
