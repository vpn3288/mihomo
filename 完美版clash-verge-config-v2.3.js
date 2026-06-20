"use strict";

/*
  Clash Verge / Mihomo script config v2.3

  Why this file is ASCII-only:
  Some Windows editors and terminals decode UTF-8 JavaScript as the system ANSI
  code page. Chinese comments and group names can then become unreadable text.
  This version keeps comments, errors, and policy group names in ASCII to avoid
  display and copy/paste formatting problems.

  Fill the subscription URLs below before using this script.
*/

const SUBSCRIPTION_URLS = {
  Edge: "https://YOUR_EDGE_SUBSCRIPTION_URL",
  Chrome: "https://YOUR_CHROME_SUBSCRIPTION_URL",
  Firefox: "https://YOUR_FIREFOX_SUBSCRIPTION_URL",
  Brave: "https://YOUR_BRAVE_SUBSCRIPTION_URL",
  LibreWolf: "https://YOUR_LIBREWOLF_SUBSCRIPTION_URL",
  Vivaldi: "https://YOUR_VIVALDI_SUBSCRIPTION_URL",
  Opera: "https://YOUR_OPERA_SUBSCRIPTION_URL",

  // New in v2.3: all non-browser apps use this provider by default.
  OtherApps: "https://YOUR_OTHER_APPS_SUBSCRIPTION_URL",

  // Final fallback provider.
  Default: "https://YOUR_DEFAULT_SUBSCRIPTION_URL",
};

const GHOST_STATIC_PROXIES = [
  // Paste Ghost-Proxy / AWG static proxy objects here if needed.
];

const ENABLE_PROVIDER_OVERRIDE = true;
const ENABLE_EIM_NAT = true;
const BLOCK_QUIC = true;

const BROWSER_CONFIG = {
  Edge: {
    process: [
      "msedge.exe",
      "msedgewebview2.exe",
      "Copilot.exe",
      "SearchHost.exe",
      "StartMenuExperienceHost.exe",
      "ShellExperienceHost.exe",
      "WebViewHost.exe",
    ],
    enabled: true,
    allowCN: true,
    fingerprint: "edge",
  },
  Chrome: { process: ["chrome.exe"], enabled: true, allowCN: false, fingerprint: "chrome" },
  Firefox: { process: ["firefox.exe"], enabled: true, allowCN: false, fingerprint: "firefox" },
  Brave: { process: ["brave.exe"], enabled: true, allowCN: false, fingerprint: "chrome" },
  LibreWolf: { process: ["librewolf.exe"], enabled: true, allowCN: false, fingerprint: "firefox" },
  Vivaldi: { process: ["vivaldi.exe"], enabled: true, allowCN: false, fingerprint: "chrome" },
  Opera: { process: ["opera.exe", "operagx.exe"], enabled: true, allowCN: false, fingerprint: "chrome" },
};

const GROUP = {
  edge: "EdgeProxy",
  chrome: "ChromeProxy",
  firefox: "FirefoxProxy",
  brave: "BraveProxy",
  librewolf: "LibreWolfProxy",
  vivaldi: "VivaldiProxy",
  opera: "OperaProxy",
  otherAuto: "OtherAppsAuto",
  otherProxy: "OtherAppsProxy",
  defaultAuto: "DefaultAuto",
  defaultProxy: "DefaultProxy",
  direct: "Direct",
  ads: "AdBlock",
  leak: "FinalFallback",
};

const FORCE_PROXY_DOMAINS = [
  "openai.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "chatgpt.com",
  "chat.com",
  "anthropic.com",
  "claude.ai",
  "claudeusercontent.com",
  "gemini.google.com",
  "generativelanguage.googleapis.com",
  "aistudio.google.com",
  "googleapis.com",
  "copilot.microsoft.com",
  "copilot.cloud.microsoft",
  "bing.com",
  "bingapis.com",
  "grok.com",
  "x.ai",
  "xai.com",
  "x.com",
  "twitter.com",
  "perplexity.ai",
  "pplx.ai",
  "huggingface.co",
  "poe.com",
  "poecdn.net",
  "meta.ai",
  "sider.ai",
  "monica.im",
  "githubcopilot.com",
  "notebooklm.google.com",
  "midjourney.com",
  "notion.so",
  "civitai.com",
  "deepseek.com",
  "deepseek.chat",
  "genspark.ai",
  "cursor.com",
  "cursor.sh",
  "discord.com",
  "discordapp.com",
  "discordapp.net",
  "auth0.com",
  "sentry.io",
  "intercom.io",
  "turnstile.cloudflare.com",
  "challenges.cloudflare.com",
  "stripe.com",
  "recaptcha.net",
  "coze.com",
  "clerk.com",
  "clerk.dev",
  "hcaptcha.com",
  "statsigapi.net",
  "live.com",
  "login.live.com",
  "microsoftonline.com",
  "accounts.google.com",
  "myaccount.google.com",
  "appleid.apple.com",
  "auth.openai.com",
  "browserleaks.com",
  "browserleaks.org",
  "ipleak.net",
  "whoer.net",
  "dnsleaktest.com",
];

const EDGE_DIRECT_DOMAINS = ["oracle.com", "oraclecloud.com", "oci.oraclecloud.com"];
const GLOBAL_SERVICE_GEOSITES = [
  "apple",
  "microsoft",
  "github",
  "steam",
  "telegram",
  "oracle",
  "google",
  "cloudflare",
  "amazon",
  "fastly",
];

const DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];
const FOREIGN_DNS = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query", "https://9.9.9.9/dns-query"];

const DNS_CONFIG = {
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
    "+.pool.ntp.org",
    "localhost.ptlogin2.qq.com",
    "localhost.sec.qq.com",
    "localhost.work.weixin.qq.com",
  ],
  "prefer-h3": false,
  "default-nameserver": ["223.5.5.5", "119.29.29.29"],
  nameserver: FOREIGN_DNS,
  "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29", "8.8.8.8", "1.1.1.1"],
  "respect-rules": true,
  "nameserver-policy": {
    "geosite:private": DOMESTIC_DNS,
    "geosite:cn": DOMESTIC_DNS,
    "geosite:geolocation-cn": DOMESTIC_DNS,
    "geosite:gfw": FOREIGN_DNS,
    "+.msftconnecttest.com": DOMESTIC_DNS,
    "+.msftncsi.com": DOMESTIC_DNS,
    "+.oracle.com": DOMESTIC_DNS,
    "+.oraclecloud.com": DOMESTIC_DNS,
  },
  fallback: FOREIGN_DNS,
  "fallback-filter": { geoip: true, "geoip-code": "CN" },
};

const RULE_PROVIDER_CDN = "https://testingcf.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/";
const RULE_PROVIDER_DOMAIN = { type: "http", format: "text", behavior: "domain", interval: 43200 };
const RULE_PROVIDER_IP = { type: "http", format: "text", behavior: "ipcidr", interval: 43200 };

const RULE_PROVIDERS = {
  reject: { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "reject.txt", path: "./ruleset/loyalsoldier/reject.txt" },
  private: { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "private.txt", path: "./ruleset/loyalsoldier/private.txt" },
  direct: { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "direct.txt", path: "./ruleset/loyalsoldier/direct.txt" },
  proxy: { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "proxy.txt", path: "./ruleset/loyalsoldier/proxy.txt" },
  gfw: { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "gfw.txt", path: "./ruleset/loyalsoldier/gfw.txt" },
  "tld-not-cn": { ...RULE_PROVIDER_DOMAIN, url: RULE_PROVIDER_CDN + "tld-not-cn.txt", path: "./ruleset/loyalsoldier/tld-not-cn.txt" },
  lancidr: { ...RULE_PROVIDER_IP, url: RULE_PROVIDER_CDN + "lancidr.txt", path: "./ruleset/loyalsoldier/lancidr.txt" },
  cncidr: { ...RULE_PROVIDER_IP, url: RULE_PROVIDER_CDN + "cncidr.txt", path: "./ruleset/loyalsoldier/cncidr.txt" },
  telegramcidr: { ...RULE_PROVIDER_IP, url: RULE_PROVIDER_CDN + "telegramcidr.txt", path: "./ruleset/loyalsoldier/telegramcidr.txt" },
};

const HEALTH_CHECK = {
  enable: true,
  url: "https://www.gstatic.com/generate_204",
  interval: 300,
  timeout: 5000,
  lazy: true,
  "expected-status": 204,
};

const GROUP_BASE = {
  interval: 300,
  timeout: 5000,
  url: "https://www.gstatic.com/generate_204",
  lazy: true,
  "max-failed-times": 2,
  tolerance: 200,
  "expected-status": 204,
};

const GHOST_PROVIDER_EXCLUDE_FILTER = "^(AWG-Tunnel|DIRECT|REJECT|REJECT-DROP)$";

function main(config, profileName) {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid Clash/Mihomo config object.");
  }

  validateSubscriptionUrls();

  config.mode = "rule";
  config.ipv6 = false;
  config["allow-lan"] = false;
  config["bind-address"] = "127.0.0.1";
  config["log-level"] = "warning";
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["keep-alive-interval"] = 15;
  config["keep-alive-idle"] = 600;
  config["find-process-mode"] = "always";
  config["udp-timeout"] = 300;

  config["external-controller"] = "127.0.0.1:9090";
  config["external-ui"] = "ui";
  config.secret = "";

  config["geo-auto-update"] = true;
  config["geo-update-interval"] = 24;
  config["geodata-mode"] = true;
  config["geodata-loader"] = "standard";
  config["geox-url"] = {
    geoip: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
    geosite: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    mmdb: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
  };

  config.profile = { "store-selected": true, "store-fake-ip": true };
  config.proxies = mergeUniqueProxies(config.proxies, GHOST_STATIC_PROXIES);
  config.tun = buildTunConfig();
  config.sniffer = buildSnifferConfig();
  config.dns = DNS_CONFIG;
  config["proxy-providers"] = buildProviders();
  config["proxy-groups"] = buildGroups();
  config["rule-providers"] = RULE_PROVIDERS;
  config.rules = buildRules();

  return config;
}

function validateSubscriptionUrls() {
  Object.entries(SUBSCRIPTION_URLS).forEach(([name, url]) => {
    if (typeof url !== "string" || url.trim() === "") {
      throw new Error(`[Missing subscription URL] ${name} cannot be empty.`);
    }
    if (url.includes("YOUR_")) {
      throw new Error(`[Subscription URL not replaced] Please fill ${name}: ${url}`);
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`[Invalid subscription URL] ${name} must start with http:// or https://.`);
    }
  });
}

function buildTunConfig() {
  return {
    enable: true,
    stack: "system",
    device: "Meta",
    "auto-route": true,
    "strict-route": true,
    "auto-detect-interface": true,
    "dns-hijack": ["any:53", "tcp://any:53"],
    mtu: 1500,
    ipv6: false,
    ...(ENABLE_EIM_NAT && { "endpoint-independent-nat": true }),
  };
}

function buildSnifferConfig() {
  return {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": false,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443], "override-destination": true },
      QUIC: { ports: [443], "override-destination": true },
    },
  };
}

function buildProviders() {
  const providers = {};

  Object.entries(BROWSER_CONFIG).forEach(([name, browser]) => {
    if (!browser.enabled) return;
    providers[providerKey(name)] = createProvider({
      name: name.toLowerCase(),
      url: SUBSCRIPTION_URLS[name],
      fingerprint: browser.fingerprint,
    });
  });

  providers["provider-other-apps"] = createProvider({
    name: "other-apps",
    url: SUBSCRIPTION_URLS.OtherApps,
    fingerprint: "chrome",
  });

  providers["provider-default"] = createProvider({
    name: "default",
    url: SUBSCRIPTION_URLS.Default,
    fingerprint: "chrome",
  });

  return providers;
}

function createProvider({ name, url, fingerprint }) {
  return {
    type: "http",
    url,
    interval: 86400,
    path: `./providers/${name}.yaml`,
    "health-check": HEALTH_CHECK,
    ...(GHOST_STATIC_PROXIES.length > 0 && { "exclude-filter": GHOST_PROVIDER_EXCLUDE_FILTER }),
    ...(ENABLE_PROVIDER_OVERRIDE && {
      override: {
        udp: true,
        "ip-version": "ipv4-prefer",
        "client-fingerprint": fingerprint || "chrome",
      },
    }),
  };
}

function buildGroups() {
  const groups = [];

  Object.entries(BROWSER_CONFIG).forEach(([name, browser]) => {
    if (!browser.enabled) return;
    groups.push({
      ...GROUP_BASE,
      name: browserGroupName(name),
      type: "url-test",
      use: [providerKey(name)],
      "disable-udp": false,
    });
  });

  groups.push({
    ...GROUP_BASE,
    name: GROUP.otherAuto,
    type: "url-test",
    use: ["provider-other-apps"],
    "disable-udp": false,
  });

  groups.push({
    name: GROUP.otherProxy,
    type: "select",
    proxies: [GROUP.otherAuto, GROUP.defaultProxy, "DIRECT"],
  });

  groups.push({
    ...GROUP_BASE,
    name: GROUP.defaultAuto,
    type: "url-test",
    use: ["provider-default"],
    "disable-udp": false,
  });

  groups.push({ name: GROUP.defaultProxy, type: "select", proxies: [GROUP.defaultAuto, GROUP.otherProxy, "DIRECT"] });
  groups.push({ name: GROUP.direct, type: "select", proxies: ["DIRECT"] });
  groups.push({ name: GROUP.ads, type: "select", proxies: ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ name: GROUP.leak, type: "select", proxies: [GROUP.otherProxy, GROUP.defaultProxy, "DIRECT"] });

  return groups;
}

function buildRules() {
  const rules = [];
  const browserEntries = Object.entries(BROWSER_CONFIG).filter(([, browser]) => browser.enabled);

  rules.push(`IP-CIDR,1.1.1.1/32,${GROUP.defaultProxy},no-resolve`);
  rules.push(`IP-CIDR,1.0.0.1/32,${GROUP.defaultProxy},no-resolve`);
  rules.push(`IP-CIDR,9.9.9.9/32,${GROUP.defaultProxy},no-resolve`);
  rules.push(`IP-CIDR,223.5.5.5/32,${GROUP.direct},no-resolve`);
  rules.push(`IP-CIDR,119.29.29.29/32,${GROUP.direct},no-resolve`);

  rules.push(`PROCESS-NAME,DeliveryOptimization.exe,${GROUP.direct}`);
  rules.push(`AND,((NETWORK,UDP),(DST-PORT,123)),${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,ntp.org,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,msftconnecttest.com,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,msftncsi.com,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,windowsupdate.com,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,update.microsoft.com,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,windowsupdate.microsoft.com,${GROUP.direct}`);
  rules.push(`DOMAIN-SUFFIX,delivery.mp.microsoft.com,${GROUP.direct}`);

  rules.push(`IP-CIDR,224.0.0.0/4,${GROUP.direct},no-resolve`);
  rules.push(`GEOIP,PRIVATE,${GROUP.direct},no-resolve`);
  rules.push(`RULE-SET,private,${GROUP.direct}`);
  rules.push(`RULE-SET,lancidr,${GROUP.direct},no-resolve`);

  if (BLOCK_QUIC) {
    rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT");
  }

  browserEntries.forEach(([name, browser]) => {
    browser.process.forEach((processName) => {
      FORCE_PROXY_DOMAINS.forEach((domain) => {
        rules.push(`AND,((DOMAIN-SUFFIX,${domain}),(PROCESS-NAME,${processName})),${browserGroupName(name)}`);
      });
    });
  });

  rules.push(`GEOSITE,category-ads-all,${GROUP.ads}`);
  rules.push(`RULE-SET,reject,${GROUP.ads}`);

  const edge = BROWSER_CONFIG.Edge;
  if (edge && edge.enabled) {
    edge.process.forEach((processName) => {
      EDGE_DIRECT_DOMAINS.forEach((domain) => {
        rules.push(`AND,((DOMAIN-SUFFIX,${domain}),(PROCESS-NAME,${processName})),${GROUP.direct}`);
      });
      rules.push(`AND,((GEOSITE,cn),(PROCESS-NAME,${processName})),${GROUP.direct}`);
      rules.push(`AND,((RULE-SET,direct),(PROCESS-NAME,${processName})),${GROUP.direct}`);
    });
  }

  browserEntries.forEach(([name, browser]) => {
    if (browser.allowCN) return;
    browser.process.forEach((processName) => {
      GLOBAL_SERVICE_GEOSITES.forEach((geosite) => {
        rules.push(`AND,((GEOSITE,${geosite}),(PROCESS-NAME,${processName})),${browserGroupName(name)}`);
      });
      rules.push(`AND,((GEOSITE,cn),(PROCESS-NAME,${processName})),REJECT`);
    });
  });

  browserEntries.forEach(([name, browser]) => {
    browser.process.forEach((processName) => {
      rules.push(`PROCESS-NAME,${processName},${browserGroupName(name)}`);
    });
  });

  rules.push(`GEOSITE,telegram,${GROUP.otherProxy}`);
  rules.push(`RULE-SET,telegramcidr,${GROUP.otherProxy},no-resolve`);
  rules.push(`NETWORK,TCP,${GROUP.otherProxy}`);
  rules.push(`NETWORK,UDP,${GROUP.otherProxy}`);

  rules.push(`RULE-SET,direct,${GROUP.direct}`);
  rules.push(`GEOSITE,cn,${GROUP.direct}`);
  rules.push(`RULE-SET,cncidr,${GROUP.direct},no-resolve`);
  rules.push(`GEOIP,CN,${GROUP.direct},no-resolve`);
  rules.push(`RULE-SET,proxy,${GROUP.defaultProxy}`);
  rules.push(`RULE-SET,gfw,${GROUP.defaultProxy}`);
  rules.push(`RULE-SET,tld-not-cn,${GROUP.defaultProxy}`);
  rules.push(`GEOSITE,geolocation-!cn,${GROUP.defaultProxy}`);
  rules.push(`MATCH,${GROUP.leak}`);

  return rules;
}

function providerKey(name) {
  return `provider-${name.toLowerCase()}`;
}

function browserGroupName(name) {
  return GROUP[name.toLowerCase()];
}

function mergeUniqueProxies(existingProxies, extraProxies) {
  const result = [];
  const seen = {};
  [...(Array.isArray(existingProxies) ? existingProxies : []), ...extraProxies].forEach((proxy) => {
    if (!proxy || typeof proxy !== "object" || !proxy.name || seen[proxy.name]) return;
    seen[proxy.name] = true;
    result.push(proxy);
  });
  return result;
}
