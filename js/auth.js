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

【使用ライブラリ】
AWS Amplify Auth v6

【関連ファイル】
・js/config.js
・js/login.js
・js/api.js

【セキュリティ】
・Client Secretは使用しない。
・認証情報はAmplifyに管理させる。
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
// Cognito初期化
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

  const { region, userPoolId, userPoolClientId } = LUMIA_CONFIG.cognito;

  if (!region || !userPoolId || !userPoolClientId) {
    throw new Error("Cognitoの接続設定が不足しています。");
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });

  isInitialized = true;
}

// ==================================================
// ログイン
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
    throw new Error("ユーザー名とパスワードを入力してください。");
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
    console.error("LumiA: Cognitoログインエラー", error);

    throw error;
  }
}

// ==================================================
// ログアウト
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
    console.error("LumiA: ログアウトエラー", error);

    throw error;
  }
}

// ==================================================
// ログイン状態確認
// ==================================================

/**
 * 現在のログイン状態を確認する。
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
    };
  } catch {
    return {
      isAuthenticated: false,
      user: null,
    };
  }
}

// ==================================================
// ユーザー情報取得
// ==================================================

/**
 * 現在ログインしているユーザーを取得する。
 */
export async function getUserInfo() {
  initializeAuth();

  try {
    return await getCurrentUser();
  } catch (error) {
    console.error("LumiA: ユーザー情報取得エラー", error);

    return null;
  }
}

// ==================================================
// アクセストークン取得
// ==================================================

/**
 * API Gateway連携用のアクセストークンを取得する。
 */
export async function getAccessToken() {
  initializeAuth();

  try {
    const session = await fetchAuthSession();

    const accessToken = session.tokens?.accessToken;

    if (!accessToken) {
      throw new Error("有効なアクセストークンを取得できませんでした。");
    }

    return accessToken.toString();
  } catch (error) {
    console.error("LumiA: アクセストークン取得エラー", error);

    throw error;
  }
}
