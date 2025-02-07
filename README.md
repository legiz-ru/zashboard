# zashboard

### Online zashboard

1. http://board.zash.run.place

### Download zashboard

1. dist.zip (about 7.64MB): https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip
2. dist-cdn-fonts.zip (about 1.27MB): https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip

### Docker

```
docker run -d -p 80:80 ghcr.io/zephyruso/zashboard:latest
```

## Tips

1. The connection page has two layout styles: customizable cards and customizable tables. It is recommended to use tables on PC and cards on mobile devices.
2. There are many customizable options in the panel settings, be sure to check them out.
3. The release contains two types of packages, The dist-cdn-fonts.zip package is more friendly to devices with limited storage space, while the dist.zip package provides a better font loading experience.
4. Right-clicking on a node / node group card will perform a speedtest for the node / node group.

## 提示

1. 连接页面有两种布局样式：可自定义卡片和可自定义表格。建议在 PC 上使用表格，在移动设备上使用卡片。
2. 在面板设置中有很多可自定义的选项，请务必去看看
3. release中存在两种包，dist-cdn-fonts.zip对小储存空间设备更友好，dist.zip则能带来更好的字体加载体验
4. 右键点击节点/节点组卡片可对节点/节点组进行测速

## URL params format

1. **`http` / `https`**

   - Determines the protocol (`http` or `https`).
   - If both are present, `https` takes precedence.
   - Default: Current page's protocol.

2. **`hostname`**

   - The Clash API's IP or domain.

3. **`port`**

   - The Clash API port.

4. **`secondaryPath`**

   - Optional path appended to the base URL.
   - Default: An empty string.

5. **`secret`**
   - Password for authentication.
