/*
==================================================
LumiA
ファイル名：auth.js

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
 * AUTH_CONFIG_ERROR
 * AUTH_REQUIRED
 * AUTH_SESSION_FAILED
 * AUTH_OPERATION_FAILED
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
 * 初期化は一度だけ実行する。
 */
export function initializeAuth() {
  if (isInitialized) {
    return;
  }

  const cognitoConfig = LUMIA_CONFIG?.cognito;

  const region = cognitoConfig?.region;
  const userPoolId = cognitoConfig?.userPoolId;
  const userPoolClientId = cognitoConfig?.userPoolClientId;

  if (!region || !userPoolId || !userPoolClientId) {
    throw new LumiaAuthError(
      "Cognitoの接続設定が不足しています。",
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
 */
function isUnauthenticatedError(error) {
  const errorName = error?.name;

  return ["UserUnAuthenticatedException", "UnauthenticatedException"].includes(
    errorName,
  );
}

// ==================================================
// 4. ログイン
// ==================================================

/**
 * Cognitoでログインする。
 *
 * @param {string} username ユーザー名またはメールアドレス
 * @param {string} password パスワード
 * @returns {Promise<object>} 認証結果
 */
export async function login(username, password) {
  initializeAuth();

  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername || !password) {
    throw new LumiaAuthError(
      "ユーザー名とパスワードを入力してください。",
      "AUTH_REQUIRED",
    );
  }

  try {
    const result = await signIn({
      username: normalizedUsername,
      password,
    });

    // 初回パスワード変更などの追加認証が必要な場合
    if (!result.isSignedIn) {
      return {
        success: false,
        nextStep: result.nextStep,
      };
    }

    const user = await getCurrentUser();

    return {
      success: true,
      user,
      nextStep: result.nextStep,
    };
  } catch (error) {
    // 認証情報そのものはログに出力しない
    console.error(
      "LumiA: Cognitoログインに失敗しました。",
      error?.name || "UnknownError",
    );

    throw error;
  }
}

// ==================================================
// 5. ログアウト
// ==================================================

/**
 * Cognitoからログアウトする。
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

    throw new LumiaAuthError(
      "ログアウトに失敗しました。",
      "AUTH_OPERATION_FAILED",
      error,
    );
  }
}

// ==================================================
// 6. ログイン状態確認
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
  initializeAuth();

  try {
    const user = await getCurrentUser();

    return {
      isAuthenticated: true,
      user,
      status: "authenticated",
      error: null,
    };
  } catch (error) {
    // 未ログインの場合
    if (isUnauthenticatedError(error)) {
      return {
        isAuthenticated: false,
        user: null,
        status: "unauthenticated",
        error: null,
      };
    }

    // 未認証以外のエラーは、未ログインと決めつけない
    console.error(
      "LumiA: ログイン状態を確認できませんでした。",
      error?.name || "UnknownError",
    );

    return {
      isAuthenticated: false,
      user: null,
      status: "unknown",
      error: new LumiaAuthError(
        "ログイン状態を確認できませんでした。",
        "AUTH_SESSION_FAILED",
        error,
      ),
    };
  }
}

// ==================================================
// 7. ユーザー情報取得
// ==================================================

/**
 * 現在ログインしているユーザーを取得する。
 *
 * 未ログインの場合はnullを返す。
 * その他の認証エラーは呼び出し元へ伝える。
 *
 * @returns {Promise<object|null>} ユーザー情報
 */
export async function getUserInfo() {
  initializeAuth();

  try {
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

    throw new LumiaAuthError(
      "ユーザー情報を取得できませんでした。",
      "AUTH_SESSION_FAILED",
      error,
    );
  }
}

// ==================================================
// 8. アクセストークン取得
// ==================================================

/**
 * API Gateway連携用のアクセストークンを取得する。
 *
 * @returns {Promise<string>} アクセストークン
 */
export async function getAccessToken() {
  initializeAuth();

  try {
    const session = await fetchAuthSession();

    const accessToken = session.tokens?.accessToken;

    // セッションにトークンが存在しない場合
    if (!accessToken) {
      throw new LumiaAuthError("ログインが必要です。", "AUTH_REQUIRED");
    }

    return accessToken.toString();
  } catch (error) {
    // 自分で生成した認証エラーはそのまま返す
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

    throw new LumiaAuthError(
      "認証情報を取得できませんでした。",
      "AUTH_SESSION_FAILED",
      error,
    );
  }
}
