# PaperPeek 🔎

**Read the paper. Get the point. Keep the essentials.**

PaperPeek 是一个面向科研人员的 Chrome 侧边栏扩展，帮助理解**当前的一篇 PDF 论文**，快速判断研究价值、向论文提问，并导出便于回顾与 AI 再利用的简短 Markdown 论文卡片。

> Status: **v0.1.3 experimental MVP**. Public arXiv PDFs are the primary test target. Not a PDF replacement, citation manager, archive or multi-paper knowledge base.

## Current features (v0.1.3)

- 🔎 识别 Chrome 当前 PDF：arXiv、常见 HTTPS PDF、网页内嵌/下载链接及获授权的本地 file:// PDF；可重新检测、选择候选地址、粘贴 URL 或手动打开文件
- 🧠 PDF.js 提取分页正文，生成结构化中文论文概览
- 💬 面向当前论文的多轮问答；内置六类科研阅读提示词，强调术语首次出现时中文＋英文、证据和局限
- 🔗 概览中的关键实验发现，只有当短引文能够在对应 PDF 页中匹配时才显示已验证页码跳转
- 📝 自动生成精简 **Paper Card**，一键复制或下载 UTF-8 `.md`
- 🔑 无 PaperPeek 后端，按服务商分别配置模型和 API Key；OpenAI / DeepSeek 可同步官方模型列表，支持手动指定 ID 和自愿持久保存密钥
- 📌 右键选中文字 → Explain with PaperPeek（在原生 Chrome PDF Reader 中能否提供选区取决于浏览器行为）

**Known limitations:** 对登录/POST/blob 等来源无法保证直接获取；只支持有可提取文本的 PDF；双栏和公式提取可能混乱；文本输入截断上限 125,000 字符；普通问答中的页码是模型建议、**尚未做引文校验**；原生 PDF Viewer 无法由扩展精确高亮；不支持图表框选、OCR、多论文和知识库同步。API 可用性取决于用户密钥、所选模型和供应商政策。

## 安装（开发者模式）

需要 **Node.js 22.12+、npm、Chrome 116+**。

```bash
git clone https://github.com/Housz/PaperPeek.git
cd PaperPeek
npm install
npm run check
npm test
npm run build
```

打开 `chrome://extensions` → 开启**开发者模式** → **加载已解压的扩展程序** → 选择项目的 `dist/` 文件夹。

1. 点击 PaperPeek 图标，在侧边栏右上角设置中选择服务商、配置 API Key 和模型。
2. 对 **DeepSeek / OpenAI** 可刷新官方模型列表并测试模型；可选勾选“在此设备保存 Key”，默认只保存到浏览器会话。Gemini 暂为手动模型 ID。
3. 在 Chrome 中打开本地或在线 PDF；未识别时点击顶部**重新检测**，必要时从多候选中选择或粘贴 HTTPS PDF 地址，随后**分析**。本地 file:// 需在扩展详情中开启文件访问权限。
4. 在**概览 / 提问**中阅读和追问；讲解类问题由提问页的快捷入口发起。打开**卡片**复制 Markdown 或下载 `.md` 文件。
5. 解析失败时，可以点击**选择 PDF**手动选择文件。

详细说明见 [使用指南](docs/user-guide.md)。

## 文档导航

| 文档 | 用途 |
|---|---|
| [需求与验收](docs/requirements.md) | 产品范围、用户故事、MVP/非目标、验收标准 |
| [交互和 UI](docs/ui-design.md) | 信息架构、使用流程、状态与异常 |
| [技术架构](docs/architecture.md) | 模块划分、数据与网络流、引用校验 |
| [使用指南](docs/user-guide.md) | 安装、操作、排障 |
| [开发规范](docs/development.md) | 工程结构、约定、测试与交付流程 |
| [测试计划](docs/testing.md) | 自动化与手动验证矩阵 |
| [验证报告](docs/verification.md) | CI 结果、未覆盖的真实浏览器与 API 测试 |
| [PDF 支持矩阵](docs/pdf-support.md) | 文件、本地权限、嵌入 PDF、动态链接及限制 |
| [科研 Prompt 库](docs/prompts.md) | 双语术语、证据规范、内置模板和评估标准 |
| [安全与隐私](docs/security.md) | API Key、权限、PDF 和提示注入风险 |
| [路线图](docs/roadmap.md) | 版本边界、待验证能力 |
| [架构决策 ADR](docs/decisions/0001-extension-byok.md) | 为何先选择 Side Panel + BYOK |
| [AI 开发交接](AGENTS.md) | 接手约束和开发前检查清单 |
| [更新日志](CHANGELOG.md) | 版本历史 |

## Commands

```bash
npm run check  # TypeScript static check
npm test       # Vitest unit tests (mocked provider; no real keys)
npm run build  # outputs Chrome unpacked extension into dist/
npm run dev    # build watch mode; reload unpacked extension after updates
```

CI（GitHub Actions）会检查 TypeScript、运行单元测试、构建并上传 `dist/` 为构建工件。**CI 不使用也不需要真实 API Key。**

## Privacy and keys

插件本地解析 PDF。用户触发分析/提问后，会将提取的论文文本发送给**用户选择的第三方模型 API**；PaperPeek 不运营自己的后端。各服务商的 API Key 分开保存：默认放在 `chrome.storage.session`，只有主动勾选“在此设备保存 Key”才写入 `chrome.storage.local`。**浏览器本地存储不等于安全保管库**；请使用有消费限额的独立密钥。不要将密钥提交到 GitHub、Issue、CI 日志或测试代码。

See [Security](docs/security.md) for threat model and disclosure procedure.

## Contributing

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[AGENTS.md](AGENTS.md) 和 [技术架构](docs/architecture.md)。本仓库没有在本版本中声明开源许可证；提交外部贡献前应先确认许可策略。
