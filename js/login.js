/*
==================================================
LumiA
ファイル名：login.js

【役割】
・パスワードの表示切り替え
・ログインフォームの入力確認
・Amazon Cognito認証との連携
・ページ遷移
・ゲスト利用時の画面遷移
・共通エラーハンドラーとの連携

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

document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // 1. DOM要素取得
  // ==================================================

  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");
  const loginMessage = document.getElementById("login-status");
  const loginErrorContainer = document.getElementById("login-error-container");

  const guestLink = document.querySelector(".login-form__guest");
  const loginScreen = document.querySelector(".login-screen");

  const loginButton = loginForm?.querySelector(
    '.login-form__submit[type="submit"]',
  );

  // 必須要素の確認
  if (!loginScreen) {
    console.error("LumiA: ログイン画面を初期化できません。");

    if (window.LumiAError?.redirect) {
      window.LumiAError.redirect("system");
    } else {
      window.location.href = "./error.html";
    }

    return;
  }

  // ==================================================
  // 2. 状態管理
  // ==================================================

  let isTransitioning = false;
  let isAuthenticating = false;

  // ==================================================
  // 3. 画面遷移
  // ==================================================

  /**
   * 指定されたページへ遷移する。
   *
   * ページめくりアニメーションの終了を待たず、
   * 通常のページ遷移を実行する。
   *
   * ゲスト利用とログイン成功時に使用する。
   */
  function startPageTurn(destination) {
    if (isTransitioning || !destination) {
      return;
    }

    isTransitioning = true;

    // 二重操作を防止
    if (loginButton) {
      loginButton.disabled = true;
    }

    if (guestLink) {
      guestLink.setAttribute("aria-disabled", "true");
      guestLink.style.pointerEvents = "none";
    }

    // 指定されたページへ直接遷移
    window.location.assign(destination);
  }

  // 認証処理などから呼び出せるように公開
  window.LumiAStartPageTurn = startPageTurn;

  // ==================================================
  // 4. 共通エラーハンドラー連携
  // ==================================================

  /**
   * 重大なエラーを共通エラーページへ遷移させる。
   */
  function redirectToError(type) {
    isTransitioning = true;

    if (loginButton) {
      loginButton.disabled = true;
    }

    if (guestLink) {
      guestLink.setAttribute("aria-disabled", "true");
      guestLink.style.pointerEvents = "none";
    }

    if (window.LumiAError?.redirect) {
      window.LumiAError.redirect(type);
      return;
    }

    // 共通ハンドラーが利用できない場合
    window.location.href = "./error.html";
  }

  // ==================================================
  // 5. パスワード表示・非表示
  // ==================================================

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const isVisible = passwordInput.type === "text";

      passwordInput.type = isVisible ? "password" : "text";

      passwordToggle.setAttribute("aria-pressed", String(!isVisible));

      passwordToggle.setAttribute(
        "aria-label",
        isVisible ? "パスワードを表示" : "パスワードを隠す",
      );
    });
  }

  // ==================================================
  // 6. ログインエラー処理
  // ==================================================

  /**
   * Cognitoや通信エラーを安全なメッセージに変換する。
   *
   * AWSやCognitoの内部情報は画面に表示しない。
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
        return "アクセスが集中しています。しばらくしてから再度お試しください。";

      case "NetworkError":
      case "TypeError":
        return "通信に失敗しました。ネットワークを確認してください。";

      default:
        break;
    }

    // 共通認証エラーコードへの対応
    if (errorCode === "NETWORK") {
      return "通信に失敗しました。ネットワークを確認してください。";
    }

    if (errorCode === "AUTH_REQUIRED") {
      return "ログインが必要です。入力内容を確認してください。";
    }

    return "ログインに失敗しました。入力内容と接続状況を確認してください。";
  }

  /**
   * ログインエラーを画面内に表示する。
   *
   * 共通ハンドラーが利用できる場合はshowInlineを使用する。
   */
  function showLoginError(message) {
    if (loginErrorContainer && window.LumiAError?.showInline) {
      if (window.LumiAError?.clearInline) {
        window.LumiAError.clearInline(loginErrorContainer);
      }

      window.LumiAError.showInline(loginErrorContainer, message);

      return;
    }

    // 共通ハンドラーが利用できない場合の代替表示
    if (loginMessage) {
      loginMessage.textContent = message;
      loginMessage.classList.remove("is-success");
    }
  }

  /**
   * 既存のエラー表示を削除する。
   */
  function clearLoginError() {
    if (loginErrorContainer && window.LumiAError?.clearInline) {
      window.LumiAError.clearInline(loginErrorContainer);
    }

    if (loginMessage) {
      loginMessage.textContent = "";
      loginMessage.classList.remove("is-success");
    }
  }

  // ==================================================
  // 7. ログインフォーム
  // ==================================================

  if (loginForm && loginMessage) {
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

      if (loginButton) {
        loginButton.disabled = true;
      }

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
        startPageTurn("../index.html");
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

        // ページ遷移中でなければボタンを再度有効化
        if (loginButton && !isTransitioning) {
          loginButton.disabled = false;
        }
      }
    });
  } else {
    console.error(
      "LumiA: ログインフォームまたはメッセージ欄を初期化できません。",
    );
  }

  // ==================================================
  // 8. ゲスト利用
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

        return;
      }

      // HTML標準のリンク遷移を止める
      event.preventDefault();

      // ゲスト用ホーム画面へ直接遷移
      startPageTurn(destination);
    });
  }
});
