# Verso Project Agent Guidelines

## 默认重新部署规则 (Automatic Redeployment Rule)

- 在每次代码修改、修复或功能开发完成并完成本地校验（`npm run typecheck` / 测试）后，**默认自动执行重新构建并部署**：
  ```bash
  docker-compose up -d --build web worker
  ```
- 重新部署完成后，验证服务就绪状态：
  ```bash
  curl -s http://127.0.0.1:4173/api/health/ready
  ```
- 确保本地运行的 Docker 容器 (`verso_web` 与 `verso_worker`) 始终加载最新构建的代码，避免页面显示旧版本。
