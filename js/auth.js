/*
==================================================
LumiA
ファイル名：auth.js
バージョン：2.1

【ファイル概要】
LumiAのユーザー認証を管理する。

【主な役割】
・Amazon Cognito初期化
・ログイン処理
・ログアウト処理
・ログイン状態の確認
・ユーザー情報の取得
・アクセストークンの取得
・認証エラーの分類
・認証状態の適切な管理

【使用ライブラリ】
AWS Amplify Auth v6

【関連ファイル】
・js/config.js
・js/login.js
・js/api.js

【セキュリティ】
・Client Secretは使用しない。
・認証情報はAmplifyに管理させる。
・パスワードやアクセストークンをログに出力しない。
・ユーザー権限の最終判断はサーバー側で行う。
・未認証とシステムエラーを区別する。

==================================================
*/

"use strict";

import { Amplify } from "aws-amplify";

import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

import { LUMIA_CONFIG } from "./config.js";

// ==================================================
// 1. 認証エラークラス
// ==================================================

/**
 * 認証処理で発生したエラーを統一して扱う。
 *
 * code:
 * AUTH_CONFIG_ERROR      認証設定エラー
 * AUTH_REQUIRED          未認証
 * AUTH_SESSION_FAILED    認証セッション取得失敗
 * AUTH_OPERATION_FAILED  認証操作失敗
 */
export class LumiaAuthError extends Error {
  constructor(message, code = "AUTH_OPERATION_FAILED", cause = null) {
    super(message);

    this.name = "LumiaAuthError";
    this.code = code;

    if (cause) {
      this.cause = cause;
    }
  }
}

// ==================================================
// 2. Cognito初期化
// ==================================================

let isInitialized = false;

/**
 * Cognitoとの接続を初期化する。
 *
 * 初期化は一度だけ実行する。
 *
 * @returns {void}
 */
export function initializeAuth() {
  if (isInitialized) {
    return;
  }

  const cognitoConfig = LUMIA_CONFIG?.cognito;

  const region = cognitoConfig?.region;
  const userPoolId = cognitoConfig?.userPoolId;
  const userPoolClientId = cognitoConfig?.userPoolClientId;

  // Cognito設定の確認
  if (!region || !userPoolId || !userPoolClientId) {
    throw new LumiaAuthError(
      "Cognitoの接続設定が不足しています。",
      "AUTH_CONFIG_ERROR",
    );
  }

  // User Pool IDとリージョンの整合性確認
  if (!userPoolId.startsWith(`${region}_`)) {
    throw new LumiaAuthError(
      "Cognitoのリージョン設定が正しくありません。",
      "AUTH_CONFIG_ERROR",
    );
  }

  try {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    });

    isInitialized = true;
  } catch (error) {
    console.error(
      "LumiA: Cognitoの初期化に失敗しました。",
      error?.name || "UnknownError",
    );

    throw new LumiaAuthError(
      "Cognitoの初期化に失敗しました。",
      "AUTH_CONFIG_ERROR",
      error,
    );
  }
}

// ==================================================
// 3. 未認証状態の判定
// ==================================================

/**
 * Amplifyのエラーから未認証状態を判定する。
 *
 * 未ログインと通信障害などを区別するため、
 * 未認証を示す既知のエラーだけを対象にする。
 *
 * @param {Error} error 発生したエラー
 * @returns {boolean} 未認証の場合true
 */
function isUnauthenticatedError(error) {
  const errorName = error?.name;

  return ["UserUnAuthenticatedException", "UnauthenticatedException"].includes(
    errorName,
  );
}

// ==================================================
// 4. 認証エラーの共通生成
// ==================================================

/**
 * 認証エラーを統一して生成する。
 *
 * 既にLumiaAuthErrorの場合は、
 * 元のエラーコードを維持する。
 *
 * @param {Error} error 発生したエラー
 * @param {string} message 表示用メッセージ
 * @param {string} code エラーコード
 * @returns {LumiaAuthError}
 */
function normalizeAuthError(
  error,
  message = "認証処理に失敗しました。",
  code = "AUTH_OPERATION_FAILED",
) {
  if (error instanceof LumiaAuthError) {
    return error;
  }

  return new LumiaAuthError(message, code, error);
}

// ==================================================
// 5. ログイン
// ==================================================

/**
 * Cognitoでログインする。
 *
 * @param {string} username ユーザー名またはメールアドレス
 * @param {string} password パスワード
 * @returns {Promise<object>} 認証結果
 */
export async function login(username, password) {
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername || !password) {
    throw new LumiaAuthError(
      "ユーザー名とパスワードを入力してください。",
      "AUTH_REQUIRED",
    );
  }

  initializeAuth();

  let result;

  // Cognitoログイン
  try {
    result = await signIn({
      username: normalizedUsername,
      password,
    });
  } catch (error) {
    // Cognitoのエラー名をlogin.js側で判定できるよう、
    // 元のエラーを維持する。
    console.error(
      "LumiA: Cognitoログインに失敗しました。",
      error?.name || "UnknownError",
    );

    throw error;
  }

  // 初回パスワード変更などの追加認証が必要な場合
  if (!result.isSignedIn) {
    return {
      success: false,
      nextStep: result.nextStep,
    };
  }

  // ログイン成功後のユーザー情報取得
  try {
    const user = await getCurrentUser();

    return {
      success: true,
      user,
      nextStep: result.nextStep,
    };
  } catch (error) {
    console.error(
      "LumiA: ログイン後のユーザー情報取得に失敗しました。",
      error?.name || "UnknownError",
    );

    throw normalizeAuthError(
      error,
      "ログイン後のユーザー情報を取得できませんでした。",
      "AUTH_SESSION_FAILED",
    );
  }
}

// ==================================================
// 6. ログアウト
// ==================================================

/**
 * Cognitoからログアウトする。
 *
 * @returns {Promise<boolean>} 成功時true
 */
export async function logout() {
  initializeAuth();

  try {
    await signOut();

    return true;
  } catch (error) {
    console.error(
      "LumiA: ログアウトに失敗しました。",
      error?.name || "UnknownError",
    );

    throw normalizeAuthError(
      error,
      "ログアウトに失敗しました。",
      "AUTH_OPERATION_FAILED",
    );
  }
}

// ==================================================
// 7. ログイン状態確認
// ==================================================

/**
 * 現在のログイン状態を確認する。
 *
 * status:
 * authenticated   ログイン済み
 * unauthenticated 未ログイン
 * unknown         状態を確認できない
 *
 * @returns {Promise<object>} 認証状態
 */
export async function checkAuth() {
  try {
    initializeAuth();

    const user = await getCurrentUser();

    return {
      isAuthenticated: true,
      user,
      status: "authenticated",
      error: null,
    };
  } catch (error) {
    // 明確な未認証状態
    if (isUnauthenticatedError(error)) {
      return {
        isAuthenticated: false,
        user: null,
        status: "unauthenticated",
        error: null,
      };
    }

    // 設定エラー・セッションエラーなど
    console.error(
      "LumiA: ログイン状態を確認できませんでした。",
      error?.name || "UnknownError",
    );

    return {
      isAuthenticated: false,
      user: null,
      status: "unknown",
      error: normalizeAuthError(
        error,
        "ログイン状態を確認できませんでした。",
        "AUTH_SESSION_FAILED",
      ),
    };
  }
}

// ==================================================
// 8. ユーザー情報取得
// ==================================================

/**
 * 現在ログインしているユーザーを取得する。
 *
 * 未ログインの場合はnullを返す。
 * その他の認証エラーはLumiaAuthErrorとして返す。
 *
 * @returns {Promise<object|null>} ユーザー情報
 */
export async function getUserInfo() {
  try {
    initializeAuth();

    return await getCurrentUser();
  } catch (error) {
    // 未ログインの場合
    if (isUnauthenticatedError(error)) {
      return null;
    }

    console.error(
      "LumiA: ユーザー情報を取得できませんでした。",
      error?.name || "UnknownError",
    );

    throw normalizeAuthError(
      error,
      "ユーザー情報を取得できませんでした。",
      "AUTH_SESSION_FAILED",
    );
  }
}

// ==================================================
// 9. アクセストークン取得
// ==================================================

/**
 * API Gateway連携用のアクセストークンを取得する。
 *
 * Amplifyが必要に応じてセッションを更新する。
 *
 * @returns {Promise<string>} アクセストークン
 */
export async function getAccessToken() {
  try {
    initializeAuth();

    const session = await fetchAuthSession();

    const accessToken = session.tokens?.accessToken;

    // セッションにトークンが存在しない場合
    if (!accessToken) {
      throw new LumiaAuthError("ログインが必要です。", "AUTH_REQUIRED");
    }

    const tokenString = accessToken.toString();

    if (!tokenString) {
      throw new LumiaAuthError(
        "認証情報を取得できませんでした。",
        "AUTH_SESSION_FAILED",
      );
    }

    return tokenString;
  } catch (error) {
    // 自分で生成した認証エラーを維持する
    if (error instanceof LumiaAuthError) {
      throw error;
    }

    // 明確な未認証エラー
    if (isUnauthenticatedError(error)) {
      throw new LumiaAuthError("ログインが必要です。", "AUTH_REQUIRED", error);
    }

    // その他のセッション取得エラー
    console.error(
      "LumiA: アクセストークンを取得できませんでした。",
      error?.name || "UnknownError",
    );

    throw normalizeAuthError(
      error,
      "認証情報を取得できませんでした。",
      "AUTH_SESSION_FAILED",
    );
  }
}
