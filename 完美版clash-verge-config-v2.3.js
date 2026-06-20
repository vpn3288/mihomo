"use strict";

// Clash Verge Rev subscription script v2.3.
// Compatible with Clash Verge Rev script docs: main(config, profileName).
// Mihomo provider hardening: Edge excludes anytls for v1.19.x compatibility.
// Keep this file conservative: Clash Verge runs scripts with boa_engine, not Node.js.
// Avoid object spread, arrow functions, and template strings.

var SUB = {
  // Fill these subscription URLs in Clash Verge before use.
  Edge: "https://YOUR_EDGE_SUBSCRIPTION_URL",
  Chrome: "https://YOUR_CHROME_SUBSCRIPTION_URL",
  Firefox: "https://YOUR_FIREFOX_SUBSCRIPTION_URL",
  Brave: "https://YOUR_BRAVE_SUBSCRIPTION_URL",
  LibreWolf: "https://YOUR_LIBREWOLF_SUBSCRIPTION_URL",
  Vivaldi: "https://YOUR_VIVALDI_SUBSCRIPTION_URL",
  Opera: "https://YOUR_OPERA_SUBSCRIPTION_URL",
  // Optional: non-browser software channel. Leave empty to reuse Default.
  OtherApps: "",
  Default: "https://YOUR_DEFAULT_SUBSCRIPTION_URL"
};

var BROWSERS = [
  { key: "Edge", group: "EdgeProxy", provider: "provider-edge", path: "./providers/edge.yaml", fp: "chrome", processes: ["msedge.exe", "msedgewebview2.exe", "Copilot.exe", "SearchHost.exe", "StartMenuExperienceHost.exe", "ShellExperienceHost.exe", "WebViewHost.exe"] },
  { key: "Chrome", group: "ChromeProxy", provider: "provider-chrome", path: "./providers/chrome.yaml", fp: "chrome", processes: ["chrome.exe"] },
  { key: "Firefox", group: "FirefoxProxy", provider: "provider-firefox", path: "./providers/firefox.yaml", fp: "firefox", processes: ["firefox.exe"] },
  { key: "Brave", group: "BraveProxy", provider: "provider-brave", path: "./providers/brave.yaml", fp: "chrome", processes: ["brave.exe"] },
  { key: "LibreWolf", group: "LibreWolfProxy", provider: "provider-librewolf", path: "./providers/librewolf.yaml", fp: "firefox", processes: ["librewolf.exe"] },
  { key: "Vivaldi", group: "VivaldiProxy", provider: "provider-vivaldi", path: "./providers/vivaldi.yaml", fp: "chrome", processes: ["vivaldi.exe"] },
  { key: "Opera", group: "OperaProxy", provider: "provider-opera", path: "./providers/opera.yaml", fp: "chrome", processes: ["opera.exe", "operagx.exe"] }
];


var HEALTH_CHECK = {
  enable: true,
  url: "https://www.gstatic.com/generate_204",
  interval: 600,
  timeout: 5000,
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
  config["log-level"] = "warning";
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["find-process-mode"] = "always";
  config["keep-alive-interval"] = 15;
  config["keep-alive-idle"] = 600;
  config["udp-timeout"] = 300;

  config.profile = {
    "store-selected": true,
    "store-fake-ip": true
  };

  config.tun = {
    enable: true,
    stack: "system",
    device: "Meta",
    "auto-route": true,
    "strict-route": true,
    "auto-detect-interface": true,
    "dns-hijack": ["any:53", "tcp://any:53"],
    mtu: 1500,
    ipv6: false,
    "endpoint-independent-nat": true
  };

  config.sniffer = {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": false,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443], "override-destination": true }
    }
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
    listen: "127.0.0.1:1053",
    ipv6: false,
    "independent-cache": true,
    "use-system-hosts": false,
    "use-hosts": false,
    "cache-algorithm": "arc",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": [
      "+.lan",
      "+.local",
      "+.localhost",
      "localhost",
      "+.msftconnecttest.com",
      "+.msftncsi.com",
      "dns.msftncsi.com",
      "www.msftncsi.com",
      "connectivitycheck.gstatic.com",
      "+.connectivitycheck.microsoft.com",
      "+.windowsupdate.com",
      "+.windowsupdate.microsoft.com",
      "update.microsoft.com",
      "time.windows.com",
      "time.nist.gov",
      "+.pool.ntp.org"
    ],
    "prefer-h3": false,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    nameserver: DOMESTIC_DNS,
    "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29"],
    "respect-rules": true,
    "nameserver-policy": {
      "geosite:private": DOMESTIC_DNS,
      "geosite:cn": DOMESTIC_DNS,
      "geosite:geolocation-cn": DOMESTIC_DNS,
      "geosite:gfw": FOREIGN_DNS,
      "+.998488.xyz": DOMESTIC_DNS,
      "+.jsdelivr.net": DOMESTIC_DNS,
      "+.githubusercontent.com": DOMESTIC_DNS,
      "+.msftconnecttest.com": DOMESTIC_DNS,
      "+.msftncsi.com": DOMESTIC_DNS
    },
    fallback: FOREIGN_DNS,
    "fallback-filter": { geoip: true, "geoip-code": "CN" }
  };
}

function buildProviders() {
  var providers = {};
  var i;

  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    if (b.key === "Edge") {
      providers[b.provider] = makeEdgeProvider(SUB[b.key], b.path, b.fp);
    } else {
      providers[b.provider] = makeProvider(SUB[b.key], b.path, b.fp);
    }
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

function makeEdgeProvider(url, path, fp) {
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

function makeFileProvider(path, fp) {
  return {
    type: "file",
    path: path,
    "health-check": HEALTH_CHECK,
    override: {
      udp: true,
      "client-fingerprint": fp
    }
  };
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

  for (i = 0; i < BROWSERS.length; i++) {
    groups.push(makeUrlTestGroup(BROWSERS[i].group, BROWSERS[i].provider));
  }

  groups.push(makeUrlTestGroup("DefaultProxy", "provider-default"));
  groups.push(makeUrlTestGroup("OtherAppsProxy", "provider-other-apps"));
  groups.push({ name: "Direct", type: "select", proxies: ["DIRECT"] });
  groups.push({ name: "AdBlock", type: "select", proxies: ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ name: "FinalFallback", type: "select", proxies: ["DefaultProxy", "DIRECT"] });

  return groups;
}

function makeUrlTestGroup(name, provider) {
  return {
    name: name,
    type: "url-test",
    use: [provider],
    url: "https://www.gstatic.com/generate_204",
    interval: 600,
    timeout: 5000,
    lazy: true,
    "expected-status": 204,
    "max-failed-times": 2,
    tolerance: 200,
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

  rules.push("IP-CIDR,1.1.1.1/32,DefaultProxy,no-resolve");
  rules.push("IP-CIDR,1.0.0.1/32,DefaultProxy,no-resolve");
  rules.push("IP-CIDR,9.9.9.9/32,DefaultProxy,no-resolve");
  rules.push("IP-CIDR,223.5.5.5/32,Direct,no-resolve");
  rules.push("IP-CIDR,119.29.29.29/32,Direct,no-resolve");

  rules.push("PROCESS-NAME,verge-mihomo.exe,Direct");
  rules.push("PROCESS-NAME,mihomo.exe,Direct");
  rules.push("PROCESS-NAME,clash-verge.exe,Direct");
  rules.push("DOMAIN-SUFFIX,998488.xyz,Direct");
  rules.push("DOMAIN-SUFFIX,sub-ui.998488.xyz,Direct");
  rules.push("DOMAIN-SUFFIX,jsdelivr.net,Direct");
  rules.push("DOMAIN-SUFFIX,testingcf.jsdelivr.net,Direct");
  rules.push("DOMAIN-SUFFIX,githubusercontent.com,Direct");
  rules.push("PROCESS-NAME,DeliveryOptimization.exe,Direct");
  rules.push("AND,((NETWORK,UDP),(DST-PORT,123)),Direct");
  rules.push("DOMAIN-SUFFIX,ntp.org,Direct");
  rules.push("DOMAIN-SUFFIX,msftconnecttest.com,Direct");
  rules.push("DOMAIN-SUFFIX,msftncsi.com,Direct");
  rules.push("DOMAIN-SUFFIX,windowsupdate.com,Direct");
  rules.push("DOMAIN-SUFFIX,update.microsoft.com,Direct");
  rules.push("DOMAIN-SUFFIX,windowsupdate.microsoft.com,Direct");
  rules.push("DOMAIN-SUFFIX,delivery.mp.microsoft.com,Direct");
  rules.push("IP-CIDR,224.0.0.0/4,Direct,no-resolve");
  rules.push("GEOIP,PRIVATE,Direct,no-resolve");

  rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT");

  rules.push("GEOSITE,category-ads-all,AdBlock");

  for (i = 0; i < BROWSERS.length; i++) {
    var b = BROWSERS[i];
    for (j = 0; j < b.processes.length; j++) {
      rules.push("PROCESS-NAME," + b.processes[j] + "," + b.group);
    }
  }

  rules.push("GEOSITE,telegram,OtherAppsProxy");
  rules.push("GEOSITE,cn,Direct");
  rules.push("GEOIP,CN,Direct,no-resolve");
  rules.push("GEOSITE,geolocation-!cn,OtherAppsProxy");
  rules.push("NETWORK,TCP,OtherAppsProxy");
  rules.push("NETWORK,UDP,OtherAppsProxy");
  rules.push("MATCH,FinalFallback");

  return rules;
}
