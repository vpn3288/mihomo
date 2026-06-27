"use strict";

// Clash Verge Rev subscription script v2.12 (分浏览器前置地区链式代理生产增强版)
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
// 这些落地订阅里的每个节点都会通过浏览器专属前置组建连。
// 链路形态：本机 -> 浏览器专属前置组(购买订阅) -> 浏览器专属落地 VPS 节点 -> 目标网站。
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

// 排除不适合作前置或不是实际节点的条目。filter/exclude 都是节点名称正则。
// 建议先在 Clash Verge 单独导入 SUB.Front，查看实际节点名称后再调整。
var FRONT_NODE_EXCLUDE_FILTER = "剩余|流量|套餐|官网|到期|过期|Expire|Expired|Traffic|Official|Website";

// 前置节点选择策略：
// "fallback" 稳定优先；"url-test" 延迟优先；"select" 手动选择；"load-balance" 分散连接。
var FRONT_SELECTION_MODE = "fallback";
var FRONT_LOAD_BALANCE_STRATEGY = "consistent-hashing";

var REGION_KEYWORDS = {
  US: "美国|美國|🇺🇸|USA|United States|America|American|Los Angeles|San Jose|New York|Seattle|Dallas|Miami|Chicago|洛杉矶|洛杉磯|纽约|紐約|圣何塞|聖荷西|西雅图|西雅圖|芝加哥",
  SG: "新加坡|🇸🇬|Singapore|SGP|狮城|獅城|坡县|坡縣",
  JP: "日本|🇯🇵|Japan|JPN|Tokyo|Osaka|Nagoya|東京|东京|大阪|大坂|名古屋",
  HK: "香港|🇭🇰|Hong Kong|HongKong|Hongkong|HKG|港",
  TW: "台湾|臺灣|🇹🇼|Taiwan|TWN|Taipei|台北|台中|高雄",
  KR: "韩国|韓國|🇰🇷|Korea|KOR|Seoul|首尔|首爾",
  CA: "加拿大|🇨🇦|Canada|CAN|Toronto|Vancouver|多伦多|多倫多|温哥华|溫哥華",
  UK: "英国|英國|🇬🇧|United Kingdom|Britain|British|London|伦敦|倫敦",
  DE: "德国|德國|🇩🇪|Germany|DEU|Berlin|Frankfurt|柏林|法兰克福|法蘭克福",
  FR: "法国|法國|🇫🇷|France|Paris|巴黎",
  AU: "澳大利亚|澳大利亞|澳洲|🇦🇺|Australia|AUS|Sydney|Melbourne|悉尼|墨尔本|墨爾本"
};

// 按地区或用途创建多个前置组，全部来自同一个购买订阅 SUB.Front。
// filter 是节点名称正则，例如 "美国|US|United States"、"新加坡|Singapore|SG"、"日本|Japan|JP"。
// 留空表示使用全部前置节点。
var FRONT_PROXY_GROUPS = [
  { name: "FrontProxy", filter: FRONT_NODE_FILTER, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: FRONT_SELECTION_MODE },
  { name: "FrontProxyHK", filter: REGION_KEYWORDS.HK, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyTW", filter: REGION_KEYWORDS.TW, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxySG", filter: REGION_KEYWORDS.SG, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyJP", filter: REGION_KEYWORDS.JP, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyKR", filter: REGION_KEYWORDS.KR, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyUS", filter: REGION_KEYWORDS.US, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyCA", filter: REGION_KEYWORDS.CA, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyUK", filter: REGION_KEYWORDS.UK, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyDE", filter: REGION_KEYWORDS.DE, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyFR", filter: REGION_KEYWORDS.FR, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" },
  { name: "FrontProxyAU", filter: REGION_KEYWORDS.AU, exclude: FRONT_NODE_EXCLUDE_FILTER, mode: "url-test" }
];

var FRONT_REGION_PRESETS = {
  asia_first: ["FrontProxySG", "FrontProxyJP", "FrontProxyHK", "FrontProxyTW", "FrontProxyUS", "FrontProxy"],
  us_first: ["FrontProxyUS", "FrontProxyCA", "FrontProxySG", "FrontProxyJP", "FrontProxy"],
  jp_first: ["FrontProxyJP", "FrontProxySG", "FrontProxyHK", "FrontProxyUS", "FrontProxy"],
  eu_first: ["FrontProxyUK", "FrontProxyDE", "FrontProxyFR", "FrontProxySG", "FrontProxyUS", "FrontProxy"],
  all_regions: ["FrontProxy", "FrontProxySG", "FrontProxyJP", "FrontProxyHK", "FrontProxyTW", "FrontProxyUS", "FrontProxyCA", "FrontProxyUK", "FrontProxyDE", "FrontProxyFR", "FrontProxyAU"]
};

// 每个落地订阅使用哪个前置组。对象写法会创建浏览器专属 select 组，方便在 Clash Verge 界面手动切换。
// default 是 Clash Verge 默认选中的前置地区；options 是手动可选项；fallback 是自动兜底顺序。
// 兼容旧写法：Edge: ["FrontProxyUS", "FrontProxyJP"] 或 Edge: "FrontProxyUS" 仍然可用。
var FRONT_PROXY_BY_PROVIDER = {
  Edge: {
    default: "FrontProxyUS",
    options: FRONT_REGION_PRESETS.us_first,
    fallback: FRONT_REGION_PRESETS.us_first
  },
  Chrome: {
    default: "FrontProxySG",
    options: FRONT_REGION_PRESETS.asia_first,
    fallback: FRONT_REGION_PRESETS.asia_first
  },
  Firefox: {
    default: "FrontProxyJP",
    options: FRONT_REGION_PRESETS.jp_first,
    fallback: FRONT_REGION_PRESETS.jp_first
  },
  Brave: {
    default: "FrontProxyHK",
    options: FRONT_REGION_PRESETS.all_regions,
    fallback: FRONT_REGION_PRESETS.asia_first
  },
  LibreWolf: {
    default: "FrontProxyTW",
    options: FRONT_REGION_PRESETS.all_regions,
    fallback: FRONT_REGION_PRESETS.asia_first
  },
  Vivaldi: {
    default: "FrontProxySG",
    options: FRONT_REGION_PRESETS.asia_first,
    fallback: FRONT_REGION_PRESETS.asia_first
  },
  Opera: {
    default: "FrontProxySG",
    options: FRONT_REGION_PRESETS.asia_first,
    fallback: FRONT_REGION_PRESETS.asia_first
  },
  Default: {
    default: "FrontProxy",
    options: FRONT_REGION_PRESETS.all_regions,
    fallback: FRONT_REGION_PRESETS.all_regions
  },
  OtherApps: {
    default: "FrontProxy",
    options: FRONT_REGION_PRESETS.all_regions,
    fallback: FRONT_REGION_PRESETS.all_regions
  }
};

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
  // 前置节点在本机侧测速，国内环境下不建议默认使用 Google 204。
  // Cloudflare cp 返回 200，国内外可达性通常更稳；如果你有自有探测地址，也可以替换这里。
  front: "https://cp.cloudflare.com/",
  landing: "https://www.gstatic.com/generate_204"
};

var HEALTH_CHECK_EXPECTED_STATUS = {
  front: 200,
  landing: 204
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
  "expected-status": HEALTH_CHECK_EXPECTED_STATUS.front
};

var HEALTH_CHECK_LANDING_DIRECT = {
  enable: true,
  url: HEALTH_CHECK_URLS.landing,
  interval: 300,
  timeout: 3000,
  lazy: true,
  "expected-status": HEALTH_CHECK_EXPECTED_STATUS.landing
};

var HEALTH_CHECK_LANDING_CHAIN = {
  enable: true,
  url: HEALTH_CHECK_URLS.landing,
  interval: 300,
  timeout: 8000,
  lazy: true,
  "expected-status": HEALTH_CHECK_EXPECTED_STATUS.landing
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
  validateFrontProxyMappings();

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

function validateFrontProxyMappings() {
  if (!needsFrontProxy()) {
    return;
  }

  var names = {};
  var selectorNames = {};
  var i;
  for (i = 0; i < FRONT_PROXY_GROUPS.length; i++) {
    var group = FRONT_PROXY_GROUPS[i];
    if (!group.name) {
      throw new Error("FRONT_PROXY_GROUPS contains an empty group name");
    }
    if (names[group.name]) {
      throw new Error("Duplicate front proxy group name: " + group.name);
    }
    names[group.name] = true;
    validateFrontGroupMode(group.mode || FRONT_SELECTION_MODE, group.name);
  }

  var keys = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera", "Default", "OtherApps"];
  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var target = getFrontProxyNameForKey(key);
    var config = getFrontProxyConfigForKey(key);

    if (config) {
      if (selectorNames[target]) {
        throw new Error("Duplicate front selector group name: " + target);
      }
      selectorNames[target] = true;
      validateFrontProxyOptions(key, config.options, names);
      if (config.defaultProxy) {
        validateFrontProxyOptions(key + ".default", [config.defaultProxy], names);
      }
      if (config.fallback && config.fallback.length > 0) {
        validateFrontProxyOptions(key + ".fallback", config.fallback, names);
        selectorNames[getFrontAutoFallbackNameForKey(key)] = true;
      }
    } else if (!names[target]) {
      throw new Error("FRONT_PROXY_BY_PROVIDER." + key + " references missing group: " + target);
    }
  }
}

function validateFrontProxyOptions(key, options, names) {
  if (!options || options.length === 0) {
    throw new Error("FRONT_PROXY_BY_PROVIDER." + key + " cannot be empty");
  }

  var i;
  for (i = 0; i < options.length; i++) {
    var option = options[i];
    if (option === "DIRECT") {
      if (STRICT_NO_DIRECT_FALLBACK) {
        throw new Error("FRONT_PROXY_BY_PROVIDER." + key + " cannot include DIRECT while STRICT_NO_DIRECT_FALLBACK is true");
      }
      continue;
    }
    if (!names[option]) {
      throw new Error("FRONT_PROXY_BY_PROVIDER." + key + " references missing group: " + option);
    }
  }
}

function validateFrontGroupMode(mode, groupName) {
  if (mode !== "fallback" && mode !== "url-test" && mode !== "select" && mode !== "load-balance") {
    throw new Error("Front proxy group " + groupName + " has invalid mode: " + mode);
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
    var frontGroups = getFrontProxyGroups();
    for (i = 0; i < frontGroups.length; i++) {
      providers[frontGroups[i].provider] = makeFrontProvider(SUB.Front, frontGroups[i].path, frontGroups[i]);
    }
  }

  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    providers[b.provider] = makeProvider(SUB[b.key], b.path, b.fp, b.key + " | ", b.key);
  }

  providers["provider-default"] = makeProvider(SUB.Default, "./providers/default.yaml", "chrome", "Default | ", "Default");
  providers["provider-other-apps"] = makeProvider(getOtherAppsUrl(), "./providers/other-apps.yaml", "chrome", "OtherApps | ", "OtherApps");
  return providers;
}

function getOtherAppsUrl() {
  if (!SUB.OtherApps || SUB.OtherApps.indexOf("YOUR_") >= 0) {
    return SUB.Default;
  }
  return SUB.OtherApps;
}

function makeFrontProvider(url, path, group) {
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
      "additional-prefix": group.name + " | "
    }
  };

  if (group.filter) {
    provider.filter = group.filter;
  }

  if (group.exclude) {
    provider["exclude-filter"] = group.exclude;
  }

  return provider;
}

function makeProvider(url, path, fp, prefix, key) {
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
    provider.override["dialer-proxy"] = getFrontProxyNameForKey(key);
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
    "expected-status": isFront ? HEALTH_CHECK_EXPECTED_STATUS.front : HEALTH_CHECK_EXPECTED_STATUS.landing,
    tolerance: tolerance,
    "disable-udp": ENABLE_CHAIN_PROXY && CHAIN_DISABLE_UDP && !isFront
  };
}

function buildGroups() {
  var groups = [];
  var i;

  if (needsFrontProxy()) {
    var frontGroups = getFrontProxyGroups();
    for (i = 0; i < frontGroups.length; i++) {
      var front = frontGroups[i];
      if (front.mode === "select") {
        groups.push(makeFrontAutoGroup(front.autoName, front));
      }
      groups.push(makeFrontProxyGroup(front));
    }
    pushFrontSelectorGroups(groups);
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

function makeFrontProxyGroup(front) {
  var proxies = [front.autoName];
  if (FRONT_PROXY_ALLOW_DIRECT_FALLBACK && !STRICT_NO_DIRECT_FALLBACK) {
    proxies.push("DIRECT");
  }

  if (front.mode === "select") {
    return {
      name: front.name,
      type: "select",
      proxies: proxies,
      use: [front.provider]
    };
  }

  return makeFrontAutoGroup(front.name, front);
}

function makeFrontAutoGroup(name, front) {
  if (!name) {
    name = "FrontAuto";
  }
  if (!front) {
    front = getFrontProxyGroups()[0];
  }

  if (front.mode === "url-test") {
    return makeUrlTestGroup(name, front.provider, "front");
  }

  if (front.mode === "load-balance") {
    return {
      name: name,
      type: "load-balance",
      use: [front.provider],
      url: HEALTH_CHECK_URLS.front,
      interval: 60,
      timeout: 4000,
      lazy: false,
      "expected-status": HEALTH_CHECK_EXPECTED_STATUS.front,
      strategy: FRONT_LOAD_BALANCE_STRATEGY
    };
  }

  return {
    name: name,
    type: "fallback",
    use: [front.provider],
    url: HEALTH_CHECK_URLS.front,
    interval: 60,
    timeout: 4000,
    lazy: false,
    "expected-status": HEALTH_CHECK_EXPECTED_STATUS.front
  };
}

function getFrontProxyGroups() {
  var groups = [];
  var i;

  for (i = 0; i < FRONT_PROXY_GROUPS.length; i++) {
    var raw = FRONT_PROXY_GROUPS[i];
    var name = raw.name;
    groups.push({
      name: name,
      provider: "provider-front-" + slugifyName(name),
      path: "./providers/front-" + slugifyName(name) + ".yaml",
      autoName: name + "Auto",
      filter: raw.filter || "",
      exclude: raw.exclude || "",
      mode: raw.mode || FRONT_SELECTION_MODE
    });
  }

  return groups;
}

function pushFrontSelectorGroups(groups) {
  var keys = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera", "Default", "OtherApps"];
  var seen = {};
  var i;

  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var config = getFrontProxyConfigForKey(key);
    if (!config) {
      continue;
    }

    var name = getFrontProxyNameForKey(key);
    if (seen[name]) {
      continue;
    }
    seen[name] = true;
    if (config.fallback && config.fallback.length > 0) {
      groups.push(makeFrontAutoFallbackGroup(key, config.fallback));
    }
    groups.push({
      name: name,
      type: "select",
      proxies: getFrontSelectorOptionsForKey(key)
    });
  }
}

function makeFrontAutoFallbackGroup(key, options) {
  return {
    name: getFrontAutoFallbackNameForKey(key),
    type: "fallback",
    proxies: options,
    url: HEALTH_CHECK_URLS.front,
    interval: 60,
    timeout: 4000,
    lazy: false,
    "expected-status": HEALTH_CHECK_EXPECTED_STATUS.front
  };
}

function slugifyName(name) {
  var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  slug = slug.replace(/^-+/, "").replace(/-+$/, "");
  if (!slug) {
    slug = "front";
  }
  return slug;
}

function getFrontProxyNameForKey(key) {
  var value = FRONT_PROXY_BY_PROVIDER && FRONT_PROXY_BY_PROVIDER[key];
  if (isArray(value) || isPlainObject(value)) {
    return key + "FrontProxy";
  }
  if (typeof value === "string" && value) {
    return value;
  }
  return "FrontProxy";
}

function getFrontProxyConfigForKey(key) {
  var value = FRONT_PROXY_BY_PROVIDER && FRONT_PROXY_BY_PROVIDER[key];
  if (isArray(value)) {
    return {
      defaultProxy: value[0],
      options: uniqueList(value),
      fallback: uniqueList(value)
    };
  }
  if (isPlainObject(value)) {
    var options = isArray(value.options) ? value.options : [];
    var fallback = isArray(value.fallback) ? value.fallback : options;
    var defaultProxy = value.default || value.defaultProxy || options[0] || fallback[0];
    return {
      defaultProxy: defaultProxy,
      options: uniqueList(options),
      fallback: uniqueList(fallback)
    };
  }
  return null;
}

function getFrontSelectorOptionsForKey(key) {
  var config = getFrontProxyConfigForKey(key);
  if (!config) {
    return null;
  }

  var result = [];
  if (config.defaultProxy) {
    result.push(config.defaultProxy);
  }
  if (config.fallback && config.fallback.length > 0) {
    result.push(getFrontAutoFallbackNameForKey(key));
  }
  var i;
  for (i = 0; i < config.options.length; i++) {
    result.push(config.options[i]);
  }
  return uniqueList(result);
}

function getFrontAutoFallbackNameForKey(key) {
  return key + "FrontAutoFallback";
}

function isArray(value) {
  return Object.prototype.toString.call(value) === "[object Array]";
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function uniqueList(list) {
  var result = [];
  var seen = {};
  var i;
  for (i = 0; i < list.length; i++) {
    var value = list[i];
    if (!value || seen[value]) {
      continue;
    }
    seen[value] = true;
    result.push(value);
  }
  return result;
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
