# 腕上词典 · 高考版（Weardict 高考版）

在华为 GT4 等轻智能手表（Lite Wearable）上离线使用的英语词典，词库为「维克多英语 · 高考词汇」11070 词。

> 基于开源社区"腕上词典（Weardict）"二次开发，使用/分发请遵守 LICENSE 并保留 CREDITS 来源标注。

## 功能

- 离线查词：英文 / 中文双语检索，释义、音标、例句、翻译齐全。
- 高考词库：维克多英语 · 高考词汇 11070 词，A/B 双词典。
- 生词本：按词性分类（名词→动词→形容词→副词→介词…），组内按 A–Z 排序；两级交互（词性 → 单词列表）。
- 短语检索：支持 `due to`、`look after` 等短语，命中词下展示关联短语。
- 搜索增强：大小写 / 连字符变体归一化匹配（`xray` ↔ `X-ray` ↔ `x-ray`），连字符词分组兜底检索。
- 历史记录：最近查词可回溯。
- 圆屏适配：466×466 / 336×306 适配，launcher 图标带安全边距。

## 截图

待补充（安装到真机后补充预览图，发布时可一并放入 Releases）。

## 工程结构

```
Weardict-gaokao/
├── build-profile.json5 / hvigorfile.ts / oh-package.json5   # hvigor 工程骨架
├── entry/
│   ├── build-profile.json5 / hvigorfile.ts / oh-package.json5
│   └── src/main/
│       ├── config.json            # 应用配置（bundleName、页面注册、API）
│       └── js/default/            # 页面源码 + 词库
│           ├── app.js
│           ├── pages/             # 页面
│           └── common/            # 公共 JS + 图片 + dict 词库
└── tools/
    └── convert_weici_to_watchdict.py   # 词库转换脚本
```

## 词库说明

- 位置：`entry/src/main/js/default/common/dict/`（A+B 共 54 文件）。
- 格式：`dic_a.bin` = 完整词典（V2 9 字段 / 旧 5 字段）、`dic_b.bin` = 短语简库（2 字段 `词|释义`）；`dic_<a/b>_<首字母>_map.bin` 为字节级二级索引。
- 检索路径：运行时经 `storage:bundle_name` 定位到 `internal://app/../../run/<bundle>/assets/js/default/common/dict/`。
- ⚠️ 词库数据版权归原始权利人（维克多英语等），**不在 MIT 许可内**，仅供学习研究。

## 构建与安装

### 命令行构建（hvigor，已验证）

```powershell
$env:JAVA_HOME = "<DevEco安装目录>\jbr"
$env:OHOS_BASE_SDK_HOME = "<API10 SDK 目录>"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
& "<DevEco>\tools\hvigor\bin\hvigorw.bat" assembleHap --mode module -p product=default -p module=entry@default -p buildMode=release --no-daemon
```

> 必须带 `assembleHap --mode module`；未配置签名时产物为未签名 hap（`WARN: Will skip sign 'hap'` 属正常）。

### IDE 构建

1. DevEco Studio → `File → Open` 打开本工程。
2. 若 SDK 版本不符，调整 `build-profile.json5` 的 `compatibleSdkVersion`。
3. 配置签名：`File → Project Structure → Signing Configs`（自动签名或导入签名）。
4. `Build → Build Hap(s)/APP(s)`（release）。
5. 安装：`hdc install <生成的 .hap>`（覆盖安装可先 `hdc uninstall com.yukino.dict.test`）。

### 安装注意

- 未签名 `.app` / `.hap` 无法直接安装（报"解压失败"或错误 30），需先在构建时配置签名，或经支持转换的网站生成签名包。
- 单 JS bundle 不能超过 48KB，超出报"34 内部错误"。

## 来源与许可

- **来源**：详细来源与致谢见 [CREDITS.md](CREDITS.md)（原版 Weardict / 作者 LaoShui、维克多词库、开发 Skill、参考项目等）。
- **许可**：本仓库是原版 **Weardict**（作者 LaoShui）的衍生作品，整体按 **Wrist Dictionary Non-Commercial License v1.0** 授权，**仅限非商业用途**；新增/修改部分由 sage 维护，同样仅限非商业分发。详见 [LICENSE](LICENSE)。
- **词库**：词库数据版权归维克多英语等原始权利人，不在任何开源许可内，仅供个人学习研究。
- **免责声明**：本仓库为个人学习研究作品，与原作者/版权方无隶属关系；如侵犯您的权利，请通过 Issue 联系，确认后立即删除相关内容。商业授权请联系原作者 LaoShui。

## 贡献

欢迎提交 Issue 与 Pull Request。请确保改动符合 Lite Wearable 约束（单 JS ≤48KB、`@system.*` 接口、HML/CSS/JS 语法限制）。
