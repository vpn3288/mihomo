# mihomo 配置

## 文件说明

- `Android浏览器分流(完美版).yaml` - Android 浏览器分流配置
- `Windows浏览器分流(完美版).yaml` - Windows 浏览器分流配置  
- `完美版clash-verge-config-v2.13.js` - 当前推荐版，Clash Verge 分浏览器前置地区链式代理生产增强版配置生成器
- `完美版clash-verge-config-v2.4.js` - Clash Verge 安全性能优化版配置生成器

## 使用方法

### Android

1. 安装 Clash for Android
2. 下载 `Android浏览器分流(完美版).yaml`
3. 导入到 Clash 配置

### Windows

1. 安装 Clash Verge
2. 下载 `Windows浏览器分流(完美版).yaml`
3. 导入到 Clash 配置

### Clash Verge 链式代理

1. 使用 `完美版clash-verge-config-v2.13.js`
2. 在脚本顶部把 `SUB.Front` 填成购买的前置订阅链接
3. 把 `SUB.Edge`、`SUB.Chrome`、`SUB.Firefox` 等填成自己的 VPS 落地订阅链接
4. 保持 `ENABLE_CHAIN_PROXY = true`

链路为：本机 -> 前置订阅节点 -> 浏览器专属落地 VPS 节点 -> 目标网站。目标网站看到的是自己的 VPS 落地 IP。

`FrontProxy`、`EdgeFrontProxy`、`ChromeFrontProxy` 这类前置组只作为落地节点的 `dialer-proxy`，业务规则仍然指向 `EdgeProxy`、`ChromeProxy`、`DefaultProxy`、`OtherAppsProxy` 等落地组。不要把浏览器规则直接改成前置组。

常用开关：

- `STRICT_NO_DIRECT_FALLBACK = true`：默认开启，移除最终兜底里的 `DIRECT`，避免代理全挂时直连泄漏。
- `ALLOW_DIRECT_RULES = false`：关闭 Edge 国内直连、其他应用国内直连和系统服务直连；如果要求任何网站都不能看到本机 IP，使用此项。
- `LANDING_PROVIDER_EXCLUDE_TYPE = ""`：默认不过滤落地协议，AnyTLS 等协议不会被排除。
- `CHAIN_DISABLE_UDP = true`：当前置节点不支持 UDP 转发时，可禁用链式落地节点 UDP。
- `FRONT_SELECTION_MODE = "fallback"`：默认稳定优先，`FrontProxy` 直接是 fallback 组；可改为 `"url-test"` 延迟优先、`"select"` 手动选择、`"load-balance"` 负载均衡。
- `FRONT_NODE_FILTER = ""`：前置节点太多时，可填 `香港|台湾|日本|新加坡` 这类过滤表达式。
- `FRONT_NODE_EXCLUDE_FILTER`：默认排除剩余流量、官网、到期、自动选择、负载均衡，以及容易造成地区误判的中转/专线/IPLC 标识；如果你的购买订阅把这些当作可用前置节点出售，可手动删掉对应关键词。
- `FRONT_PROXY_GROUPS`：从同一个购买订阅里创建多个前置组，例如美国、新加坡、日本、香港、台湾、韩国、加拿大、英国、德国、法国、澳洲。
- `FRONT_REGION_PRESETS`：常用前置地区顺序模板，例如 `us_first`、`asia_first`、`jp_first`、`eu_first`、`all_regions`。
- `FRONT_PROXY_BY_PROVIDER`：设置每个浏览器的默认前置地区、手动可选地区和自动兜底顺序，并在 Clash Verge 界面里单独切换。
- `HEALTH_CHECK_URLS.front = "https://cp.cloudflare.com/"`：前置节点默认用 Cloudflare 200 做健康检查，避免国内环境下 Google 204 探测全失败。
- `HEALTH_CHECK_EXPECTED_STATUS`：如果更换健康检查 URL，要同步修改期望状态码；Cloudflare cp 是 200，Google generate_204 是 204。
- `CHAIN_PROXY_DNS_ENABLED = true`：可让链式代理使用独立的 `proxy-server-nameserver`，默认关闭以避免 DoH 递归/兼容问题。
- `FRONT_PROXY_ALLOW_DIRECT_FALLBACK = true` 或 `EMERGENCY_DIRECT_TO_LANDING = true`：仅调试时使用；严格模式开启时脚本会拒绝这类配置。

前置地区选择示例：

- `EdgeFrontProxy` 默认选中 `FrontProxyUS`，也可手动切到 `EdgeFrontAutoFallback`、日本、新加坡、全部前置等。
- `ChromeFrontProxy` 默认选中 `FrontProxySG`，也可手动切到 `ChromeFrontAutoFallback`、日本、香港、台湾、美国、全部前置等。
- `FirefoxFrontProxy` 默认选中 `FrontProxyJP`，也可手动切到 `FirefoxFrontAutoFallback`、新加坡、香港、美国、全部前置等。
- 修改 `FRONT_PROXY_GROUPS` 的 `filter` 字段即可适配你购买订阅的实际节点命名。`filter`/`exclude` 都是正则，建议先单独导入 `SUB.Front` 看节点名，再调整关键词。
- 前置地区只决定“本机如何连接到 VPS”；如果所有浏览器落地订阅都是同一台 VPS，目标网站看到的仍是同一个 VPS IP。

验证方法：

- 访问 IP 检测网站，应该显示自己的 VPS 落地 IP，不是购买订阅的前置 IP。
- 在落地 VPS 上查看连接来源，应该是购买订阅的前置节点 IP，不应该是本机公网 IP。
- 断开或改坏前置节点后，落地节点应不可用，说明落地确实通过前置建连。
- UDP 类落地协议（Hysteria2、TUIC、QUIC、WireGuard 等）需要前置节点支持 UDP 转发；不确定时优先用 TCP 类落地协议。
- 落地节点 server 尽量使用 IP，减少本机解析落地节点域名带来的 DNS 暴露。
- 前置节点健康检查会访问 `HEALTH_CHECK_URLS.front`，默认是 Cloudflare 轻量检测地址；这不是用户真实业务流量，介意时可降低检查频率或换成自有轻量检测地址。

## 注意事项

- 配置文件需要配合 mihomo/clash 核心使用
- 定期更新配置以获取最新节点
