"use strict";

// Clash Verge Rev subscription script v2.4 (安全+性能优化版)
// 分流策略：
// 1. Edge 浏览器：智能分流（国内直连，国外走代理）
// 2. 其他浏览器：全部走代理（不分国内外）
// 3. 其他应用：智能分流（国内直连，国外走代理）

var SUB = {
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

var BROWSERS = [
  { key: "Edge", group: "EdgeProxy", provider: "provider-edge", path: "./providers/edge.yaml", fp: "chrome", processes: ["msedge.exe"], smartRoute: true },
  { key: "Chrome", group: "ChromeProxy", provider: "provider-chrome", path: "./providers/chrome.yaml", fp: "chrome", processes: ["chrome.exe"], smartRoute: false },
  { key: "Firefox", group: "FirefoxProxy", provider: "provider-firefox", path: "./providers/firefox.yaml", fp: "firefox", processes: ["firefox.exe"], smartRoute: false },
  { key: "Brave", group: "BraveProxy", provider: "provider-brave", path: "./providers/brave.yaml", fp: "chrome", processes: ["brave.exe"], smartRoute: false },
  { key: "LibreWolf", group: "LibreWolfProxy", provider: "provider-librewolf", path: "./providers/librewolf.yaml", fp: "firefox", processes: ["librewolf.exe"], smartRoute: false },
  { key: "Vivaldi", group: "VivaldiProxy", provider: "provider-vivaldi", path: "./providers/vivaldi.yaml", fp: "chrome", processes: ["vivaldi.exe"], smartRoute: false },
  { key: "Opera", group: "OperaProxy", provider: "provider-opera", path: "./providers/opera.yaml", fp: "chrome", processes: ["opera.exe", "operagx.exe"], smartRoute: false }
];

var HEALTH_CHECK = {
  enable: true,
  url: "https://www.gstatic.com/generate_204",
  interval: 300,
  timeout: 3000,
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
  var keys = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera", "Default"];
  var i;
  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var url = SUB[key];
    if (!url || typeof url !== "string") {
      throw new Error("Missing subscription URL: " + key);
    }
    if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) {
      throw new Error("Invalid subscription URL: " + key + " -> " + url);
    }
  }

  if (SUB.OtherApps && SUB.OtherApps.indexOf("YOUR_") < 0) {
    if (SUB.OtherApps.indexOf("http://") !== 0 && SUB.OtherApps.indexOf("https://") !== 0) {
      throw new Error("Invalid subscription URL: OtherApps -> " + SUB.OtherApps);
    }
  }
}

function buildDns() {
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
    "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29"],
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

  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    providers[b.provider] = makeProvider(SUB[b.key], b.path, b.fp);
  }

  providers["provider-default"] = makeProvider(SUB.Default, "./providers/default.yaml", "chrome");
  providers["provider-other-apps"] = makeProvider(getOtherAppsUrl(), "./providers/other-apps.yaml", "chrome");
  return providers;
}

function getOtherAppsUrl() {
  if (!SUB.OtherApps || SUB.OtherApps.indexOf("YOUR_") >= 0) {
    return SUB.Default;
  }
  return SUB.OtherApps;
}

function makeProvider(url, path, fp) {
  return {
    type: "http",
    url: url,
    interval: 86400,
    path: path,
    proxy: "DIRECT",
    "exclude-type": "anytls",
    "health-check": HEALTH_CHECK,
    override: {
      udp: true,
      "client-fingerprint": fp
    }
  };
}

function buildGroups() {
  var groups = [];
  var i;

  // 其他浏览器：纯代理组
  for (i = 0; i < BROWSERS.length; i++) {
    groups.push(makeUrlTestGroup(BROWSERS[i].group, BROWSERS[i].provider));
  }

  groups.push(makeUrlTestGroup("DefaultProxy", "provider-default"));
  groups.push(makeUrlTestGroup("OtherAppsProxy", "provider-other-apps"));
  groups.push({ name: "Direct", type: "select", proxies: ["DIRECT"] });
  groups.push({ name: "AdBlock", type: "select", proxies: ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ name: "FinalFallback", type: "select", proxies: ["OtherAppsProxy", "DefaultProxy", "DIRECT"] });

  return groups;
}

function makeUrlTestGroup(name, provider) {
  return {
    name: name,
    type: "url-test",
    use: [provider],
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
    timeout: 3000,
    lazy: true,
    "expected-status": 204,
    tolerance: 50,
    "disable-udp": false
  };
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
  rules.push("IP-CIDR,223.5.5.5/32,Direct,no-resolve");
  rules.push("IP-CIDR,119.29.29.29/32,Direct,no-resolve");

  // Clash 自身进程直连
  rules.push("PROCESS-NAME,verge-mihomo.exe,Direct");
  rules.push("PROCESS-NAME,mihomo.exe,Direct");
  rules.push("PROCESS-NAME,clash-verge.exe,Direct");

  // 订阅服务直连
  rules.push("DOMAIN-SUFFIX,998488.xyz,Direct");
  rules.push("DOMAIN-SUFFIX,sub-ui.998488.xyz,Direct");
  rules.push("DOMAIN-SUFFIX,jsdelivr.net,Direct");
  rules.push("DOMAIN-SUFFIX,testingcf.jsdelivr.net,Direct");
  rules.push("DOMAIN-SUFFIX,githubusercontent.com,Direct");

  // 系统服务直连
  rules.push("PROCESS-NAME,DeliveryOptimization.exe,Direct");
  rules.push("AND,((NETWORK,UDP),(DST-PORT,123)),Direct");
  rules.push("DOMAIN-SUFFIX,ntp.org,Direct");
  rules.push("DOMAIN-SUFFIX,msftconnecttest.com,Direct");
  rules.push("DOMAIN-SUFFIX,msftncsi.com,Direct");
  rules.push("DOMAIN-SUFFIX,windowsupdate.com,Direct");
  rules.push("DOMAIN-SUFFIX,update.microsoft.com,Direct");
  rules.push("DOMAIN-SUFFIX,windowsupdate.microsoft.com,Direct");
  rules.push("DOMAIN-SUFFIX,delivery.mp.microsoft.com,Direct");

  // 内网地址直连
  rules.push("IP-CIDR,224.0.0.0/4,Direct,no-resolve");
  rules.push("GEOIP,PRIVATE,Direct,no-resolve");

  // 拒绝 QUIC（防止 UDP 443 绕过代理）
  rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT");

  // 广告拦截
  rules.push("GEOSITE,category-ads-all,AdBlock");

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
      // Edge 国内网站直连
      rules.push("AND,((PROCESS-NAME," + proc + "),(GEOSITE,cn)),Direct");
      rules.push("AND,((PROCESS-NAME," + proc + "),(GEOIP,CN)),Direct");
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
  rules.push("GEOSITE,cn,Direct"); // 其他应用访问国内网站直连
  rules.push("GEOIP,CN,Direct,no-resolve"); // 其他应用访问国内IP直连
  rules.push("GEOSITE,geolocation-!cn,OtherAppsProxy"); // 其他应用访问国外网站走代理
  rules.push("MATCH,FinalFallback");

  return rules;
}
