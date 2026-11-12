/*
==================================================
LumiA
ファイル名：api.js

【ファイル概要】
LumiA WebアプリとAWS API Gatewayを接続する。

【主な役割】
・API Gatewayへのリクエスト送信
・APIレスポンスの受信
・認証トークンの付与
・ゲスト通信への対応
・API通信エラーの共通処理

【関連ファイル】
・js/config.js
・js/auth.js
・js/question.js
・js/answer.js

【注意】
・APIエンドポイントはconfig.jsで管理する。
・認証トークンをログに出力しない。
・最終的な認証・認可はサーバー側で行う。

==================================================
*/

"use strict";

import { LUMIA_CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

// ==================================================
// APIエラークラス
// ==================================================

/**
 * API通信で発生したエラーを統一して扱う。
 */
export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ==================================================
// API接続先の取得
// ==================================================

/**
 * API Gatewayの接続先を取得する。
 */
function getApiBaseUrl() {
  const baseUrl = LUMIA_CONFIG.api.baseUrl;

  if (!baseUrl) {
    throw new ApiError("API Gatewayの接続先が設定されていません。");
  }

  try {
    const url = new URL(baseUrl);

    if (
      url.protocol !== "https:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      throw new Error("HTTPS接続が必要です。");
    }

    // クエリやフラグメントを含むベースURLは許可しない
    if (url.search || url.hash) {
      throw new Error("不正なURLです。");
    }

    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch (error) {
    throw new ApiError("API GatewayのURL設定が正しくありません。");
  }
}

// ==================================================
// 共通APIリクエスト
// ==================================================

/**
 * API Gatewayへリクエストを送信する。
 *
 * @param {string} path APIのパス
 * @param {object} options 通信設定
 * @returns {Promise<any>} APIレスポンス
 *
 * options:
 * method       HTTPメソッド
 * body         送信データ
 * headers      追加ヘッダー
 * authRequired 認証が必要かどうか
 */

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, authRequired = true } = {},
) {
  const baseUrl = getApiBaseUrl();

  // --------------------------------------------------
  // APIパスの検証
  // --------------------------------------------------

  if (
    typeof path !== "string" ||
    !path.trim() ||
    /^[a-z][a-z\d+.-]*:/i.test(path.trim()) ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new ApiError("APIのパス指定が正しくありません。");
  }

  // 先頭のスラッシュを除去
  const normalizedPath = path.trim().replace(/^\/+/, "");

  // API GatewayのベースURLを基準にURLを生成
  const endpoint = new URL(normalizedPath, baseUrl);
  const baseUrlObject = new URL(baseUrl);

  // 接続先のオリジンを検証
  if (endpoint.origin !== baseUrlObject.origin) {
    throw new ApiError("許可されていないAPI接続先です。");
  }

  // API Gatewayのステージパスから外れていないか検証
  const basePath = baseUrlObject.pathname.replace(/\/+$/, "");
  const endpointPath = endpoint.pathname;

  if (
    basePath &&
    endpointPath !== basePath &&
    !endpointPath.startsWith(`${basePath}/`)
  ) {
    throw new ApiError("許可されていないAPIパスです。");
  }

  // --------------------------------------------------
  // HTTPメソッドの検証
  // --------------------------------------------------

  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  const requestMethod = String(method).toUpperCase();

  if (!allowedMethods.includes(requestMethod)) {
    throw new ApiError("対応していないHTTPメソッドです。");
  }

  // --------------------------------------------------
  // リクエストヘッダー
  // --------------------------------------------------

  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    throw new ApiError("リクエストヘッダーの指定が正しくありません。");
  }

  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  // --------------------------------------------------
  // 認証トークンの付与
  // --------------------------------------------------

  if (authRequired) {
    let accessToken;

    try {
      accessToken = await getAccessToken();
    } catch (error) {
      throw new ApiError("認証情報を取得できませんでした。");
    }

    if (!accessToken) {
      throw new ApiError("ログインが必要です。", 401);
    }

    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  // --------------------------------------------------
  // リクエストデータの設定
  // --------------------------------------------------

  let requestBody;

  if (body !== undefined) {
    if (body instanceof FormData) {
      requestBody = body;
    } else {
      requestHeaders["Content-Type"] = "application/json";

      try {
        requestBody = JSON.stringify(body);
      } catch (error) {
        throw new ApiError("送信データをJSONに変換できませんでした。");
      }
    }
  }

  // --------------------------------------------------
  // API通信
  // --------------------------------------------------

  let response;

  try {
    response = await fetch(endpoint.href, {
      method: requestMethod,
      headers: requestHeaders,
      body: requestBody,
      credentials: "omit",
    });
  } catch (error) {
    console.error("LumiA: API通信エラー", error);

    throw new ApiError("サーバーとの通信に失敗しました。");
  }

  // --------------------------------------------------
  // レスポンスの取得
  // --------------------------------------------------

  const contentType = response.headers.get("content-type") || "";

  let responseData = null;

  if (response.status !== 204) {
    try {
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (error) {
      throw new ApiError(
        "サーバーからの応答を正しく読み取れませんでした。",
        response.status,
      );
    }
  }

  // --------------------------------------------------
  // HTTPエラー処理
  // --------------------------------------------------

  if (!response.ok) {
    throw new ApiError(
      "APIリクエストに失敗しました。",
      response.status,
      responseData,
    );
  }

  return responseData;
}

// ==================================================
// GETリクエスト
// ==================================================

/**
 * データ取得用リクエスト。
 */
export async function apiGet(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "GET",
  });
}

// ==================================================
// POSTリクエスト
// ==================================================

/**
 * データ送信用リクエスト。
 */
export async function apiPost(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "POST",
    body,
  });
}

// ==================================================
// ゲスト向け質問送信
// ==================================================

/**
 * ゲストユーザーの質問をAI回答APIへ送信する。
 *
 * @param {string} question 質問内容
 * @returns {Promise<object>} AI回答データ
 */
export async function sendGuestQuestion(question) {
  if (typeof question !== "string" || !question.trim()) {
    throw new ApiError("質問内容を入力してください。");
  }

  return apiPost(
    "guest/questions",
    {
      question: question.trim(),
    },
    {
      authRequired: false,
    },
  );
}
