"use strict";

// Clash Verge Rev subscription script v2.8 (链式代理安全增强版)
// 分流策略：
// 1. Edge 浏览器：智能分流（国内直连，国外走代理）
// 2. 其他浏览器：全部走代理（不分国内外）
// 3. 其他应用：智能分流（国内直连，国外走代理）
// 4. 所有落地订阅节点通过前置订阅节点建连，最终网站看到的仍是落地 VPS IP

var SUB = {
  Front: "https://YOUR_FRONT_SUBSCRIPTION_URL",
  Edge: "https://YOUR_EDGE_SUBSCRIPTION_URL",
  Chrome: "https://YOUR_CHROME_SUBSCRIPTION_URL",
  Firefox: "https://YOUR_FIREFOX_SUBSCRIPTION_URL",
  Brave: "https://YOUR_BRAVE_SUBSCRIPTION_URL",
  LibreWolf: "https://YOUR_LIBREWOLF_SUBSCRIPTION_URL",
  Vivaldi: "https://YOUR_VIVALDI_SUBSCRIPTION_URL",
  Opera: "https://YOUR_OPERA_SUBSCRIPTION_URL",
  OtherApps: "",
  Default: "https://YOUR_DEFAULT_SUBSCRIPTION_URL"
};

// 开启后：Edge/Chrome/Firefox/Brave/LibreWolf/Vivaldi/Opera/Default/OtherApps
// 这些落地订阅里的每个节点都会通过 FrontProxy 前置组建连。
// 链路形态：本机 -> FrontProxy(购买订阅) -> 浏览器专属落地 VPS 节点 -> 目标网站。
var ENABLE_CHAIN_PROXY = true;

// 开启后移除最终兜底里的 DIRECT，避免前置或落地全挂时泄漏本机公网 IP。
// 链式代理场景默认安全优先：失败应断网，不应退回本机直连。
var STRICT_NO_DIRECT_FALLBACK = true;

// 是否允许在 FrontProxy 里手动选择 DIRECT 作为应急调试。
// 默认 false，避免误选后变成“本机直连落地节点”。
var FRONT_PROXY_ALLOW_DIRECT_FALLBACK = false;

// 调试用途：允许 FinalFallback 保留 DIRECT。默认关闭。
// 正常链式代理请保持 false，避免前置或落地失效时泄漏本机 IP。
var EMERGENCY_DIRECT_TO_LANDING = false;

// 保留原始直连规则。默认 true：Edge 国内网站、其他应用国内网站仍可直连。
// 如果你的目标是“任何网站都不能看到本机 IP”，改成 false。
var ALLOW_DIRECT_RULES = true;

// DIRECT 表示订阅文件本身直连下载；不影响节点流量链式代理。
// 如果你的落地订阅地址必须通过前置订阅才能下载，可改成 "FrontProxy"。
var LANDING_PROVIDER_DOWNLOAD_PROXY = "DIRECT";

// 前置订阅文件的下载方式。通常必须保持 DIRECT，避免启动时循环依赖。
var FRONT_PROVIDER_DOWNLOAD_PROXY = "DIRECT";

// 落地节点协议过滤。留空表示不过滤，支持 AnyTLS 等任意落地协议。
// 如果你的 Mihomo 版本或环境不兼容某协议，可填 "anytls" 等类型名。
var LANDING_PROVIDER_EXCLUDE_TYPE = "";

// 链式代理时是否禁用落地节点 UDP。TCP 类协议通常最稳；
// Hysteria2/TUIC/QUIC 等 UDP 类落地协议要求前置节点也支持 UDP 转发。
var CHAIN_DISABLE_UDP = false;

var CHAIN_NODE_PREFIX = "[Chain] ";

// 前置订阅节点过滤。购买订阅节点很多时，可只保留更适合作前置的地区或协议。
// 例："香港|台湾|日本|新加坡"，留空表示不过滤。
var FRONT_NODE_FILTER = "";

// 排除不适合作前置的节点。默认不过滤；可按需填 "hysteria2|tuic|wireguard"。
var FRONT_NODE_EXCLUDE_FILTER = "";

// 前置节点选择策略：
// "fallback" 稳定优先；"url-test" 延迟优先；"select" 手动选择；"load-balance" 分散连接。
var FRONT_SELECTION_MODE = "fallback";
var FRONT_LOAD_BALANCE_STRATEGY = "consistent-hashing";

// 是否为链式代理启用专用 proxy-server-nameserver。
// proxy-server-nameserver 只解析代理节点 server 域名，不等于隐藏所有 DNS。
// 这里默认仍沿用国内纯 IP DNS，避免 DoH 递归和部分 Mihomo 版本兼容问题。
var CHAIN_PROXY_DNS_ENABLED = false;
var CHAIN_PROXY_SERVER_NAMESERVER = ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"];

var SUBSCRIPTION_UPDATE_INTERVAL = {
  front: 43200,
  landing: 86400
};

var HEALTH_CHECK_URLS = {
  front: "https://www.gstatic.com/generate_204",
  landing: "https://www.gstatic.com/generate_204"
};

var BROWSERS = [
  { key: "Edge", group: "EdgeProxy", provider: "provider-edge", path: "./providers/edge.yaml", fp: "chrome", processes: ["msedge.exe"], smartRoute: true },
  { key: "Chrome", group: "ChromeProxy", provider: "provider-chrome", path: "./providers/chrome.yaml", fp: "chrome", processes: ["chrome.exe"], smartRoute: false },
  { key: "Firefox", group: "FirefoxProxy", provider: "provider-firefox", path: "./providers/firefox.yaml", fp: "firefox", processes: ["firefox.exe"], smartRoute: false },
  { key: "Brave", group: "BraveProxy", provider: "provider-brave", path: "./providers/brave.yaml", fp: "chrome", processes: ["brave.exe"], smartRoute: false },
  { key: "LibreWolf", group: "LibreWolfProxy", provider: "provider-librewolf", path: "./providers/librewolf.yaml", fp: "firefox", processes: ["librewolf.exe"], smartRoute: false },
  { key: "Vivaldi", group: "VivaldiProxy", provider: "provider-vivaldi", path: "./providers/vivaldi.yaml", fp: "chrome", processes: ["vivaldi.exe"], smartRoute: false },
  { key: "Opera", group: "OperaProxy", provider: "provider-opera", path: "./providers/opera.yaml", fp: "chrome", processes: ["opera.exe", "operagx.exe"], smartRoute: false }
];

var HEALTH_CHECK_FRONT = {
  enable: true,
  url: HEALTH_CHECK_URLS.front,
  interval: 300,
  timeout: 4000,
  lazy: false,
  "expected-status": 204
};

var HEALTH_CHECK_LANDING_DIRECT = {
  enable: true,
  url: HEALTH_CHECK_URLS.landing,
  interval: 300,
  timeout: 3000,
  lazy: true,
  "expected-status": 204
};

var HEALTH_CHECK_LANDING_CHAIN = {
  enable: true,
  url: HEALTH_CHECK_URLS.landing,
  interval: 300,
  timeout: 8000,
  lazy: true,
  "expected-status": 204
};

var DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];
var FOREIGN_DNS = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query", "https://9.9.9.9/dns-query"];

function main(config, profileName) {
  if (!config || typeof config !== "object") {
    config = {};
  }

  validateSubscriptions();

  config.mode = "rule";
  config.ipv6 = false;
  config["allow-lan"] = false;
  config["bind-address"] = "127.0.0.1";
  config["log-level"] = "info";
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["find-process-mode"] = "always";
  config["keep-alive-interval"] = 30;

  config.profile = {
    "store-selected": true,
    "store-fake-ip": true
  };

  config.tun = {
    enable: true,
    stack: "mixed",
    device: "Mihomo",
    "auto-route": true,
    "strict-route": true,
    "auto-detect-interface": true,
    "dns-hijack": ["any:53"],
    ipv6: false,
    "endpoint-independent-nat": false
  };

  config.sniffer = {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": false,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443], "override-destination": true },
      QUIC: { ports: [443, 8443] }
    },
    "skip-domain": [
      "Mijia Cloud",
      "dlg.io.mi.com",
      "+.apple.com"
    ]
  };

  config.dns = buildDns();
  config.proxies = [];
  config["proxy-providers"] = buildProviders();
  config["proxy-groups"] = buildGroups();
  config["rule-providers"] = buildRuleProviders();
  config.rules = buildRules();

  return config;
}

function validateSubscriptions() {
  validateDownloadProxy();
  validateFrontStrategy();

  var keys = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera", "Default"];
  if (needsFrontProxy()) {
    keys.unshift("Front");
  }

  var i;
  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    validateRequiredSubscription(key, SUB[key]);
  }

  if (SUB.OtherApps && SUB.OtherApps.indexOf("YOUR_") < 0) {
    validateOptionalSubscription("OtherApps", SUB.OtherApps);
  }

  if (needsFrontProxy()) {
    validateFrontIsDifferentFromLanding();
  }
}

function validateDownloadProxy() {
  if (FRONT_PROVIDER_DOWNLOAD_PROXY !== "DIRECT") {
    throw new Error("FRONT_PROVIDER_DOWNLOAD_PROXY must be DIRECT to avoid front subscription circular dependency");
  }

  if (LANDING_PROVIDER_DOWNLOAD_PROXY !== "DIRECT" && LANDING_PROVIDER_DOWNLOAD_PROXY !== "FrontProxy") {
    throw new Error("LANDING_PROVIDER_DOWNLOAD_PROXY must be DIRECT or FrontProxy");
  }

  if (LANDING_PROVIDER_DOWNLOAD_PROXY === "FrontProxy" && !ENABLE_CHAIN_PROXY) {
    throw new Error("LANDING_PROVIDER_DOWNLOAD_PROXY=FrontProxy requires ENABLE_CHAIN_PROXY=true");
  }

  if (FRONT_PROXY_ALLOW_DIRECT_FALLBACK && STRICT_NO_DIRECT_FALLBACK) {
    throw new Error("FRONT_PROXY_ALLOW_DIRECT_FALLBACK cannot be true while STRICT_NO_DIRECT_FALLBACK is true");
  }

  if (EMERGENCY_DIRECT_TO_LANDING && STRICT_NO_DIRECT_FALLBACK) {
    throw new Error("EMERGENCY_DIRECT_TO_LANDING cannot be true while STRICT_NO_DIRECT_FALLBACK is true");
  }
}

function validateFrontStrategy() {
  if (FRONT_SELECTION_MODE !== "fallback" && FRONT_SELECTION_MODE !== "url-test" && FRONT_SELECTION_MODE !== "select" && FRONT_SELECTION_MODE !== "load-balance") {
    throw new Error("FRONT_SELECTION_MODE must be fallback, url-test, select, or load-balance");
  }

  if (CHAIN_PROXY_DNS_ENABLED && (!CHAIN_PROXY_SERVER_NAMESERVER || CHAIN_PROXY_SERVER_NAMESERVER.length === 0)) {
    throw new Error("CHAIN_PROXY_SERVER_NAMESERVER cannot be empty when CHAIN_PROXY_DNS_ENABLED is true");
  }
}

function validateRequiredSubscription(key, url) {
  if (!url || typeof url !== "string") {
    throw new Error("Missing subscription URL: " + key);
  }
  if (url.indexOf("YOUR_") >= 0) {
    throw new Error("Subscription URL placeholder not replaced: " + key);
  }
  validateOptionalSubscription(key, url);
}

function validateOptionalSubscription(key, url) {
  if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) {
    throw new Error("Invalid subscription URL: " + key + " -> " + url);
  }
}

function validateFrontIsDifferentFromLanding() {
  var keys = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera", "Default"];
  var front = SUB.Front;
  var i;

  for (i = 0; i < keys.length; i++) {
    if (SUB[keys[i]] === front) {
      throw new Error("Front subscription and landing subscription cannot be the same: " + keys[i]);
    }
  }

  if (SUB.OtherApps && SUB.OtherApps.indexOf("YOUR_") < 0 && SUB.OtherApps === front) {
    throw new Error("Front subscription and landing subscription cannot be the same: OtherApps");
  }
}

function buildDns() {
  var proxyServerNameserver = ["223.5.5.5", "119.29.29.29"];
  if (ENABLE_CHAIN_PROXY && CHAIN_PROXY_DNS_ENABLED) {
    proxyServerNameserver = CHAIN_PROXY_SERVER_NAMESERVER;
  }

  return {
    enable: true,
    listen: "0.0.0.0:1053",
    ipv6: false,
    "prefer-h3": false,
    "respect-rules": true,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": [
      "+.lan",
      "+.local",
      "localhost.ptlogin2.qq.com",
      "+.srv.nintendo.net",
      "+.stun.playstation.net",
      "xbox.*.microsoft.com",
      "+.xboxlive.com",
      "+.msftconnecttest.com",
      "+.msftncsi.com",
      "time.*.com",
      "ntp.*.com",
      "+.ntp.org.cn",
      "+.pool.ntp.org",
      "connectivitycheck.platform.hicloud.com",
      "connectivitycheck.gstatic.com",
      "captive.apple.com",
      "+.windowsupdate.com",
      "*.update.microsoft.com"
    ],
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    nameserver: DOMESTIC_DNS,
    "proxy-server-nameserver": proxyServerNameserver,
    "nameserver-policy": {
      "geosite:private": DOMESTIC_DNS,
      "geosite:cn": DOMESTIC_DNS,
      "geosite:geolocation-cn": DOMESTIC_DNS,
      "geosite:category-games@cn": DOMESTIC_DNS,
      "geosite:gfw": FOREIGN_DNS,
      "geosite:geolocation-!cn": FOREIGN_DNS,
      "+.998488.xyz": DOMESTIC_DNS,
      "+.jsdelivr.net": DOMESTIC_DNS,
      "+.githubusercontent.com": DOMESTIC_DNS
    },
    fallback: FOREIGN_DNS,
    "fallback-filter": {
      geoip: true,
      "geoip-code": "CN",
      ipcidr: ["240.0.0.0/4", "0.0.0.0/32"]
    }
  };
}

function buildProviders() {
  var providers = {};
  var i;

  if (needsFrontProxy()) {
    providers["provider-front"] = makeFrontProvider(SUB.Front, "./providers/front.yaml");
  }

  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    providers[b.provider] = makeProvider(SUB[b.key], b.path, b.fp, b.key + " | ");
  }

  providers["provider-default"] = makeProvider(SUB.Default, "./providers/default.yaml", "chrome", "Default | ");
  providers["provider-other-apps"] = makeProvider(getOtherAppsUrl(), "./providers/other-apps.yaml", "chrome", "OtherApps | ");
  return providers;
}

function getOtherAppsUrl() {
  if (!SUB.OtherApps || SUB.OtherApps.indexOf("YOUR_") >= 0) {
    return SUB.Default;
  }
  return SUB.OtherApps;
}

function makeFrontProvider(url, path) {
  var provider = {
    type: "http",
    url: url,
    interval: SUBSCRIPTION_UPDATE_INTERVAL.front,
    path: path,
    proxy: FRONT_PROVIDER_DOWNLOAD_PROXY,
    "health-check": HEALTH_CHECK_FRONT,
    override: {
      udp: true,
      "client-fingerprint": "chrome",
      "additional-prefix": "Front | "
    }
  };

  if (FRONT_NODE_FILTER) {
    provider.filter = FRONT_NODE_FILTER;
  }

  if (FRONT_NODE_EXCLUDE_FILTER) {
    provider["exclude-filter"] = FRONT_NODE_EXCLUDE_FILTER;
  }

  return provider;
}

function makeProvider(url, path, fp, prefix) {
  var finalPrefix = ENABLE_CHAIN_PROXY ? CHAIN_NODE_PREFIX + prefix : prefix;
  var provider = {
    type: "http",
    url: url,
    interval: SUBSCRIPTION_UPDATE_INTERVAL.landing,
    path: path,
    proxy: LANDING_PROVIDER_DOWNLOAD_PROXY,
    "health-check": getLandingHealthCheck(),
    override: {
      udp: !(ENABLE_CHAIN_PROXY && CHAIN_DISABLE_UDP),
      "client-fingerprint": fp,
      "additional-prefix": finalPrefix
    }
  };

  if (LANDING_PROVIDER_EXCLUDE_TYPE) {
    provider["exclude-type"] = LANDING_PROVIDER_EXCLUDE_TYPE;
  }

  if (ENABLE_CHAIN_PROXY) {
    provider.override["dialer-proxy"] = "FrontProxy";
  }

  return provider;
}

function getLandingHealthCheck() {
  if (ENABLE_CHAIN_PROXY) {
    return HEALTH_CHECK_LANDING_CHAIN;
  }
  return HEALTH_CHECK_LANDING_DIRECT;
}

function makeUrlTestGroup(name, provider, role) {
  var isFront = role === "front";
  var timeout = isFront ? 4000 : (ENABLE_CHAIN_PROXY ? 8000 : 3000);
  var tolerance = isFront ? 50 : (ENABLE_CHAIN_PROXY ? 100 : 50);

  return {
    name: name,
    type: "url-test",
    use: [provider],
    url: isFront ? HEALTH_CHECK_URLS.front : HEALTH_CHECK_URLS.landing,
    interval: 300,
    timeout: timeout,
    lazy: !isFront,
    "expected-status": 204,
    tolerance: tolerance,
    "disable-udp": ENABLE_CHAIN_PROXY && CHAIN_DISABLE_UDP && !isFront
  };
}

function buildGroups() {
  var groups = [];
  var i;

  if (needsFrontProxy()) {
    if (FRONT_SELECTION_MODE === "select") {
      groups.push(makeFrontAutoGroup());
    }
    groups.push(makeFrontProxyGroup());
  }

  // 其他浏览器：纯代理组
  for (i = 0; i < BROWSERS.length; i++) {
    groups.push(makeUrlTestGroup(BROWSERS[i].group, BROWSERS[i].provider));
  }

  groups.push(makeUrlTestGroup("DefaultProxy", "provider-default"));
  groups.push(makeUrlTestGroup("OtherAppsProxy", "provider-other-apps"));
  groups.push({ name: "Direct", type: "select", proxies: ["DIRECT"] });
  groups.push({ name: "AdBlock", type: "select", proxies: ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ name: "FinalFallback", type: "select", proxies: buildFinalFallbackProxies() });

  return groups;
}

function needsFrontProxy() {
  return ENABLE_CHAIN_PROXY || LANDING_PROVIDER_DOWNLOAD_PROXY === "FrontProxy";
}

function makeFrontProxyGroup() {
  var proxies = ["FrontAuto"];
  if (FRONT_PROXY_ALLOW_DIRECT_FALLBACK && !STRICT_NO_DIRECT_FALLBACK) {
    proxies.push("DIRECT");
  }

  if (FRONT_SELECTION_MODE === "select") {
    return {
      name: "FrontProxy",
      type: "select",
      proxies: proxies,
      use: ["provider-front"]
    };
  }

  return makeFrontAutoGroup("FrontProxy");
}

function makeFrontAutoGroup(name) {
  if (!name) {
    name = "FrontAuto";
  }

  if (FRONT_SELECTION_MODE === "url-test") {
    return makeUrlTestGroup(name, "provider-front", "front");
  }

  if (FRONT_SELECTION_MODE === "load-balance") {
    return {
      name: name,
      type: "load-balance",
      use: ["provider-front"],
      url: HEALTH_CHECK_URLS.front,
      interval: 60,
      timeout: 4000,
      lazy: false,
      strategy: FRONT_LOAD_BALANCE_STRATEGY
    };
  }

  return {
    name: name,
    type: "fallback",
    use: ["provider-front"],
    url: HEALTH_CHECK_URLS.front,
    interval: 60,
    timeout: 4000,
    lazy: false,
    "expected-status": 204
  };
}

function buildFinalFallbackProxies() {
  var proxies = ["OtherAppsProxy", "DefaultProxy"];
  if (!ENABLE_CHAIN_PROXY && !STRICT_NO_DIRECT_FALLBACK) {
    proxies.push("DIRECT");
  } else if (ENABLE_CHAIN_PROXY && EMERGENCY_DIRECT_TO_LANDING && !STRICT_NO_DIRECT_FALLBACK) {
    proxies.push("DIRECT");
  }
  return proxies;
}

function buildRuleProviders() {
  return {};
}

function buildRules() {
  var rules = [];
  var i;
  var j;

  // DNS 规则
  rules.push("IP-CIDR,1.1.1.1/32,DefaultProxy,no-resolve");
  rules.push("IP-CIDR,1.0.0.1/32,DefaultProxy,no-resolve");
  rules.push("IP-CIDR,9.9.9.9/32,DefaultProxy,no-resolve");
  if (ALLOW_DIRECT_RULES) {
    rules.push("IP-CIDR,223.5.5.5/32,Direct,no-resolve");
    rules.push("IP-CIDR,119.29.29.29/32,Direct,no-resolve");
  } else {
    rules.push("IP-CIDR,223.5.5.5/32,DefaultProxy,no-resolve");
    rules.push("IP-CIDR,119.29.29.29/32,DefaultProxy,no-resolve");
  }

  // Clash 自身进程直连
  rules.push("PROCESS-NAME,verge-mihomo.exe,Direct");
  rules.push("PROCESS-NAME,mihomo.exe,Direct");
  rules.push("PROCESS-NAME,clash-verge.exe,Direct");

  // 系统服务直连
  if (ALLOW_DIRECT_RULES) {
    rules.push("PROCESS-NAME,DeliveryOptimization.exe,Direct");
    rules.push("AND,((NETWORK,UDP),(DST-PORT,123)),Direct");
    rules.push("DOMAIN-SUFFIX,ntp.org,Direct");
    rules.push("DOMAIN-SUFFIX,msftconnecttest.com,Direct");
    rules.push("DOMAIN-SUFFIX,msftncsi.com,Direct");
    rules.push("DOMAIN-SUFFIX,windowsupdate.com,Direct");
    rules.push("DOMAIN-SUFFIX,update.microsoft.com,Direct");
    rules.push("DOMAIN-SUFFIX,windowsupdate.microsoft.com,Direct");
    rules.push("DOMAIN-SUFFIX,delivery.mp.microsoft.com,Direct");
  }

  // 内网地址直连
  if (ALLOW_DIRECT_RULES) {
    rules.push("IP-CIDR,224.0.0.0/4,Direct,no-resolve");
    rules.push("GEOIP,PRIVATE,Direct,no-resolve");
  }

  // 拒绝 QUIC（防止 UDP 443 绕过代理）
  rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT");

  // 广告拦截
  rules.push("GEOSITE,category-ads-all,AdBlock");

  // Clash/订阅服务直连只绑定 Mihomo/Clash 自身进程，避免浏览器访问这些域名时提前直连。
  pushSubscriptionDirectRules(rules);

  // === Edge 浏览器智能分流规则（核心优化） ===
  // Edge 进程的国内流量直连
  var edgeBrowser = null;
  for (i = 0; i < BROWSERS.length; i++) {
    if (BROWSERS[i].key === "Edge") {
      edgeBrowser = BROWSERS[i];
      break;
    }
  }

  if (edgeBrowser) {
    for (j = 0; j < edgeBrowser.processes.length; j++) {
      var proc = edgeBrowser.processes[j];
      // Edge 国内网站默认直连；关闭 ALLOW_DIRECT_RULES 后也走 EdgeProxy 链式落地。
      if (ALLOW_DIRECT_RULES) {
        rules.push("AND,((PROCESS-NAME," + proc + "),(GEOSITE,cn)),Direct");
        rules.push("AND,((PROCESS-NAME," + proc + "),(GEOIP,CN)),Direct");
      }
      // Edge 国外网站走代理
      rules.push("AND,((PROCESS-NAME," + proc + "),(GEOSITE,geolocation-!cn)),EdgeProxy");
      // Edge 其他流量走代理
      rules.push("PROCESS-NAME," + proc + ",EdgeProxy");
    }
  }

  // === 其他浏览器规则（全部走代理，不分国内外） ===
  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    if (b.key === "Edge") continue; // Edge 已单独处理

    for (j = 0; j < b.processes.length; j++) {
      var browserProc = b.processes[j];
      // 所有流量走浏览器专属代理（无论国内外）
      rules.push("PROCESS-NAME," + browserProc + "," + b.group);
    }
  }

  // === 全局规则（其他应用智能分流） ===
  rules.push("GEOSITE,telegram,OtherAppsProxy");
  if (ALLOW_DIRECT_RULES) {
    rules.push("GEOSITE,cn,Direct"); // 其他应用访问国内网站直连
    rules.push("GEOIP,CN,Direct,no-resolve"); // 其他应用访问国内IP直连
  }
  rules.push("GEOSITE,geolocation-!cn,OtherAppsProxy"); // 其他应用访问国外网站走代理
  rules.push("MATCH,FinalFallback");

  return rules;
}

function pushSubscriptionDirectRules(rules) {
  var processes = ["verge-mihomo.exe", "mihomo.exe", "clash-verge.exe"];
  var domains = ["998488.xyz", "sub-ui.998488.xyz", "jsdelivr.net", "testingcf.jsdelivr.net", "githubusercontent.com"];
  var i;
  var j;

  for (i = 0; i < processes.length; i++) {
    for (j = 0; j < domains.length; j++) {
      rules.push("AND,((PROCESS-NAME," + processes[i] + "),(DOMAIN-SUFFIX," + domains[j] + ")),Direct");
    }
  }
}
