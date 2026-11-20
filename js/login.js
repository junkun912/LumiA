/*
==================================================
LumiA
ファイル名：login.js
バージョン：2.1

【役割】
・パスワードの表示切り替え
・ログインフォームの入力確認
・Amazon Cognito認証との連携
・ログイン成功後の画面遷移
・ゲスト利用時の画面遷移
・共通エラーハンドラーとの連携
・認証エラーの表示
・二重送信の防止

【関連ファイル】
・js/auth.js
・js/common.js
・js/error-handler.js
・pages/login.html
・pages/home.html
・pages/error.html

【重要】
・認証成功を確認する前にログイン遷移を開始しない
・ログイン失敗時に入力内容を消去しない
・内部エラー情報を画面に表示しない
・重大なエラーは共通エラーページへ遷移する
・入力や通信に関するエラーは画面内に表示する

==================================================
*/

"use strict";

import { login } from "./auth.js";

// ==================================================
// 1. ページ初期化
// ==================================================

document.addEventListener("DOMContentLoaded", initializeLoginPage);

function initializeLoginPage() {
  // ==================================================
  // 2. DOM要素取得
  // ==================================================

  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");

  const loginMessage = document.getElementById("login-status");
  const loginErrorContainer = document.getElementById("login-error-container");

  const guestLink = document.querySelector(".login-form__guest");
  const loginScreen = document.querySelector(".login-screen");

  const loginButton = loginForm?.querySelector(".login-form__submit");

  // ==================================================
  // 3. 状態管理
  // ==================================================

  let isTransitioning = false;
  let isAuthenticating = false;

  // ==================================================
  // 4. 画面操作の共通処理
  // ==================================================

  /**
   * 操作可能な状態を切り替える。
   *
   * @param {boolean} disabled 操作を無効にするか
   */
  function setPageControlsDisabled(disabled) {
    if (loginButton) {
      loginButton.disabled = disabled;
    }

    if (guestLink) {
      guestLink.setAttribute("aria-disabled", String(disabled));

      guestLink.style.pointerEvents = disabled ? "none" : "";
    }
  }

  // ==================================================
  // 5. 画面遷移
  // ==================================================

  /**
   * 指定されたページへ遷移する。
   *
   * 同一オリジンのページのみ許可する。
   * 二重操作を防止する。
   *
   * @param {string} destination 遷移先
   * @returns {boolean} 遷移開始の可否
   */
  function startPageTurn(destination) {
    if (isTransitioning || !destination) {
      return false;
    }

    let targetUrl;

    try {
      targetUrl = new URL(destination, window.location.href);

      if (targetUrl.origin !== window.location.origin) {
        throw new Error("許可されていない遷移先です。");
      }
    } catch (error) {
      console.error(
        "LumiA: ページ遷移先が正しくありません。",
        error?.name || "NavigationError",
      );

      return false;
    }

    try {
      isTransitioning = true;

      setPageControlsDisabled(true);

      window.location.assign(targetUrl.href);

      return true;
    } catch (error) {
      isTransitioning = false;

      setPageControlsDisabled(false);

      console.error(
        "LumiA: ページ遷移に失敗しました。",
        error?.name || "NavigationError",
      );

      return false;
    }
  }

  // 他の画面処理から利用できるように公開
  window.LumiAStartPageTurn = startPageTurn;

  // ==================================================
  // 6. 共通エラーハンドラー連携
  // ==================================================

  /**
   * 重大なエラーを共通エラーページへ遷移させる。
   *
   * @param {string} type エラー種別
   */
  function redirectToError(type) {
    if (isTransitioning) {
      return;
    }

    isTransitioning = true;

    setPageControlsDisabled(true);

    try {
      if (typeof window.LumiAError?.redirect === "function") {
        window.LumiAError.redirect(type);
        return;
      }
    } catch (error) {
      console.error(
        "LumiA: 共通エラーハンドラーを利用できません。",
        error?.name || "ErrorHandlerError",
      );
    }

    // 共通ハンドラーが利用できない場合
    window.location.href = "./error.html";
  }

  // ==================================================
  // 7. 必須HTML要素の確認
  // ==================================================

  if (!loginScreen || !loginForm || !loginMessage || !passwordInput) {
    console.error("LumiA: ログイン画面に必要なHTML要素が不足しています。");

    redirectToError("system");
    return;
  }

  // ==================================================
  // 8. パスワード表示・非表示
  // ==================================================

  if (passwordToggle) {
    // フォーム送信ボタンとして動作しないようにする
    if (passwordToggle.tagName === "BUTTON") {
      passwordToggle.type = "button";
    }

    /**
     * パスワード表示状態を切り替える。
     */
    function updatePasswordVisibility() {
      const isVisible = passwordInput.type === "text";

      passwordInput.type = isVisible ? "password" : "text";

      passwordToggle.setAttribute("aria-pressed", String(!isVisible));

      passwordToggle.setAttribute(
        "aria-label",
        isVisible ? "パスワードを表示" : "パスワードを隠す",
      );
    }

    // 初期状態を設定
    const initiallyVisible = passwordInput.type === "text";

    passwordToggle.setAttribute("aria-pressed", String(initiallyVisible));

    passwordToggle.setAttribute(
      "aria-label",
      initiallyVisible ? "パスワードを隠す" : "パスワードを表示",
    );

    passwordToggle.addEventListener("click", (event) => {
      event.preventDefault();
      updatePasswordVisibility();
    });
  }

  // ==================================================
  // 9. ログインエラー処理
  // ==================================================

  /**
   * Cognitoや通信エラーを安全なメッセージに変換する。
   *
   * 内部エラー情報は画面に表示しない。
   *
   * @param {Error} error 発生したエラー
   * @returns {string} 表示用メッセージ
   */
  function getLoginErrorMessage(error) {
    const errorName = error?.name || "";
    const errorCode = error?.code || "";

    switch (errorName) {
      case "NotAuthorizedException":
      case "UserNotFoundException":
        return "メールアドレスまたはパスワードが正しくありません。";

      case "UserNotConfirmedException":
        return "アカウントの確認が完了していません。管理者にお問い合わせください。";

      case "PasswordResetRequiredException":
        return "パスワードの再設定が必要です。";

      case "TooManyRequestsException":
      case "LimitExceededException":
      case "TooManyFailedAttemptsException":
      case "PasswordAttemptsExceededException":
        return "アクセスが集中しています。しばらくしてから再度お試しください。";

      case "NetworkError":
      case "TypeError":
        return "通信に失敗しました。ネットワークを確認してください。";

      default:
        break;
    }

    // 共通エラーコードへの対応
    switch (errorCode) {
      case "NETWORK":
      case "TIMEOUT":
        return "通信に失敗しました。ネットワークを確認してください。";

      case "AUTH_REQUIRED":
        return "ログイン情報を確認してください。";

      case "FORBIDDEN":
        return "このアカウントではログインできません。管理者にお問い合わせください。";

      case "AUTH_SESSION_FAILED":
        return "認証情報を確認できませんでした。もう一度お試しください。";

      case "AUTH_OPERATION_FAILED":
        return "認証処理に失敗しました。時間をおいて再度お試しください。";

      default:
        return "ログインに失敗しました。入力内容と接続状況を確認してください。";
    }
  }

  // ==================================================
  // 10. ログインエラー表示
  // ==================================================

  /**
   * ログインエラーを画面内に表示する。
   *
   * 共通ハンドラーが利用できる場合はshowInlineを使用する。
   *
   * @param {string} message 表示するメッセージ
   */
  function showLoginError(message) {
    if (
      loginErrorContainer &&
      typeof window.LumiAError?.showInline === "function"
    ) {
      try {
        window.LumiAError.clearInline?.(loginErrorContainer);

        window.LumiAError.showInline(loginErrorContainer, message);

        return;
      } catch (error) {
        console.error(
          "LumiA: 共通エラー表示を利用できません。",
          error?.name || "ErrorHandlerError",
        );
      }
    }

    // 共通ハンドラーが利用できない場合
    loginMessage.textContent = message;
    loginMessage.classList.remove("is-success");
  }

  // ==================================================
  // 11. エラー表示のクリア
  // ==================================================

  /**
   * 既存のエラー表示を削除する。
   */
  function clearLoginError() {
    if (
      loginErrorContainer &&
      typeof window.LumiAError?.clearInline === "function"
    ) {
      try {
        window.LumiAError.clearInline(loginErrorContainer);
      } catch (error) {
        console.error(
          "LumiA: エラー表示のクリアに失敗しました。",
          error?.name || "ErrorHandlerError",
        );
      }
    }

    loginMessage.textContent = "";
    loginMessage.classList.remove("is-success");
  }

  // ==================================================
  // 12. ログインフォーム
  // ==================================================

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // 処理中の重複送信を防止
    if (isTransitioning || isAuthenticating) {
      return;
    }

    // 前回のエラー表示を削除
    clearLoginError();

    const formData = new FormData(loginForm);

    const email = String(formData.get("username") || "").trim();

    const password = String(formData.get("password") || "");

    // ----------------------------------------------
    // 入力確認
    // ----------------------------------------------

    if (!email || !password) {
      loginMessage.textContent =
        "メールアドレスとパスワードを入力してください。";

      return;
    }

    // ----------------------------------------------
    // メールアドレス形式の確認
    // ----------------------------------------------

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      loginMessage.textContent = "正しいメールアドレスを入力してください。";

      return;
    }

    // ----------------------------------------------
    // 認証開始
    // ----------------------------------------------

    isAuthenticating = true;

    setPageControlsDisabled(true);

    loginMessage.textContent = "ログインしています。";

    try {
      // --------------------------------------------
      // Amazon Cognito認証
      // --------------------------------------------

      const result = await login(email, password);

      // --------------------------------------------
      // 追加認証が必要な場合
      // --------------------------------------------

      if (!result?.success) {
        const step = result?.nextStep?.signInStep;

        if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
          loginMessage.textContent =
            "初回ログインのため、パスワード変更が必要です。管理者にお問い合わせください。";
        } else {
          loginMessage.textContent =
            "追加の認証手続きが必要です。管理者にお問い合わせください。";
        }

        return;
      }

      // --------------------------------------------
      // 認証成功
      // --------------------------------------------

      loginMessage.textContent = "ログインしました。";

      loginMessage.classList.add("is-success");

      // 認証成功後にホーム画面へ遷移
      const transitioned = startPageTurn("../index.html");

      if (!transitioned) {
        showLoginError(
          "ホーム画面へ移動できませんでした。もう一度お試しください。",
        );
      }
    } catch (error) {
      // 内部エラー情報は画面に表示しない
      console.error(
        "LumiA: ログイン処理に失敗しました。",
        error?.name || "AuthenticationError",
      );

      const errorCode = error?.code || "";

      // --------------------------------------------
      // Cognito設定エラー
      // --------------------------------------------

      if (errorCode === "AUTH_CONFIG_ERROR") {
        redirectToError("system");
        return;
      }

      // --------------------------------------------
      // 認証セッションの重大なエラー
      // --------------------------------------------

      if (errorCode === "AUTH_SESSION_FAILED") {
        redirectToError("auth");
        return;
      }

      // --------------------------------------------
      // その他の認証処理エラー
      // --------------------------------------------

      if (errorCode === "AUTH_OPERATION_FAILED") {
        redirectToError("system");
        return;
      }

      // --------------------------------------------
      // 通信エラー・認証情報の不一致など
      // --------------------------------------------

      const message = getLoginErrorMessage(error);

      showLoginError(message);
    } finally {
      isAuthenticating = false;

      // ページ遷移中でなければ操作を再度有効化
      if (!isTransitioning) {
        setPageControlsDisabled(false);
      }
    }
  });

  // ==================================================
  // 13. ゲスト利用
  // ==================================================

  if (guestLink) {
    guestLink.addEventListener("click", (event) => {
      // 処理中の重複操作を防止
      if (isTransitioning || isAuthenticating) {
        event.preventDefault();
        return;
      }

      const destination = guestLink.getAttribute("href");

      if (!destination) {
        event.preventDefault();

        console.error("LumiA: ゲスト利用の遷移先が設定されていません。");

        showLoginError("ゲスト用ページへ移動できませんでした。");

        return;
      }

      // HTML標準のリンク遷移を止める
      event.preventDefault();

      // ゲスト用ページへ遷移
      const transitioned = startPageTurn(destination);

      if (!transitioned) {
        showLoginError("ゲスト用ページへ移動できませんでした。");
      }
    });
  }
}
