"use strict";

// ══════════════════════════════════════════════════════════════════
//  v2.2 修复清单（封笔版，三方 AI 审查零 BUG 确认后最终微调）
//
//  [v2.2-✅] 移除 global-client-fingerprint
//             最新 Mihomo 文档已标记该全局字段 deprecated，
//             推荐仅在 proxy / provider override 中设置（已逐浏览器精确设置）。
//             移除避免未来版本可能的 log 警告，逻辑无任何变化。
//
//  其余全部继承 v2.1（经三方逐行审查无 BUG）：
//  ✅ proxy-server-nameserver 纯 IP（防 DoH 死循环）
//  ✅ Oracle 从 FORCE_PROXY_DOMAINS 移出改为 Edge 直连白名单
//  ✅ ⓪ DoH IP-CIDR 强制放行（防 TUN DNS 路由环路）
//  ✅ ⑥ Edge / ⑦ 非Edge 均移除 IP 类 AND 规则（防强制 DNS 解析拖速）
//  ✅ nameserver-policy 键名 +. 语法（修正 domain: 语法错误）
//  ✅ fake-ip-filter Win11 微软条目补全
//  ✅ nameserver-policy Oracle 走 DOMESTIC_DNS（解析更快）
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  1. 订阅配置区  ← 把你的订阅链接填在这里（必须是完整的 https:// 链接）
// ══════════════════════════════════════════════════════════════════

const SUB = {
  Edge:      "https://YOUR_EDGE_SUBSCRIPTION_URL",
  Chrome:    "https://YOUR_CHROME_SUBSCRIPTION_URL",
  Firefox:   "https://YOUR_FIREFOX_SUBSCRIPTION_URL",
  Brave:     "https://YOUR_BRAVE_SUBSCRIPTION_URL",
  LibreWolf: "https://YOUR_LIBREWOLF_SUBSCRIPTION_URL",
  Vivaldi:   "https://YOUR_VIVALDI_SUBSCRIPTION_URL",
  Opera:     "https://YOUR_OPERA_SUBSCRIPTION_URL",
  Default:   "https://YOUR_DEFAULT_SUBSCRIPTION_URL",
};

// Ghost-Proxy AWG 双轨专用：
// 1. 把落地机输出的 GHOST_STATIC_PROXIES_JS_OBJECT_START/END 之间的对象粘贴到这里。
// 2. Sub-Store 订阅只放 SUBSTORE_PROVIDER_YAML/JSON 里的主轨、备轨可见节点。
// 3. 不要把完整 Mihomo Profile 导入 Sub-Store；否则 Sub-Store 会把 AWG-Tunnel 扁平化成普通节点。
// 4. 这样 GLOBAL/浏览器代理组只显示主轨/备轨，AWG-Tunnel 只作为 dialer-proxy 底层依赖。
const GHOST_STATIC_PROXIES = [
  // 示例：
  // {
  //   name: "AWG-Tunnel",
  //   type: "wireguard",
  //   server: "1.2.3.4",
  //   port: 51821,
  //   ip: "10.8.0.2",
  //   "private-key": "...",
  //   "public-key": "...",
  //   hidden: true,
  //   udp: true,
  //   mtu: 1360,
  //   "allowed-ips": ["10.8.0.0/24"],
  //   "amnezia-wg-option": { jc: 5, jmin: 50, jmax: 200, s1: 1, s2: 2, h1: 3, h2: 4, h3: 5, h4: 6 },
  // },
];

const GHOST_PROVIDER_EXCLUDE_FILTER = "^(AWG-Tunnel|DIRECT|REJECT|REJECT-DROP)$";

// ══════════════════════════════════════════════════════════════════
//  2. 运行时环境与浏览器进程矩阵
// ══════════════════════════════════════════════════════════════════

const ENABLE_PROVIDER_OVERRIDE = true;
const ENABLE_EIM_NAT           = true;

const BROWSER_CONFIG = {
  Edge:      { process: ["msedge.exe","msedgewebview2.exe","Copilot.exe","SearchHost.exe","StartMenuExperienceHost.exe","ShellExperienceHost.exe","WebViewHost.exe"], enabled: true, allowCN: true  },
  Chrome:    { process: ["chrome.exe"],                                                                                                              enabled: true, allowCN: false },
  Firefox:   { process: ["firefox.exe"],                                                                                                             enabled: true, allowCN: false },
  Brave:     { process: ["brave.exe"],                                                                                                               enabled: true, allowCN: false },
  LibreWolf: { process: ["librewolf.exe"],                                                                                                           enabled: true, allowCN: false },
  Vivaldi:   { process: ["vivaldi.exe"],                                                                                                             enabled: true, allowCN: false },
  Opera:     { process: ["opera.exe","operagx.exe"],                                                                                                 enabled: true, allowCN: false },
};

// ══════════════════════════════════════════════════════════════════
//  3. 核心白名单数据
// ══════════════════════════════════════════════════════════════════

const FORCE_PROXY_DOMAINS = [
  // AI 主站
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
  // 鉴权与 CDN 基础设施
  "auth0.com", "sentry.io", "intercom.io",
  "turnstile.cloudflare.com", "challenges.cloudflare.com",
  "volces.com", "bytecdntp.com",
  "stripe.com", "recaptcha.net", "coze.com",
  "clerk.com", "clerk.dev", "hcaptcha.com", "statsigapi.net",
  // 三大 IdP 全球鉴权域名
  "live.com", "login.live.com", "microsoftonline.com",
  "accounts.google.com", "myaccount.google.com",
  "appleid.apple.com", "auth.openai.com",
  // 顶级安全与测漏平台
  "browserleaks.com", "browserleaks.org", "ipleak.net", "whoer.net", "dnsleaktest.com",
];

// Edge 专属直连白名单（Oracle Cloud：VPS 机房 IP 被防火墙封锁，家庭宽带直连才能通过）
const EDGE_DIRECT_DOMAINS = [
  "oracle.com", "oraclecloud.com", "oci.oraclecloud.com",
];

// 全球顶级云 CDN 白名单（防止泛播 IP 误判 CN 触发非 Edge 浏览器断网）
const GLOBAL_SERVICES_GEOSITE = [
  "apple", "microsoft", "github", "steam", "telegram", "oracle",
  "google", "cloudflare", "amazon", "fastly",
];

// ══════════════════════════════════════════════════════════════════
//  4. DNS 引擎架构
// ══════════════════════════════════════════════════════════════════

const DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];
const FOREIGN_DNS  = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query", "https://9.9.9.9/dns-query"];

const DNS_CONFIG = {
  "enable":              true,
  "listen":              "127.0.0.1:1053",
  "ipv6":                false,
  "independent-cache":   true,
  "use-system-hosts":    false,
  "use-hosts":           false,
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
    "ncsi.microsoft.com",
    "+.www.msftconnecttest.com.v2",
    "dns.msftncsi.com.v2",
    "ipv6.msftconnecttest.com",
  ],
  "prefer-h3":               false,
  "default-nameserver":      ["223.5.5.5", "119.29.29.29"],
  "nameserver":              FOREIGN_DNS,
  "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29", "8.8.8.8", "1.1.1.1"],
  "respect-rules":           true,
  "nameserver-policy": {
    "geosite:private":         DOMESTIC_DNS,
    "geosite:cn":              DOMESTIC_DNS,
    "geosite:geolocation-cn":  DOMESTIC_DNS,
    "geosite:gfw":             FOREIGN_DNS,
    // [v2.1-✅] 修正语法：domain: 是 rules 语法，nameserver-policy 用 +. 前缀
    "+.msftconnecttest.com":   DOMESTIC_DNS,
    "+.msftncsi.com":          DOMESTIC_DNS,
    // [v2.1-✅] Oracle 走直连，用国内 DoH 解析更快 50-200ms
    "+.oracle.com":            DOMESTIC_DNS,
    "+.oraclecloud.com":       DOMESTIC_DNS,
  },
  "fallback":        FOREIGN_DNS,
  "fallback-filter": { "geoip": true, "geoip-code": "CN" },
};

// ══════════════════════════════════════════════════════════════════
//  5. 外部规则集源 (Loyalsoldier)
// ══════════════════════════════════════════════════════════════════

const RP_DOMAIN = { "type": "http", "format": "text", "behavior": "domain", "interval": 43200 };
const RP_IP     = { "type": "http", "format": "text", "behavior": "ipcidr", "interval": 43200 };
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

// ══════════════════════════════════════════════════════════════════
//  6. 健康检查与策略组公共基础参数
// ══════════════════════════════════════════════════════════════════

const HEALTH_CHECK = {
  "enable":   true,
  "url":      "https://www.gstatic.com/generate_204",
  "interval": 300,
  "lazy":     true,
  "timeout":  5000,
};

const GROUP_BASE = {
  "interval":         300,
  "timeout":          5000,
  "url":              "https://www.gstatic.com/generate_204",
  "lazy":             true,
  "max-failed-times": 2,
  "tolerance":        200,
};

// ══════════════════════════════════════════════════════════════════
//  Main 主函数入口
// ══════════════════════════════════════════════════════════════════

function main(config, profileName) {
  if (!config || typeof config !== "object") throw new Error("Invalid config");

  Object.keys(SUB).forEach(key => {
    const v = SUB[key];
    if (v.includes("YOUR_")) throw new Error(`[致命警告] 订阅链接未替换: ${key} → ${v}`);
    if (!v.startsWith("http")) throw new Error(`[致命警告] 订阅链接格式错误（必须以 http 开头）: ${key} → ${v}`);
  });

  config["mode"]                      = "rule";
  config["ipv6"]                      = false;
  config["allow-lan"]                 = false;
  config["bind-address"]              = "127.0.0.1";
  config["log-level"]                 = "warning";
  config["unified-delay"]             = true;
  config["tcp-concurrent"]            = true;
  config["keep-alive-interval"]       = 15;
  config["keep-alive-idle"]           = 600;
  config["find-process-mode"]         = "always";
  config["udp-timeout"]               = 300;

  // Round 1 优化：启用 external-controller（支持浏览器脚本时区自动化）
  config["external-controller"]       = "127.0.0.1:9090";
  config["external-ui"]               = "ui";
  config["secret"]                    = "";  // 本地使用可留空

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
  config["proxies"] = GHOST_STATIC_PROXIES;

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
      "TLS":  { "ports": [443, 8443],       "override-destination": true },
      "QUIC": { "ports": [443],             "override-destination": true },
    },
  };

  config["dns"]             = DNS_CONFIG;
  config["proxy-providers"] = _buildProviders();
  config["proxy-groups"]    = _buildGroups();
  config["rule-providers"]  = RULE_PROVIDERS;
  config["rules"]           = _buildRules();

  return config;
}

// ══════════════════════════════════════════════════════════════════
//  构建 Providers
// ══════════════════════════════════════════════════════════════════

function _buildProviders() {
  const providers = {};

  const fingerprintMap = {
    Edge:      "edge",
    Chrome:    "chrome",
    Firefox:   "firefox",
    Brave:     "chrome",
    LibreWolf: "firefox",
    Opera:     "chrome",
    Vivaldi:   "chrome",
  };

  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    if (!SUB[n]) throw new Error(`[_buildProviders] SUB 中缺少浏览器 "${n}" 的订阅链接`);
    const fp = fingerprintMap[n] || "chrome";
    providers[`provider-${n.toLowerCase()}`] = {
      "type":         "http",
      "url":          SUB[n],
      "interval":     86400,
      "path":         `./providers/${n.toLowerCase()}.yaml`,
      "health-check": HEALTH_CHECK,
      ...(GHOST_STATIC_PROXIES.length > 0 && {
        "exclude-filter": GHOST_PROVIDER_EXCLUDE_FILTER,
      }),
      ...(ENABLE_PROVIDER_OVERRIDE && {
        "override": { "udp": true, "client-fingerprint": fp },
      }),
    };
  });

  providers["provider-default"] = {
    "type":         "http",
    "url":          SUB.Default,
    "interval":     86400,
    "path":         "./providers/default.yaml",
    "health-check": HEALTH_CHECK,
    ...(GHOST_STATIC_PROXIES.length > 0 && {
      "exclude-filter": GHOST_PROVIDER_EXCLUDE_FILTER,
    }),
    ...(ENABLE_PROVIDER_OVERRIDE && {
      "override": { "udp": true, "client-fingerprint": "chrome" },
    }),
  };

  return providers;
}

// ══════════════════════════════════════════════════════════════════
//  构建策略组
// ══════════════════════════════════════════════════════════════════

function _buildGroups() {
  const groups = [];

  Object.keys(BROWSER_CONFIG).forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    groups.push({
      ...GROUP_BASE,
      "name":        `${n}代理`,
      "type":        "url-test",
      "use":         [`provider-${n.toLowerCase()}`],
      "disable-udp": false,
    });
  });

  groups.push({ ...GROUP_BASE, "name": "默认自动", "type": "url-test", "use": ["provider-default"], "disable-udp": false });
  groups.push({ "name": "默认代理", "type": "select", "proxies": ["默认自动", "DIRECT"] });
  groups.push({ "name": "国内直连", "type": "select", "proxies": ["DIRECT"] });
  groups.push({ "name": "广告拦截", "type": "select", "proxies": ["REJECT-DROP", "REJECT", "DIRECT"] });
  groups.push({ "name": "漏网之鱼", "type": "select", "proxies": ["默认代理", "DIRECT"] });

  return groups;
}

// ══════════════════════════════════════════════════════════════════
//  构建路由规则 (瀑布流白名单)
//
//  ⓪ DoH 服务器 IP 强制放行（消除 DNS 路由环路）
//  ① 系统底层免疫直连
//  ② 局域网防穿透
//  ③ QUIC 全局阻断（消除 UDP 流量指纹）
//  ④ VIP AI 白名单 + OAuth 鉴权链（进程绑定）
//  ⑤ 广告拦截
//  ⑥ Edge 分流（Oracle 直连 + 国内直连，仅 GEOSITE/RULE-SET domain 类 AND）
//  ⑦ 非 Edge 封锁（全球 CDN 白名单 + GEOSITE,cn REJECT，无 IP AND 规则）
//  ⑧ 浏览器进程主干兜底
//  ⑨ Telegram 专线
//  ⑩ 国内直连兜底（no-resolve，接管所有 CN IP-only 流量）
//  ⑪ 境外代理兜底
//  ⑫ MATCH
// ══════════════════════════════════════════════════════════════════

function _buildRules() {
  const rules = [];
  const names = Object.keys(BROWSER_CONFIG);

  // ⓪ DoH 服务器 IP 强制放行，防止 TUN 接管 DNS 流量触发路由规则造成解析卡死
  rules.push("IP-CIDR,1.1.1.1/32,默认代理,no-resolve");
  rules.push("IP-CIDR,1.0.0.1/32,默认代理,no-resolve");
  rules.push("IP-CIDR,9.9.9.9/32,默认代理,no-resolve");
  rules.push("IP-CIDR,223.5.5.5/32,国内直连,no-resolve");
  rules.push("IP-CIDR,119.29.29.29/32,国内直连,no-resolve");

  // ① 系统底层免疫直连
  rules.push("PROCESS-NAME,DeliveryOptimization.exe,国内直连");
  rules.push("AND,((NETWORK,UDP),(DST-PORT,123)),国内直连");
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

  // ③ 全局阻断 QUIC (UDP 443)，迫使浏览器降级走 TCP，消除 UDP 流量指纹
  rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT");

  // ④ VIP 白名单进程绑定（AI 主站 + OAuth 鉴权链 + 测漏平台）
  names.forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    BROWSER_CONFIG[n].process.forEach(proc => {
      FORCE_PROXY_DOMAINS.forEach(domain => {
        rules.push(`AND,((DOMAIN-SUFFIX,${domain}),(PROCESS-NAME,${proc})),${n}代理`);
      });
    });
  });

  // ⑤ 广告拦截
  rules.push("GEOSITE,category-ads-all,广告拦截");
  rules.push("RULE-SET,reject,广告拦截");

  // ⑥ Edge 浏览器特权放行（仅 GEOSITE/RULE-SET domain 类 AND，无 IP 规则，防止强制 DNS 解析）
  if (BROWSER_CONFIG.Edge && BROWSER_CONFIG.Edge.enabled) {
    BROWSER_CONFIG.Edge.process.forEach(proc => {
      // Oracle Cloud 直连（家庭宽带 IP 通过，VPS IP 被封）
      EDGE_DIRECT_DOMAINS.forEach(domain => {
        rules.push(`AND,((DOMAIN-SUFFIX,${domain}),(PROCESS-NAME,${proc})),国内直连`);
      });
      // 国内域名直连
      rules.push(`AND,((GEOSITE,cn),(PROCESS-NAME,${proc})),国内直连`);
      rules.push(`AND,((RULE-SET,direct),(PROCESS-NAME,${proc})),国内直连`);
    });
  }

  // ⑦ 非 Edge 浏览器：全球顶级 CDN 白名单防误杀 + GEOSITE,cn REJECT
  // [v2.1-✅] 移除 RULE-SET,cncidr 和 GEOIP,CN 的 AND 规则
  //           原因：AND+IP 规则强制触发 DNS 解析，fake-ip 加速对非 Edge 浏览器形同虚设。
  //           GEOSITE,cn 已拦截绝大多数国内域名，IP-only 漏网流量走 ⑧→VPS（可接受）。
  names.forEach(n => {
    if (!BROWSER_CONFIG[n].enabled || BROWSER_CONFIG[n].allowCN) return;
    BROWSER_CONFIG[n].process.forEach(proc => {
      GLOBAL_SERVICES_GEOSITE.forEach(geosite => {
        rules.push(`AND,((GEOSITE,${geosite}),(PROCESS-NAME,${proc})),${n}代理`);
      });
      rules.push(`AND,((GEOSITE,cn),(PROCESS-NAME,${proc})),REJECT`);
    });
  });

  // ⑧ 浏览器进程主干兜底（所有浏览器流量到此终结，确保单 IP 隔离铁律）
  names.forEach(n => {
    if (!BROWSER_CONFIG[n].enabled) return;
    BROWSER_CONFIG[n].process.forEach(proc => {
      rules.push(`PROCESS-NAME,${proc},${n}代理`);
    });
  });

  // ⑨ Telegram 专线（系统原生客户端兜底，浏览器内 Telegram 已在 ⑧ 接管）
  rules.push("GEOSITE,telegram,默认代理");
  rules.push("RULE-SET,telegramcidr,默认代理,no-resolve");

  // ⑩ 国内直连兜底（no-resolve IP 规则，接管 ⑥⑦ 移除的 IP-only CN 流量）
  rules.push("RULE-SET,direct,国内直连");
  rules.push("GEOSITE,cn,国内直连");
  rules.push("RULE-SET,cncidr,国内直连,no-resolve");
  rules.push("GEOIP,CN,国内直连,no-resolve");

  // ⑪ 境外常规代理兜底
  rules.push("RULE-SET,proxy,默认代理");
  rules.push("RULE-SET,gfw,默认代理");
  rules.push("RULE-SET,tld-not-cn,默认代理");
  rules.push("GEOSITE,geolocation-!cn,默认代理");

  // ⑫ 最终漏网兜底
  rules.push("MATCH,漏网之鱼");

  return rules;
}
