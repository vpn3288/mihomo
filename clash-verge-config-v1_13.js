"use strict";

// ══════════════════════════════════════════════════════════════════
//  v1.17 破局定海版 (彻底终结 DNS 死锁·完美释放 Edge 国内分流)
//  [致命Bug修复] 修复 default-nameserver 为纯 IP 矩阵，解除 DoH 自举死锁，
//                彻底解决“所有国内网站无法访问”的断网宕机问题。
//  [Edge逻辑释放] 在 Edge 的独立子路由表中移除 IP 规则的 no-resolve，
//                 完美兼顾冷门国内域名的精准直连。纯海外浏览器继续保持 0ms 隔离。
// ══════════════════════════════════════════════════════════════════

const SUB = {
  Edge:      "YOUR_Edge_SUB_URL_HERE", // 请务必替换
  Chrome:    "YOUR_Chrome_SUB_URL_HERE",
  Firefox:   "YOUR_Firefox_SUB_URL_HERE",
  Brave:     "YOUR_Brave_SUB_URL_HERE",
  LibreWolf: "YOUR_LibreWolf_SUB_URL_HERE",  
  Vivaldi:   "YOUR_Vivaldi_SUB_URL_HERE",
  Opera:     "YOUR_Opera_SUB_URL_HERE",  
  Default:   "YOUR_Default_SUB_URL_HERE",
};

const ENABLE_PROVIDER_OVERRIDE = true;
const ENABLE_EIM_NAT           = true;

const BROWSER_CONFIG = {
  Edge:      { process: ["msedge.exe","msedgewebview2.exe","Copilot.exe","SearchHost.exe","StartMenuExperienceHost.exe","ShellExperienceHost.exe"], enabled: true, allowCN: true  },
  Chrome:    { process: ["chrome.exe"],                                                                                                             enabled: true, allowCN: false },
  Firefox:   { process: ["firefox.exe"],                                                                                                            enabled: true, allowCN: false },
  Brave:     { process: ["brave.exe"],                                                                                                              enabled: true, allowCN: false },
  LibreWolf: { process: ["librewolf.exe"],                                                                                                          enabled: true, allowCN: false },
  Vivaldi:   { process: ["vivaldi.exe"],                                                                                                            enabled: true, allowCN: false },
  Opera:     { process: ["opera.exe","operagx.exe"],                                                                                                enabled: true, allowCN: false },
};

const FORCE_PROXY_DOMAINS = [
  "openai.com", "oaistatic.com", "oaiusercontent.com", "chatgpt.com", "chat.com",
  "anthropic.com", "claude.ai", "claudeusercontent.com",
  "gemini.google.com", "generativelanguage.googleapis.com", "aistudio.google.com",
  "googleapis.com",
  "copilot.microsoft.com", "copilot.cloud.microsoft", "bing.com", "bingapis.com",
  "grok.com", "x.ai", "xai.com", "x.com", "twitter.com",
  "perplexity.ai", "pplx.ai",
  "huggingface.co", "poe.com", "poecdn.net",
  "meta.ai", "sider.ai", "monica.im", "githubcopilot.com", "notebooklm.google.com",
  "midjourney.com", "notion.so", "civitai.com",
  "deepseek.com", "deepseek.chat", "genspark.ai",
  "cursor.com", "cursor.sh",
  "discord.com", "discordapp.com", "discordapp.net",
  "auth0.com", "sentry.io", "intercom.io",
  "turnstile.cloudflare.com", "challenges.cloudflare.com",
  "volces.com", "bytecdntp.com",
  "stripe.com", "recaptcha.net", "coze.com",
  "clerk.com", "clerk.dev", "hcaptcha.com", "statsigapi.net",
  "live.com", "login.live.com", "microsoftonline.com",
  "accounts.google.com", "myaccount.google.com",
  "appleid.apple.com", "auth.openai.com",
  "browserleaks.com", "browserleaks.org", "ipleak.net", "whoer.net", "dnsleaktest.com",
];

const GLOBAL_SERVICES_GEOSITE = [
  "apple", "microsoft", "github", "steam", "telegram", "oracle",
  "google", "cloudflare", "amazon", "fastly",
];

const DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];
const FOREIGN_DNS  = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query", "https://9.9.9.9/dns-query"];

const DNS_CONFIG = {
  "enable":              true,
  "listen":              "127.0.0.1:1053",
  "ipv6":                false,
  "independent-cache":   false,
  "use-system-hosts":    true, 
  "use-hosts":           true,
  "cache-algorithm":     "arc",
  "enhanced-mode":       "fake-ip",
  "fake-ip-range":       "198.18.0.1/16",
  "fake-ip-filter-mode": "blacklist",
  "fake-ip-filter": [
    "+.lan", "+.local", "+.localhost", "localhost",
    "+.msftconnecttest.com", "+.msftncsi.com",
    "dns.msftncsi.com", "www.msftncsi.com",
    "connectivitycheck.gstatic.com",
    "+.windowsupdate.com", "+.windowsupdate.microsoft.com", "update.microsoft.com",
    "time.windows.com", "time.nist.gov", "+.pool.ntp.org",
    "localhost.ptlogin2.qq.com", "localhost.sec.qq.com", "localhost.work.weixin.qq.com",
    "msftconnecttest.com", "msftncsi.com",
    "+.connectivitycheck.microsoft.com",
    "+.www.msftconnecttest.com.v2",
    "ncsi.microsoft.com",
    "ipv6.msftconnecttest.com",
    "dns.msftncsi.com.v2",
  ],
  "prefer-h3":               false,
  // 【致命Bug修复】必须是纯 IP。用于在完全没有网络时，去解析 doh.pub 这类 DoH 域名。
  // 如果这里填入 DoH 链接，Mihomo 会陷入“无法解析解析器本身”的无尽死锁。
  "default-nameserver":      ["223.5.5.5", "119.29.29.29", "1.1.1.1", "8.8.8.8"],
  "nameserver":              FOREIGN_DNS,
  "proxy-server-nameserver": FOREIGN_DNS,
  "respect-rules":           true,
  "nameserver-policy": {
    "geosite:private":            DOMESTIC_DNS,
    "geosite:cn":                 DOMESTIC_DNS,
    "geosite:geolocation-cn":     DOMESTIC_DNS,
    "domain:msftconnecttest.com": DOMESTIC_DNS,
    "domain:msftncsi.com":        DOMESTIC_DNS,
  },
};

const RP_DOMAIN = { "type": "http", "format": "text", "behavior": "domain", "interval": 86400 };
const RP_IP     = { "type": "http", "format": "text", "behavior": "ipcidr", "interval": 86400 };
const CDN       = "https://testingcf.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/";

const RULE_PROVIDERS = {
  "reject":       { ...RP_DOMAIN, "url": CDN+"reject.txt",        "path": "./ruleset/loyalsoldier/reject.txt"       },
  "private":      { ...RP_DOMAIN, "url": CDN+"private.txt",       "path": "./ruleset/loyalsoldier/private.txt"      },
  "direct":       { ...RP_DOMAIN, "url": CDN+"direct.txt",        "path": "./ruleset/loyalsoldier/direct.txt"       },
  "proxy":        { ...RP_DOMAIN, "url": CDN+"proxy.txt",         "path": "./ruleset/loyalsoldier/proxy.txt"        },
  "gfw":          { ...RP_DOMAIN, "url": CDN+"gfw.txt",           "path": "./ruleset/loyalsoldier/gfw.txt"          },
  "tld-not-cn":   { ...RP_DOMAIN, "url": CDN+"tld-not-cn.txt",    "path": "./ruleset/loyalsoldier/tld-not-cn.txt"   },
  "lancidr":      { ...RP_IP,     "url": CDN+"lancidr.txt",       "path": "./ruleset/loyalsoldier/lancidr.txt"      },
  "cncidr":       { ...RP_IP,     "url": CDN+"cncidr.txt",        "path": "./ruleset/loyalsoldier/cncidr.txt"       },
  "telegramcidr": { ...RP_IP,     "url": CDN+"telegramcidr.txt",  "path": "./ruleset/loyalsoldier/telegramcidr.txt" },
};

const HEALTH_CHECK = {
  "enable":   true,
  "url":      "https://www.gstatic.com/generate_204",
  "interval": 1800,
  "lazy":     true,
  "timeout":  5000,
};

const GROUP_BASE = {
  "interval":         1800,
  "timeout":          5000,
  "url":              "https://www.google.com/generate_204",
  "lazy":             true,
  "max-failed-times": 3,
  "tolerance":        200,
};

function main(config, profileName) {
  if (!config || typeof config !== "object") throw new Error("Invalid config");

  Object.keys(SUB).forEach(key => {
    if (SUB[key].includes("YOUR_")) throw new Error(`[致命警告] 订阅链接未替换: ${key} → ${SUB[key]}`);
  });

  config["mode"]                = "rule";
  config["ipv6"]                = false;
  config["allow-lan"]           = false;
  config["bind-address"]        = "127.0.0.1";
  config["log-level"]           = "warning";
  config["unified-delay"]       = true;
  config["tcp-concurrent"]      = true;
  config["keep-alive-interval"] = 45;
  config["keep-alive-idle"]     = 600;
  config["find-process-mode"]   = "always";
  config["udp-timeout"]         = 60;

  config["geo-auto-update"]     = true;
  config["geo-update-interval"] = 24;
  config["geodata-mode"]        = true;
  config["geodata-loader"]      = "standard";
  config["geox-url"] = {
    "geoip":   "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
    "geosite": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    "mmdb":    "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
  };
  config["profile"] = { "store-selected": true, "store-fake-ip": false };

  config["tun"] = {
    "enable":                true,
    "stack":                 "system",
    "device":                "Meta",
    "auto-route":            true,
    "strict-route":          true,
    "auto-detect-interface": true,
    "dns-hijack":            ["any:53", "tcp://any:53"],
    "mtu":                   1500,
    "ipv6":                  false,
    ...(ENABLE_EIM_NAT && { "endpoint-independent-nat": true }),
  };

  config["sniffer"] = {
    "enable":               true,
    "force-dns-mapping":    true,
    "parse-pure-ip":        true,
    "override-destination": false,
    "sniff": {
      "HTTP": { "ports": [80, "8080-8880"], "override-destination": true },
      "TLS":  { "ports": [443, 8443] },
      "QUIC": { "ports": [443] },
    },
  };

  config["dns"]             = DNS_CONFIG;
  config["proxy-providers"] = _buildProviders();
  config["proxy-groups"]    = _buildGroups();
  config["rule-providers"]  = RULE_PROVIDERS;
  
  config["sub-rules"]       = _buildSubRules();
  config["rules"]           = _buildRules();

  return config;
}

function _buildProviders() {
  const providers = {};

  const fingerprintMap = {
    Edge: "edge", Chrome: "chrome", Firefox: "firefox",
    Brave: "chrome", LibreWolf: "firefox", Opera: "chrome", Vivaldi: "chrome",
  };

  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    if (!SUB[n]) throw new Error(`[_buildProviders] SUB 中缺少浏览器 "${n}" 的订阅链接`);

    providers[`provider-${n.toLowerCase()}`] = {
      "type":         "http",
      "url":          SUB[n],
      "interval":     86400,
      "path":         `./providers/${n.toLowerCase()}.yaml`,
      "health-check": HEALTH_CHECK,
      ...(ENABLE_PROVIDER_OVERRIDE && {
        "override": {
          "udp":                true,
          "client-fingerprint": fingerprintMap[n] || "chrome",
        },
      }),
    };
  });

  providers["provider-default"] = {
    "type":         "http",
    "url":          SUB.Default,
    "interval":     86400,
    "path":         "./providers/default.yaml",
    "health-check": HEALTH_CHECK,
    ...(ENABLE_PROVIDER_OVERRIDE && {
      "override": {
        "udp":                true,
        "client-fingerprint": "chrome",
      },
    }),
  };

  return providers;
}

function _buildGroups() {
  const groups = [];

  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    groups.push({
      ...GROUP_BASE,
      "name":        `${n}代理`,
      "type":        "select",
      "use":         [`provider-${n.toLowerCase()}`],
    });
  });

  groups.push({ ...GROUP_BASE, "name": "默认自动", "type": "url-test", "use": ["provider-default"], "disable-udp": false });
  groups.push({ "name": "默认代理", "type": "select", "proxies": ["默认自动", "DIRECT"] });
  groups.push({ "name": "国内直连", "type": "select", "proxies": ["DIRECT"] });
  groups.push({ "name": "广告拦截", "type": "select", "proxies": ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ "name": "漏网之鱼", "type": "select", "proxies": ["默认代理", "DIRECT"] });

  return groups;
}

function _buildSubRules() {
  const subRules = {};
  
  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    
    const subName = `${n}_Sub`;
    const proxyTarget = `${n}代理`;
    const rules = [];

    // 1. AI 矩阵与 OAuth 鉴权链前置保护（最高优先级）
    FORCE_PROXY_DOMAINS.forEach(domain => {
      rules.push(`DOMAIN-SUFFIX,${domain},${proxyTarget}`);
    });

    // 2. 根据是否兼顾国内，注入不同逻辑
    if (BROWSER_CONFIG[n].allowCN) {
      rules.push(`GEOSITE,cn,国内直连`);
      rules.push(`RULE-SET,direct,国内直连`);
      // 【逻辑解绑】移除 no-resolve，赋予 Edge 解析未知冷门国内域名的能力
      // 当遇到未被 GEOSITE,cn 涵盖的国内冷门网站时，现在会正常解析 IP 并走国内直连兜底
      rules.push(`RULE-SET,cncidr,国内直连`);
      rules.push(`GEOIP,CN,国内直连`);
    } else {
      GLOBAL_SERVICES_GEOSITE.forEach(geosite => {
        rules.push(`GEOSITE,${geosite},${proxyTarget}`);
      });
      rules.push(`GEOSITE,cn,REJECT`);
      // 纯海外浏览器继续强制 no-resolve，保障 0ms 延迟与绝对无国内 DNS 泄露
      rules.push(`RULE-SET,cncidr,REJECT,no-resolve`);
      rules.push(`GEOIP,CN,REJECT,no-resolve`);
    }

    // 3. 闭环兜底
    rules.push(`MATCH,${proxyTarget}`);
    subRules[subName] = rules;
  });

  return subRules;
}

function _buildRules() {
  const rules = [];

  // ① 系统底层与 NTP 免疫直连
  rules.push("PROCESS-NAME,DeliveryOptimization.exe,国内直连");
  rules.push("DST-PORT,123,国内直连"); 
  rules.push("DOMAIN-SUFFIX,ntp.org,国内直连");
  rules.push("DOMAIN-SUFFIX,msftconnecttest.com,国内直连");
  rules.push("DOMAIN-SUFFIX,msftncsi.com,国内直连");
  rules.push("DOMAIN-SUFFIX,windowsupdate.com,国内直连");
  rules.push("DOMAIN-SUFFIX,update.microsoft.com,国内直连");
  rules.push("DOMAIN-SUFFIX,windowsupdate.microsoft.com,国内直连");
  rules.push("DOMAIN-SUFFIX,delivery.mp.microsoft.com,国内直连");

  // ② 局域网 / 组播防穿透
  rules.push("IP-CIDR,224.0.0.0/4,国内直连,no-resolve");
  rules.push("GEOIP,PRIVATE,国内直连,no-resolve");
  rules.push("RULE-SET,private,国内直连");
  rules.push("RULE-SET,lancidr,国内直连,no-resolve");

  // ③ 广告拦截主干防线
  rules.push("GEOSITE,category-ads-all,广告拦截");
  rules.push("RULE-SET,reject,广告拦截");

  // ④ 官方 SUB-RULE 导流（完美进程隔离网）
  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    BROWSER_CONFIG[n].process.forEach(proc => {
      rules.push(`SUB-RULE,(PROCESS-NAME,${proc}),${n}_Sub`);
    });
  });

  // ⑤ Telegram 客户端及底层专线兜底
  rules.push("GEOSITE,telegram,默认代理");
  rules.push("RULE-SET,telegramcidr,默认代理,no-resolve");

  // ⑥ 最终全局环境兜底
  rules.push("RULE-SET,direct,国内直连");
  rules.push("GEOSITE,cn,国内直连");
  rules.push("RULE-SET,cncidr,国内直连,no-resolve");
  rules.push("GEOIP,CN,国内直连,no-resolve");

  rules.push("RULE-SET,proxy,默认代理");
  rules.push("RULE-SET,gfw,默认代理");
  rules.push("RULE-SET,tld-not-cn,默认代理");
  rules.push("GEOSITE,geolocation-!cn,默认代理");

  rules.push("MATCH,漏网之鱼");

  return rules;
}
