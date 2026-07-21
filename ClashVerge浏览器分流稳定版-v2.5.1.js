"use strict";

// Clash Verge Rev extension script v2.5.1
// v2.5.1: normalize malformed AnyTLS duration fields during provider import.
// Windows routing model:
// 1. Edge: CN traffic uses DIRECT; other traffic uses EdgeProxy.
// 2. Other listed browsers: all non-LAN traffic uses their own provider.
// 3. Other applications: CN traffic uses DIRECT; other traffic uses OtherAppsProxy.
//
// Important:
// - Different protocols on the same VPS/public IP still expose the same exit IP.
// - Provider updates work with System Proxy/TUN off only while Mihomo is running.
// - Subscription responses may be YAML, URI text, or Base64, but must not mix formats.

var SUB = {
  Edge: "https://YOUR_EDGE_SUBSCRIPTION_URL",
  Chrome: "https://YOUR_CHROME_SUBSCRIPTION_URL",
  Firefox: "https://YOUR_FIREFOX_SUBSCRIPTION_URL",
  Brave: "https://YOUR_BRAVE_SUBSCRIPTION_URL",
  LibreWolf: "https://YOUR_LIBREWOLF_SUBSCRIPTION_URL",
  Vivaldi: "https://YOUR_VIVALDI_SUBSCRIPTION_URL",
  Opera: "https://YOUR_OPERA_SUBSCRIPTION_URL",

  // Leave OtherApps empty to reuse Default without creating a duplicate provider.
  OtherApps: "",
  Default: "https://YOUR_DEFAULT_SUBSCRIPTION_URL"
};

var SETTINGS = {
  // Empty means the script applies wherever it is attached. Set this only when
  // using the script globally and it should affect one profile name.
  targetProfileName: "",

  // HTTPS is required by default so subscription tokens are not sent in cleartext.
  allowHttpSubscriptions: false,

  // One VPS/protocol per provider needs no periodic latency probing.
  // Enable only when a provider actually contains multiple usable nodes.
  enableProviderHealthCheck: false,

  providerUpdateInterval: 86400,
  providerSizeLimit: 2097152,
  healthCheckInterval: 1800,
  healthCheckTimeout: 5000,
  healthCheckUrl: "https://cp.cloudflare.com",

  // null preserves the value supplied by Clash Verge. Use true/false only to force it.
  tunEnable: null,
  strictRoute: true
};

var BROWSERS = [
  { key: "Edge", group: "EdgeProxy", provider: "provider-edge", path: "./providers/browser-edge.yaml", processes: ["msedge.exe"] },
  { key: "Chrome", group: "ChromeProxy", provider: "provider-chrome", path: "./providers/browser-chrome.yaml", processes: ["chrome.exe"] },
  { key: "Firefox", group: "FirefoxProxy", provider: "provider-firefox", path: "./providers/browser-firefox.yaml", processes: ["firefox.exe"] },
  { key: "Brave", group: "BraveProxy", provider: "provider-brave", path: "./providers/browser-brave.yaml", processes: ["brave.exe"] },
  { key: "LibreWolf", group: "LibreWolfProxy", provider: "provider-librewolf", path: "./providers/browser-librewolf.yaml", processes: ["librewolf.exe"] },
  { key: "Vivaldi", group: "VivaldiProxy", provider: "provider-vivaldi", path: "./providers/browser-vivaldi.yaml", processes: ["vivaldi.exe"] },
  { key: "Opera", group: "OperaProxy", provider: "provider-opera", path: "./providers/browser-opera.yaml", processes: ["opera.exe", "operagx.exe"] }
];

var BOOTSTRAP_DNS = ["223.5.5.5", "119.29.29.29"];
var DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];

function main(config, profileName) {
  if (!config || typeof config !== "object") {
    config = {};
  }

  if (SETTINGS.targetProfileName && profileName !== SETTINGS.targetProfileName) {
    return config;
  }

  validateSubscriptions();

  config.mode = "rule";
  config.ipv6 = false;
  config["allow-lan"] = false;
  config["bind-address"] = "127.0.0.1";
  config["log-level"] = "warning";
  config["unified-delay"] = true;
  config["tcp-concurrent"] = false;
  config["find-process-mode"] = "always";

  config.profile = mergeObjects(config.profile, {
    "store-selected": true,
    "store-fake-ip": false
  });

  config.tun = buildTun(config.tun);
  config.sniffer = buildSniffer();
  config.dns = buildDns();

  // This is an authoritative extension script: provider links above are the source of nodes.
  config.proxies = [];
  config["proxy-providers"] = buildProviders();
  config["proxy-groups"] = buildGroups();
  config["rule-providers"] = {};
  config.rules = buildRules();

  return config;
}

function mergeObjects(base, overrides) {
  var result = {};
  var key;

  if (base && typeof base === "object") {
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        result[key] = base[key];
      }
    }
  }

  for (key in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      result[key] = overrides[key];
    }
  }

  return result;
}

function validateSubscriptions() {
  var required = ["Edge", "Chrome", "Firefox", "Brave", "LibreWolf", "Vivaldi", "Opera"];
  var i;

  for (i = 0; i < required.length; i++) {
    validateSubscriptionUrl(required[i], SUB[required[i]], false);
  }

  if (SUB.OtherApps) {
    validateSubscriptionUrl("OtherApps", SUB.OtherApps, false);
  } else {
    validateSubscriptionUrl("Default", SUB.Default, false);
  }
}

function validateSubscriptionUrl(key, value, optional) {
  if (optional && (value === "" || value === null || typeof value === "undefined")) {
    return;
  }

  if (!value || typeof value !== "string") {
    throw new Error("Missing subscription URL: " + key);
  }

  if (value.toUpperCase().indexOf("YOUR_") >= 0) {
    throw new Error("Replace the subscription placeholder: " + key);
  }

  if (/[\s\x00-\x1f\x7f]/.test(value)) {
    throw new Error("Subscription URL contains whitespace or control characters: " + key);
  }

  if (value.toLowerCase().indexOf("https://") === 0) {
    return;
  }

  if (SETTINGS.allowHttpSubscriptions && value.toLowerCase().indexOf("http://") === 0) {
    return;
  }

  throw new Error("Subscription URL must use HTTPS: " + key);
}

function buildTun(existingTun) {
  var tun = mergeObjects(existingTun, {});

  // Let Clash Verge own the on/off lifecycle unless explicitly forced above.
  if (SETTINGS.tunEnable === true || SETTINGS.tunEnable === false) {
    tun.enable = SETTINGS.tunEnable;
  }

  // Remove platform-specific or forced values that commonly conflict on Windows.
  delete tun.device;
  delete tun.mtu;
  delete tun.gso;
  delete tun["gso-max-size"];
  delete tun["auto-redirect"];

  tun.stack = "mixed";
  tun["auto-route"] = true;
  tun["strict-route"] = SETTINGS.strictRoute;
  tun["auto-detect-interface"] = true;
  tun["dns-hijack"] = ["any:53", "tcp://any:53"];
  tun.ipv6 = false;
  tun["endpoint-independent-nat"] = false;

  return tun;
}

function buildSniffer() {
  var skipDomains = [
    "Mijia Cloud",
    "dlg.io.mi.com",
    "+.apple.com",
    "doh.pub",
    "dns.alidns.com",
    "cp.cloudflare.com"
  ];
  var urls = getAllSubscriptionUrls();
  var i;

  for (i = 0; i < urls.length; i++) {
    addUnique(skipDomains, extractHostname(urls[i]));
  }

  return {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": false,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443], "override-destination": true },
      QUIC: { ports: [443, 8443] }
    },
    "skip-domain": skipDomains
  };
}

function buildDns() {
  return {
    enable: true,
    listen: "127.0.0.1:1053",
    ipv6: false,
    "cache-algorithm": "arc",
    "prefer-h3": false,

    // DNS must not depend on a provider that has not downloaded yet.
    "respect-rules": false,
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
    "default-nameserver": BOOTSTRAP_DNS,
    nameserver: DOMESTIC_DNS,
    "proxy-server-nameserver": DOMESTIC_DNS,
    "direct-nameserver": DOMESTIC_DNS,
    "direct-nameserver-follow-policy": false
  };
}

function buildProviders() {
  var providers = {};
  var i;

  for (i = 0; i < BROWSERS.length; i++) {
    var browser = BROWSERS[i];
    providers[browser.provider] = makeProvider(
      SUB[browser.key],
      browser.path,
      browser.key
    );
  }

  providers["provider-other-apps"] = makeProvider(
    getOtherAppsUrl(),
    "./providers/other-apps.yaml",
    "OtherApps"
  );

  return providers;
}

function makeProvider(url, path, label) {
  var healthCheck = { enable: SETTINGS.enableProviderHealthCheck };

  if (SETTINGS.enableProviderHealthCheck) {
    healthCheck.url = SETTINGS.healthCheckUrl;
    healthCheck.interval = SETTINGS.healthCheckInterval;
    healthCheck.timeout = SETTINGS.healthCheckTimeout;
    healthCheck.lazy = true;
    healthCheck["expected-status"] = 204;
  }

  return {
    type: "http",
    url: url,
    path: path,
    interval: SETTINGS.providerUpdateInterval,

    // Direct provider downloads work while Mihomo runs even if proxy modes are off.
    proxy: "DIRECT",
    "size-limit": SETTINGS.providerSizeLimit,
    "health-check": healthCheck,

    // Only rename nodes. Protocol-specific UDP/TLS/fingerprint fields stay untouched.
    override: {
      "additional-prefix": "[" + label + "] ",

      // Some subscription generators emit AnyTLS durations such as "30s",
      // while Mihomo expects integer seconds. Remove the optional values so
      // the core uses its compatible defaults instead of rejecting the provider.
      "override-expr": [
        "del(.[\"idle-session-check-interval\"])",
        "del(.[\"idle-session-timeout\"])"
      ]
    }
  };
}

function buildGroups() {
  var groups = [];
  var i;

  for (i = 0; i < BROWSERS.length; i++) {
    groups.push(makeProviderGroup(BROWSERS[i].group, BROWSERS[i].provider));
  }

  groups.push(makeProviderGroup("OtherAppsProxy", "provider-other-apps"));
  return groups;
}

function makeProviderGroup(name, provider) {
  return {
    name: name,
    type: "select",
    use: [provider],
    "empty-fallback": "REJECT"
  };
}

function buildRules() {
  var rules = [];
  var edge = findBrowser("Edge");
  var i;
  var j;

  // Core traffic and local networks must never loop back into a provider.
  rules.push("PROCESS-NAME,verge-mihomo.exe,DIRECT");
  rules.push("PROCESS-NAME,mihomo.exe,DIRECT");
  rules.push("PROCESS-NAME,clash-verge.exe,DIRECT");
  rules.push("GEOSITE,private,DIRECT");
  rules.push("IP-CIDR,127.0.0.0/8,DIRECT,no-resolve");
  rules.push("IP-CIDR,224.0.0.0/4,DIRECT,no-resolve");
  rules.push("GEOIP,PRIVATE,DIRECT,no-resolve");

  // Edge: classify domains before GEOIP so foreign domains do not trigger DNS first.
  if (edge) {
    for (j = 0; j < edge.processes.length; j++) {
      addEdgeRules(rules, edge.processes[j], edge.group);
    }
  }

  // Other browsers are pinned to their providers before global CN direct rules.
  for (i = 0; i < BROWSERS.length; i++) {
    var browser = BROWSERS[i];
    if (browser.key === "Edge") {
      continue;
    }

    for (j = 0; j < browser.processes.length; j++) {
      addPinnedBrowserRules(rules, browser.processes[j], browser.group);
    }
  }

  // These exceptions apply to non-browser system traffic only.
  rules.push("PROCESS-NAME,DeliveryOptimization.exe,DIRECT");
  rules.push("AND,((NETWORK,UDP),(DST-PORT,123)),DIRECT");
  rules.push("DOMAIN-SUFFIX,ntp.org,DIRECT");
  rules.push("DOMAIN-SUFFIX,msftconnecttest.com,DIRECT");
  rules.push("DOMAIN-SUFFIX,msftncsi.com,DIRECT");
  rules.push("DOMAIN-SUFFIX,windowsupdate.com,DIRECT");
  rules.push("DOMAIN-SUFFIX,update.microsoft.com,DIRECT");
  rules.push("DOMAIN-SUFFIX,windowsupdate.microsoft.com,DIRECT");
  rules.push("DOMAIN-SUFFIX,delivery.mp.microsoft.com,DIRECT");

  // Other applications use simple CN/non-CN routing with a fail-closed final group.
  rules.push("GEOSITE,cn,DIRECT");
  rules.push("GEOIP,CN,DIRECT,no-resolve");
  rules.push("MATCH,OtherAppsProxy");

  return rules;
}

function addEdgeRules(rules, processName, group) {
  rules.push("AND,((PROCESS-NAME," + processName + "),(GEOSITE,cn)),DIRECT");
  rules.push("AND,((PROCESS-NAME," + processName + "),(GEOSITE,geolocation-!cn))," + group);
  rules.push("AND,((PROCESS-NAME," + processName + "),(GEOIP,CN)),DIRECT");
  rules.push("PROCESS-NAME," + processName + "," + group);

  // If the selected protocol cannot carry UDP, reject instead of falling into DIRECT.
  rules.push("AND,((PROCESS-NAME," + processName + "),(NETWORK,UDP)),REJECT");
}

function addPinnedBrowserRules(rules, processName, group) {
  rules.push("PROCESS-NAME," + processName + "," + group);
  rules.push("AND,((PROCESS-NAME," + processName + "),(NETWORK,UDP)),REJECT");
}

function findBrowser(key) {
  var i;
  for (i = 0; i < BROWSERS.length; i++) {
    if (BROWSERS[i].key === key) {
      return BROWSERS[i];
    }
  }
  return null;
}

function getOtherAppsUrl() {
  return SUB.OtherApps ? SUB.OtherApps : SUB.Default;
}

function getAllSubscriptionUrls() {
  var urls = [];
  var i;

  for (i = 0; i < BROWSERS.length; i++) {
    urls.push(SUB[BROWSERS[i].key]);
  }

  urls.push(getOtherAppsUrl());
  return urls;
}

function extractHostname(url) {
  var match;
  if (!url || typeof url !== "string") {
    return "";
  }

  match = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^\/:?#]+)/i.exec(url);
  if (!match) {
    return "";
  }

  return match[1].replace(/^\[/, "").replace(/\]$/, "");
}

function addUnique(items, value) {
  var i;
  if (!value) {
    return;
  }

  for (i = 0; i < items.length; i++) {
    if (items[i] === value) {
      return;
    }
  }

  items.push(value);
}
