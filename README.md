# mihomo 配置

## 文件说明

- `Android浏览器分流(完美版).yaml` - Android 浏览器分流配置
- `Windows浏览器分流(完美版).yaml` - Windows 浏览器分流配置  
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

1. 使用 `完美版clash-verge-config-v2.5.js`
2. 在脚本顶部把 `SUB.Front` 填成购买的前置订阅链接
3. 把 `SUB.Edge`、`SUB.Chrome`、`SUB.Firefox` 等填成自己的 VPS 落地订阅链接
4. 保持 `ENABLE_CHAIN_PROXY = true`

链路为：本机 -> 前置订阅节点 -> 浏览器专属落地 VPS 节点 -> 目标网站。目标网站看到的是自己的 VPS 落地 IP。

## 注意事项

- 配置文件需要配合 mihomo/clash 核心使用
- 定期更新配置以获取最新节点
