/*
==================================================
LumiA
ファイル名：config.js

【役割】
AWSサービスの接続設定を一元管理する。

【接続サービス】
・Amazon Cognito
・Amazon API Gateway

==================================================
*/

"use strict";

export const LUMIA_CONFIG = {
  // ==================================================
  // Amazon Cognito
  // ==================================================

  cognito: {
    region: "ap-northeast-1",
    userPoolId: "ap-northeast-1_n7wPY9OWS",
    userPoolClientId: "21t1134bvl1dfo6o8lfcleg4i0",
  },

  // ==================================================
  // Amazon API Gateway
  // ==================================================

  api: {
    baseUrl: "",
  },
};
