# 来源与致谢（CREDITS）

本应用（腕上词典 · 高考版）是在多个开源/公开项目与资料基础上二次开发而来。**使用、修改、再分发请保留本文件及以下来源标注。**

## 1. 原版应用与作者

- **腕上词典（Weardict）**：本项目的基础应用，面向华为轻智能手表（Lite Wearable）。
  - 原版仓库（同源工程）：`laoshuikaixue/Weardict-hmos`
  - 原版作者：**LaoShui**（许可：**Wrist Dictionary Non-Commercial License v1.0**，仅限非商业用途）
  - 移植版本：腕上词典 6.4.0 FIT3 移植版（作者 **@nxtei**）；应用包标识 `com.yukino.dict.test` 中的 `yukino` 为原作者标识；版本号 `6.4.x` 沿用原版。
  - 原版本身参考/使用了以下项目：`alone-86/LiteWearable_Tools`、`alone-86/LiteWearable_InputMethod`、`1299172402/weici`（维克多词汇）、Dictionary icons by Freepik。

## 2. 词库数据（版权归原始权利人，不在任何开源许可内）

- **维克多英语 · 高考词汇**（11070 词）：词义、释义、例句、翻译的主要来源，版权归**维克多英语**（词典原版权方）所有。
- 词库转自开源仓库 `1299172402/weici`（"维克多英语词汇"，该仓库**无许可证**且已归档），并经仓库内脚本 `tools/convert_weici_to_watchdict.py` 转换生成（`dic_a.bin` / `dic_b.bin` 及二级索引）。
- 本仓库**不拥有词库版权**，词库仅供个人学习研究；如权利人认为侵权，请联系删除。

## 3. 开发规范 / 技能（Skill）参考

开发与调试遵循以下华为轻智能手表开发规范资料，其版权归各自作者：

- **huawei-lite-watch-development**（Lite Wearable 开发规范 skill，MIT）：源自 `https://github.com/AlanLinYu/huawei-lite-watch-development`
- **hmlwskill**（MIT）：`https://github.com/kqakqakqa/hmlwskill`（华为轻量穿戴应用开发技能）
- **华为官方**：HarmonyOS Lite Wearable / DevEco Studio 开发文档与 SDK。

## 4. 其它参考项目

- **crabKeyboard**（MIT）：`https://github.com/crabPangXie/crabKeyboard`（华为手表输入法项目，作为输入/键盘交互参考；本项目未直接并入其代码）。

## 5. 许可证与免责声明

- 本仓库整体按 **Wrist Dictionary Non-Commercial License v1.0**（原版作者 LaoShui）授权，**仅限非商业用途**；新增/修改部分由 sage 维护，同样仅限非商业分发。详见 LICENSE。
- 本仓库为个人学习、研究、二次开发作品，与上述任何原作者、版权方**无隶属或官方关系**。
- 词库等第三方内容版权归各自权利人；如侵犯您的权利，请提交 Issue 或邮件联系，确认后立即删除相关内容。

---

*维护者：sage · 2026-10*
