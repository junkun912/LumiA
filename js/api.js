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
・エラー種別の分類

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
import { getAccessToken, LumiaAuthError } from "./auth.js";

// ==================================================
// 1. APIエラークラス
// ==================================================

/**
 * API通信で発生したエラーを統一して扱う。
 *
 * code:
 * CONFIG              API設定エラー
 * AUTH_REQUIRED       認証が必要
 * AUTH_SESSION_FAILED 認証セッション取得失敗
 * FORBIDDEN           アクセス拒否
 * NETWORK             通信エラー
 * DATA                データ形式エラー
 * SERVER              サーバーエラー
 * API_ERROR           その他のAPIエラー
 */
export class ApiError extends Error {
  constructor(
    message,
    status = 0,
    data = null,
    code = "API_ERROR",
    cause = null,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = code;

    if (cause) {
      this.cause = cause;
    }
  }
}

// ==================================================
// 2. API接続先の取得
// ==================================================

/**
 * API Gatewayの接続先を取得する。
 */
function getApiBaseUrl() {
  const baseUrl = LUMIA_CONFIG?.api?.baseUrl;

  if (!baseUrl) {
    throw new ApiError(
      "API Gatewayの接続先が設定されていません。",
      0,
      null,
      "CONFIG",
    );
  }

  try {
    const url = new URL(baseUrl);

    // HTTPSまたはローカル環境のみ許可
    const isHttps = url.protocol === "https:";
    const isLocalhost =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);

    if (!isHttps && !isLocalhost) {
      throw new Error("HTTPS接続が必要です。");
    }

    // クエリやフラグメントを含むベースURLは許可しない
    if (url.search || url.hash) {
      throw new Error("不正なURLです。");
    }

    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      "API GatewayのURL設定が正しくありません。",
      0,
      null,
      "CONFIG",
      error,
    );
  }
}

// ==================================================
// 3. APIパスの検証
// ==================================================

/**
 * APIパスを検証し、安全なURLを生成する。
 *
 * @param {string} path APIのパス
 * @param {string} baseUrl API GatewayのベースURL
 * @returns {URL} 検証済みURL
 */
function createEndpoint(path, baseUrl) {
  if (
    typeof path !== "string" ||
    !path.trim() ||
    /^[a-z][a-z\d+.-]*:/i.test(path.trim()) ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes("\\")
  ) {
    throw new ApiError("APIのパス指定が正しくありません。", 0, null, "CONFIG");
  }

  // 先頭のスラッシュを除去
  const normalizedPath = path.trim().replace(/^\/+/, "");

  if (!normalizedPath) {
    throw new ApiError("APIのパス指定が正しくありません。", 0, null, "CONFIG");
  }

  const endpoint = new URL(normalizedPath, baseUrl);
  const baseUrlObject = new URL(baseUrl);

  // 接続先のオリジンを検証
  if (endpoint.origin !== baseUrlObject.origin) {
    throw new ApiError("許可されていないAPI接続先です。", 0, null, "CONFIG");
  }

  // API Gatewayのステージパスから外れていないか検証
  const basePath = baseUrlObject.pathname.replace(/\/+$/, "");
  const endpointPath = endpoint.pathname;

  if (
    basePath &&
    endpointPath !== basePath &&
    !endpointPath.startsWith(`${basePath}/`)
  ) {
    throw new ApiError("許可されていないAPIパスです。", 0, null, "CONFIG");
  }

  return endpoint;
}

// ==================================================
// 4. HTTPステータスの分類
// ==================================================

/**
 * HTTPステータスに応じてエラーコードを返す。
 */
function getHttpErrorCode(status) {
  if (status === 401) {
    return "AUTH_REQUIRED";
  }

  if (status === 403) {
    return "FORBIDDEN";
  }

  if (status >= 500) {
    return "SERVER";
  }

  if ([400, 404, 409, 422].includes(status)) {
    return "DATA";
  }

  return "API_ERROR";
}

/**
 * HTTPステータスに応じたメッセージを返す。
 */
function getHttpErrorMessage(status) {
  switch (status) {
    case 400:
      return "リクエストの内容を確認してください。";

    case 401:
      return "ログインが必要です。";

    case 403:
      return "この操作を行う権限がありません。";

    case 404:
      return "要求されたデータが見つかりませんでした。";

    case 409:
      return "データの状態が変更されています。";

    case 422:
      return "送信したデータを処理できませんでした。";

    default:
      if (status >= 500) {
        return "サーバーで問題が発生しました。時間をおいて再度お試しください。";
      }

      return "APIリクエストに失敗しました。";
  }
}

// ==================================================
// 5. 認証エラーの変換
// ==================================================

/**
 * auth.jsの認証エラーをAPIエラーに変換する。
 */
function convertAuthError(error) {
  if (error instanceof LumiaAuthError) {
    switch (error.code) {
      case "AUTH_REQUIRED":
        return new ApiError(
          "ログインが必要です。",
          401,
          null,
          "AUTH_REQUIRED",
          error,
        );

      case "AUTH_SESSION_FAILED":
        return new ApiError(
          "認証情報を取得できませんでした。",
          0,
          null,
          "AUTH_SESSION_FAILED",
          error,
        );

      case "AUTH_CONFIG_ERROR":
        return new ApiError(
          "認証システムの設定に問題があります。",
          0,
          null,
          "CONFIG",
          error,
        );

      default:
        return new ApiError(
          "認証処理に失敗しました。",
          0,
          null,
          "AUTH_SESSION_FAILED",
          error,
        );
    }
  }

  return new ApiError(
    "認証情報を取得できませんでした。",
    0,
    null,
    "AUTH_SESSION_FAILED",
    error,
  );
}

// ==================================================
// 6. 共通APIリクエスト
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
  // --------------------------------------------------
  // API接続先の取得
  // --------------------------------------------------

  const baseUrl = getApiBaseUrl();

  // --------------------------------------------------
  // APIパスの検証
  // --------------------------------------------------

  const endpoint = createEndpoint(path, baseUrl);

  // --------------------------------------------------
  // HTTPメソッドの検証
  // --------------------------------------------------

  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  const requestMethod = String(method).toUpperCase();

  if (!allowedMethods.includes(requestMethod)) {
    throw new ApiError("対応していないHTTPメソッドです。", 0, null, "CONFIG");
  }

  // --------------------------------------------------
  // リクエストヘッダーの検証
  // --------------------------------------------------

  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    throw new ApiError(
      "リクエストヘッダーの指定が正しくありません。",
      0,
      null,
      "CONFIG",
    );
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
      throw convertAuthError(error);
    }

    if (!accessToken) {
      throw new ApiError("ログインが必要です。", 401, null, "AUTH_REQUIRED");
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
        throw new ApiError(
          "送信データをJSONに変換できませんでした。",
          0,
          null,
          "DATA",
          error,
        );
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
    // トークンやリクエストデータはログに出さない
    console.error(
      "LumiA: API通信に失敗しました。",
      error?.name || "NetworkError",
    );

    throw new ApiError(
      "サーバーとの通信に失敗しました。",
      0,
      null,
      "NETWORK",
      error,
    );
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
        null,
        "DATA",
        error,
      );
    }
  }

  // --------------------------------------------------
  // HTTPエラー処理
  // --------------------------------------------------

  if (!response.ok) {
    const errorCode = getHttpErrorCode(response.status);

    throw new ApiError(
      getHttpErrorMessage(response.status),
      response.status,
      responseData,
      errorCode,
    );
  }

  return responseData;
}

// ==================================================
// 7. GETリクエスト
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
// 8. POSTリクエスト
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
// 9. ゲスト向け質問送信
// ==================================================

/**
 * ゲストユーザーの質問をAI回答APIへ送信する。
 *
 * @param {string} question 質問内容
 * @returns {Promise<object>} AI回答データ
 */
export async function sendGuestQuestion(question) {
  if (typeof question !== "string" || !question.trim()) {
    throw new ApiError("質問内容を入力してください。", 0, null, "DATA");
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
