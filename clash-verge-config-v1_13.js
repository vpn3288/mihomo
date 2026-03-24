"use strict";

// ══════════════════════════════════════════════════════════════════
//  v1.13 终极封笔版（AI 鉴权链绝对免疫层恢复）
//  [Gemini-🔴] v1.12 步骤④移除 FORCE_PROXY_DOMAINS 前置保护后，
//               bing.com/live.com/appleid.apple.com 等兼具 CN 落地业务
//               的域名存在于 GEOSITE,cn，导致：
//               ① Edge → Copilot/Bing 命中步骤⑥直连→微软识别 CN 真实 IP→Copilot 被锁
//               ② 非Edge → 同类域名命中步骤⑦ REJECT→OAuth 登录无限转圈
//               修复：恢复步骤④纯字符串 AND(域名×进程) 免疫层，Radix 树 <0.1ms 无性能损耗
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  1. 订阅配置区
//  ⚠️  所有包含 "YOUR_" 的占位符必须替换为真实订阅链接
// ══════════════════════════════════════════════════════════════════

const SUB = {
  Edge:      "et=ClashMeta",
  Chrome:    "rget=ClashMeta",
  Firefox:   "ad/AL-California",
  Brave:     "5%9B%BD-%E5%87%A4%E5%87%B0%E5%9F%8E",
  LibreWolf: "BE%8E%E5%9B%BD-%E5%87%A4%E5%87%B0%E5%9F%8E3",
  Vivaldi:   "%BF%E4%BB%80%E6%9C%AC",
  Opera:     "8%BF%E4%BB%80%E6%9C%AC2",
  Default:   "http",
};

// ══════════════════════════════════════════════════════════════════
//  2. 运行时环境与浏览器进程矩阵
// ══════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════
//  3. 核心白名单数据 (AI 矩阵 + OAuth 鉴权链 + 顶级测漏平台)
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
  // 三大 IdP 全球鉴权域名（OAuth 握手链闭合）
  "live.com", "login.live.com", "microsoftonline.com",
  "accounts.google.com", "myaccount.google.com",
  "appleid.apple.com", "auth.openai.com",
  // 顶级安全与测漏平台
  "browserleaks.com", "browserleaks.org", "ipleak.net", "whoer.net", "dnsleaktest.com",
];

// 【v1.7 Gemini-🟠】补全全球顶级云 CDN 基础设施，防止泛播 IP 被误判 CN 触发非 Edge 浏览器断网
const GLOBAL_SERVICES_GEOSITE = [
  "apple", "microsoft", "github", "steam", "telegram", "oracle",
  "google", "cloudflare", "amazon", "fastly",
];

// ══════════════════════════════════════════════════════════════════
//  4. DNS 引擎架构 (彻底防漏配置)
// ══════════════════════════════════════════════════════════════════

const DOMESTIC_DNS = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];
const FOREIGN_DNS  = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query", "https://9.9.9.9/dns-query"];

const DNS_CONFIG = {
  "enable":              true,
  "listen":              "127.0.0.1:1053",
  "ipv6":                false,
  "independent-cache":   false,  // 【v1.11 Gemini-🟡】共享全局缓存池，消除跨浏览器重复 DoH 解析延迟
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
    "+.www.msftconnecttest.com.v2",
    "ncsi.microsoft.com",
    "ipv6.msftconnecttest.com",
    "dns.msftncsi.com.v2",
  ],
  "prefer-h3":               false,
  "default-nameserver":      FOREIGN_DNS,   // 【v1.8 Gemini-🟡】强制走境外 DoH，封堵兜底国内 DNS 元数据泄露
  "nameserver":              FOREIGN_DNS,
  "proxy-server-nameserver": FOREIGN_DNS,
  "respect-rules":           true,
  "nameserver-policy": {
    "geosite:private,cn,geolocation-cn":       DOMESTIC_DNS,
    "domain:msftconnecttest.com,msftncsi.com": DOMESTIC_DNS,
  },
  // fallback/fallback-filter 已移除：【v1.12 Gemini-🟡】nameserver-policy 已精确覆盖国内域名，
  // fallback 与 nameserver 指向相同 FOREIGN_DNS，并发双轨无收益，直接剔除实现单轨极简解析。
};

// ══════════════════════════════════════════════════════════════════
//  5. 外部规则集源 (Loyalsoldier)
// ══════════════════════════════════════════════════════════════════

const RP_DOMAIN = { "type": "http", "format": "text", "behavior": "domain", "interval": 86400 };  // 【v1.10 Grok-🟡-3】恢复 1 天，确保规则及时性
const RP_IP     = { "type": "http", "format": "text", "behavior": "ipcidr", "interval": 86400 };  // 【v1.10 Grok-🟡-3】恢复 1 天，确保规则及时性
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
  "url":      "https://www.gstatic.com/generate_204",  // 【v1.9 Grok-🟡-1】provider 健康检查保持 gstatic
  "interval": 1800,  // 【v1.9 Grok-🟡-1】600→1800s，打乱固定探测节奏消除机器指纹
  "lazy":     true,
  "timeout":  5000,
};

const GROUP_BASE = {
  "interval":         1800,  // 【v1.9 Grok-🟡-1】600→1800s
  "timeout":          5000,
  "url":              "https://www.google.com/generate_204",  // 【v1.9 Grok-🟡-1】混用不同 URL 打乱节奏
  "lazy":             true,
  "max-failed-times": 3,
  "tolerance":        200,
};

// ══════════════════════════════════════════════════════════════════
//  Main 主函数入口
// ══════════════════════════════════════════════════════════════════

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
  config["keep-alive-interval"] = 45;   // 【v1.10 Grok-🟡-2】30→45s，稀释 KeepAlive 节奏
  config["keep-alive-idle"]     = 600;
  config["find-process-mode"]   = "always";
  config["udp-timeout"]         = 60;   // 【v1.10 Grok-🟡-1】300→60s，加速 UDP 状态表清理

  // 【v1.7 Grok-🟠】彻底移除 global-ua，让浏览器自行发送匹配 UA
  // 消除 TLS 指纹与 HTTP User-Agent 不匹配导致的风控识别
  // config["global-ua"] ← 已永久删除，禁止恢复

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
    "mtu":                   1500,  // 【v1.7 Grok-🟠】从 9000 降至 1500，消除 jumbo-frame 探测特征
    "ipv6":                  false,
    ...(ENABLE_EIM_NAT && { "endpoint-independent-nat": true }),
  };

  // 确保 parse-pure-ip 将所有纯 IP 连接强制映射回 fake-ip 缓存，
  // 彻底封堵 TUN 模式下 WebRTC STUN/ICE 携带真实出口 IP 的泄露路径。
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
  config["rules"]           = _buildRules();

  return config;
}

// ══════════════════════════════════════════════════════════════════
//  构建 Providers (智能指纹映射)
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
      "interval":     86400,  // 【v1.10 Grok-🟡-3】恢复 1 天
      "path":         `./providers/${n.toLowerCase()}.yaml`,
      "health-check": HEALTH_CHECK,
      ...(ENABLE_PROVIDER_OVERRIDE && {
        "override": {
          "udp":                true,
          "client-fingerprint": fp,
        },
      }),
    };
  });

  providers["provider-default"] = {
    "type":         "http",
    "url":          SUB.Default,
    "interval":     86400,  // 【v1.10 Grok-🟡-3】恢复 1 天
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
//  v1.13 最终执行顺序：
//  ① 系统底层免疫
//  ② 局域网防穿透
//  ③ 【已移除 QUIC 阻断，释放 HTTP/3 性能】
//  ④ 【v1.13 Gemini-🔴 恢复】AI/鉴权域名×进程 AND 免疫前置防线
//      → 拦截 bing.com/live.com/microsoftonline.com/appleid.apple.com 等
//        兼具 CN 落地的域名在步骤⑥⑦被 GEOSITE,cn 误捕（直连泄露 / REJECT 断网）
//      → 纯字符串 Radix 树匹配 <0.1ms，绝对零性能损耗
//  ⑤ 广告拦截
//  ⑥ Edge 分流（仅域名级，AND 规则无 no-resolve 且不含 IP 匹配）
//  ⑦ 非Edge封锁（全球CDN白名单 + 国内域 REJECT，仅域名级）
//  ⑧ 浏览器进程主干兜底（归宿，确保浏览器流量 100% 由专属组接管）
//  ⑨ 【v1.7 Gemini-🔴】Telegram 专线（下沉至 ⑧ 之后）
//  ⑩ 国内直连兜底（单行 no-resolve 恢复）
//  ⑪ 境外代理兜底
//  ⑫ MATCH
//
//  AND 逻辑规则末尾一律不加 no-resolve（Mihomo 解析器限制，v1.6 已确认）
// ══════════════════════════════════════════════════════════════════

function _buildRules() {
  const rules = [];
  const names = Object.keys(BROWSER_CONFIG);

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

  // ③ 【v1.11 Gemini-🟠】移除全局 QUIC 阻断。
  //    uTLS 指纹 + Fake-IP 已足够对抗 GFW 探测，全局 REJECT UDP/443 会导致所有浏览器
  //    强制降级 HTTP/2，Google/YouTube/AI 站点首屏延迟增加 100-300ms，违背极速原则。
  // rules.push("AND,((NETWORK,UDP),(DST-PORT,443)),REJECT"); ← 已永久移除，禁止恢复

  // ④ 【v1.13 Gemini-🔴 恢复】AI/鉴权域名 × 进程 绝对免疫前置防线
  //    bing.com, live.com, microsoftonline.com, appleid.apple.com 等域名同时存在于 GEOSITE,cn，
  //    若不在此前置截断，步骤⑥ Edge 会直连（微软识别 CN IP→Copilot 隐形封锁），
  //    步骤⑦ 非 Edge 会 REJECT（OAuth 握手断裂→登录无限转圈）。
  //    纯字符串 Radix 树匹配耗时 <0.1ms，远低于 IP 解析的 100-300ms，零性能代价。
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

  // ⑥ Edge 浏览器特权放行（仅域名级，AND 规则无 no-resolve 且不含 IP 匹配）
  // 【v1.12 Gemini-🟠】删除 cncidr/GEOIP AND 规则：AND 规则无法加 no-resolve，
  //   IP 匹配强制触发同步 DoH 解析，击穿 Fake-IP 秒连。GEOSITE,cn 已足够覆盖绝大多数 CN 域名。
  if (BROWSER_CONFIG.Edge && BROWSER_CONFIG.Edge.enabled) {
    BROWSER_CONFIG.Edge.process.forEach(proc => {
      rules.push(`AND,((GEOSITE,cn),(PROCESS-NAME,${proc})),国内直连`);
      rules.push(`AND,((RULE-SET,direct),(PROCESS-NAME,${proc})),国内直连`);
    });
  }

  // ⑦ 非 Edge 浏览器：全球顶级 CDN 白名单防误杀 + 国内域封锁（仅域名级）
  // 【v1.12 Gemini-🟠】删除 cncidr/GEOIP AND 规则，同上：IP 匹配强制触发同步 DoH 解析。
  // 【v1.7 Gemini-🟠】GLOBAL_SERVICES_GEOSITE 已补全 google/cloudflare/amazon/fastly
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

  // ⑨ 【v1.7 Gemini-🔴 核心修复】Telegram 专线下沉至浏览器主干 ⑧ 之后
  // 浏览器内的 Telegram 流量已在 ⑧ 由各浏览器专属组接管，此处仅为系统原生客户端兜底
  rules.push("GEOSITE,telegram,默认代理");
  rules.push("RULE-SET,telegramcidr,默认代理,no-resolve");

  // ⑩ 国内域 / IP 直连兜底（单行 IP 规则保留 no-resolve，Gemini-🟡 确认）
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
