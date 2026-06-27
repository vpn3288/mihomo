# mihomo 配置

## 文件说明

- `Android浏览器分流(完美版).yaml` - Android 浏览器分流配置
- `Windows浏览器分流(完美版).yaml` - Windows 浏览器分流配置  
- `完美版clash-verge-config-v2.6.js` - Clash Verge 链式代理增强版配置生成器
- `完美版clash-verge-config-v2.5.js` - Clash Verge 链式代理配置生成器
- `完美版clash-verge-config-v2.4.js` - Clash Verge 安全性能优化版配置生成器
- `完美版clash-verge-config-v2.2.js` - Clash Verge 历史配置生成器

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

1. 使用 `完美版clash-verge-config-v2.6.js`
2. 在脚本顶部把 `SUB.Front` 填成购买的前置订阅链接
3. 把 `SUB.Edge`、`SUB.Chrome`、`SUB.Firefox` 等填成自己的 VPS 落地订阅链接
4. 保持 `ENABLE_CHAIN_PROXY = true`

链路为：本机 -> 前置订阅节点 -> 浏览器专属落地 VPS 节点 -> 目标网站。目标网站看到的是自己的 VPS 落地 IP。

`FrontProxy` 只作为落地节点的 `dialer-proxy`，业务规则仍然指向 `EdgeProxy`、`ChromeProxy`、`DefaultProxy`、`OtherAppsProxy` 等落地组。不要把浏览器规则直接改成 `FrontProxy`。

常用开关：

- `STRICT_NO_DIRECT_FALLBACK = true`：移除最终兜底里的 `DIRECT`，避免代理全挂时直连泄漏。
- `LANDING_PROVIDER_EXCLUDE_TYPE = ""`：默认不过滤落地协议，AnyTLS 等协议不会被排除。
- `CHAIN_DISABLE_UDP = true`：当前置节点不支持 UDP 转发时，可禁用链式落地节点 UDP。
- `FRONT_PROXY_ALLOW_DIRECT_FALLBACK = true`：仅调试时使用，允许在 `FrontProxy` 里手动选 `DIRECT`。

验证方法：

- 访问 IP 检测网站，应该显示自己的 VPS 落地 IP，不是购买订阅的前置 IP。
- 断开或改坏前置节点后，落地节点应不可用，说明落地确实通过前置建连。
- UDP 类落地协议（Hysteria2、TUIC、QUIC、WireGuard 等）需要前置节点支持 UDP 转发；不确定时优先用 TCP 类落地协议。

## 注意事项

- 配置文件需要配合 mihomo/clash 核心使用
- 定期更新配置以获取最新节点
