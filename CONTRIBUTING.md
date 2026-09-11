# Contributing to voice-novel

首先感谢你想为本项目做出贡献！请先阅读以下内容。

Thanks for wanting to contribute to voice-novel! Please read on.

---

## 报告 Bug / Report a Bug

使用 [GitHub Issues](https://github.com/HoweBai/voice-novel/issues) 报告问题。请提供：

Report issues via [GitHub Issues](https://github.com/HoweBai/voice-novel/issues). Please include:

- **复现步骤** / Steps to reproduce
- **期望行为** / Expected behavior
- **实际行为** / Actual behavior
- **环境信息** / Environment info（OS、Node 版本、TTS 引擎）

---

## 提交 Pull Request / Submit a Pull Request

### 流程 / Process

1. Fork 本仓库并创建特性分支：`git checkout -b feat/your-feature`
2. 确保代码遵循项目规范（见下方）
3. 提交变更并推送：`git push origin feat/your-feature`
4. 打开 Pull Request 并填写描述

### 代码规范 / Code Style

- **前端**：遵循 [airbnb JavaScript Style](https://github.com/airbnb/javascript) 与 [React 规则](https://reactjs.org/docs/hooks-rules.html)
- **后端**：TypeScript 严格模式，统一使用 ESLint + Prettier
- **提交信息**：遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范

  ```
  feat: add ChatTTS engine support
  fix: resolve audio duration estimation bug
  docs: update README with Chinese instructions
  chore: bump dependencies
  ```

- **语言**：README / 注释请使用**中文为主、英文为辅**的双语风格

### 测试 / Testing

- 本地运行 `npm run dev` 后手动验证核心流程
- 如有新增逻辑，建议补充单元测试

---

## 需要帮助？/ Need Help?

- 阅读 [README.md](README.md) 了解项目背景
- 在 [GitHub Discussions](https://github.com/HoweBai/voice-novel/discussions) 中提问
- 联系维护者：howebai@example.com

---

*感谢每一位为这个项目付出时间的贡献者！/ Thank you to every contributor who spends time on this project!*
