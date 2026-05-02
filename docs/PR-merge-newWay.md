# Pull Request: 合并 newWay 分支到 master

## 概述

本次 PR 对 Keil 工程导入、项目路径解析、输出文件命名等多个方面进行了重要修复和重构。核心目标是解决 Keil 导入项目中源文件找不到、编译选项缺失、输出文件名错误等问题，同时对项目根目录与配置文件的路径进行了解耦。

## 分支信息

- **源分支**: `newWay`
- **目标分支**: `master`
- **提交数**: 7 个提交
- **变更文件**: 7 个文件

## 变更文件清单

| 状态    | 文件                           | 说明                                                 |
| ------- | ------------------------------ | ---------------------------------------------------- |
| 📝 修改 | `src/KeilXmlParser.ts`       | 核心修改：源文件路径解析、GroupOption 支持、API 扩展 |
| 📝 修改 | `src/EIDEProjectExplorer.ts` | 导入流程：存储 keilPrjDir、组选项导入、调试配置修复  |
| 📝 修改 | `src/EIDEProject.ts`         | LoadConfigurations 重构、输出文件名修复              |
| 📝 修改 | `src/EIDETypeDefine.ts`      | 类型定义扩展：keilPrjDir、groupOption                |
| 📝 修改 | `src/CodeBuilder.ts`         | 构建器输出文件名使用目标名                           |
| 📝 修改 | `src/HexUploader.ts`         | 统一使用 getExecutablePathWithoutSuffix()            |
| 📝 修改 | `package.json`               | 版本号 3.26.6 → 3.26.8                              |
| 📝 修改 | `package-lock.json`          | 版本号同步更新 |                                      |

---

## 详细变更说明

### 1. 🔧 Keil 导入 — 源文件路径解析修复

**涉及文件**: `src/KeilXmlParser.ts`

**问题**: XML 中的相对路径（如 `..\src\main.c`）经历了 `ToAbsolutePath` 转绝对路径 → `ToRelativePath` 转回相对路径的冗余来回转换。

**修复**: 直接存储原始 XML 路径（相对于 `keilPrjFile.dir`），消除不必要的转换。

```typescript
// 修改前
file: new File(this.ToAbsolutePath(fPath))

// 修改后
file: new File(fPath)
```

### 2. 🔧 Keil 导入 — 组编译选项修复

**涉及文件**: `src/EIDEProjectExplorer.ts`、`src/KeilXmlParser.ts`、`src/EIDETypeDefine.ts`

**问题**: `files.options.yml` 未正确导入组的 `GroupOption/GroupArmAds` 构建参数（IncludePath、Define、MiscControls 等）。

**修复**:

- `FileGroup` 接口新增 `groupOption?: any` 字段
- 解析器在 `ParseData()` 中存储 `group.GroupOption`
- 导入时新增 `setupGroupOpts()` 函数处理组选项
- 增加原始 XML 文档回退路径（`getRawGroupOpts`），当 x2js 解析的 `groupOption` 不可用时通过 `getRawDoc()` 直接读取原始文档
- `FixGroupName` 改为静态方法 `FixGroupNameStatic`，供外部调用

### 3. 🔧 项目根目录与配置文件路径解耦

**涉及文件**: `src/EIDEProject.ts`、`src/EIDETypeDefine.ts`

**问题**: Keil 导入项目的根目录指向用户选择的工作区文件夹，而非 Keil 工程目录，导致路径解析错误。

**修复**:

- `ProjectMiscInfo` 接口新增 `keilPrjDir?: string` 字段
- 导入时存储 Keil 工程目录到 `miscInfo.keilPrjDir`
- `LoadConfigurations` 重构：先加载配置，再根据 `keilPrjDir` 决定 `rootDir`
- `.eide/` 配置文件和 `.code-workspace` 仍在用户选择文件夹下
- 项目根目录用于路径解析时指向 Keil 工程目录

### 4. 🔧 输出文件名修复

**涉及文件**: `src/EIDEProject.ts`、`src/CodeBuilder.ts`

**问题**: `${OutDir}`、`${ExecutableName}` 及生成的 `.axf` 文件使用了项目名而非当前选中的 target 名。

**修复**:

- `getExecutablePathWithoutSuffix()` 使用 `getCurrentTarget()` 替代 `getProjectName()`
- 构建器 `BuilderParams.name` 字段使用 `this.project.getCurrentTarget()`

### 5. 🔧 HexUploader 输出路径统一

**涉及文件**: `src/HexUploader.ts`

**问题**: `HexUploader` 使用 `this.project.getOutputDir() + this.project.getProjectName()` 构建默认 hex/elf 路径。

**修复**: 统一使用 `this.project.getExecutablePathWithoutSuffix()`。

### 6. 🔧 调试配置生成修复

**涉及文件**: `src/EIDEProjectExplorer.ts`

**问题**: `getExecutablePathWithoutSuffix()` 被当作独立函数调用（缺少 `prj.` 前缀）。

**修复**: 改为 `prj.getExecutablePathWithoutSuffix()`。

### 7. 🔧 LoadConfigurations 崩溃修复

**涉及文件**: `src/EIDEProject.ts`

**问题**: `ToAbsolutePath()` 内部使用尚未设置的 `rootDir`，导致 `Cannot read properties of undefined (reading 'path')` 错误。

**修复**: 直接使用 `NodePath.resolve(wsDir.path, keilPrjDir)` 而非 `this.ToAbsolutePath()`。

---

## 涉及的核心流程

```
用户选择 .uvprojx → 导入 Keil 工程
    │
    ├─ KeilParser 解析 XML
    │   ├─ 源文件路径 ← 直接存储原始 XML 路径（不再绝对转换）
    │   ├─ GroupOption  ← 新增存储到 FileGroup.groupOption
    │   └─ 编译选项
    │
    ├─ ImportKeilProject
    │   ├─ 创建 .eide/ + .code-workspace          ← 在用户选择文件夹下
    │   ├─ 存储 keilPrjDir 到 miscInfo             ← 新增
    │   ├─ setupGroupOpts() 处理组选项             ← 新增
    │   │   ├─ 优先从解析结果获取
    │   │   └─ 回退：从原始 XML 文档直接读取
    │   └─ 保存配置
    │
    └─ 打开项目 → LoadConfigurations
        ├─ eideDir = wsDir/.eide/                 ← 用户文件夹
        ├─ 加载配置
        ├─ rootDir = keilPrjDir                    ← Keil 工程目录（新增）
        └─ 注册内置变量
            ├─ OutDir          = rootDir/build/Debug
            ├─ ExecutableName  = OutDir/Debug      ← 使用 target 名
            └─ ProjectRoot     = rootDir
```

## 回归测试建议

1. **普通项目创建 & 构建**: 验证普通项目不受影响
2. **Keil 项目导入 & 构建**: 验证源文件路径正确、编译正常
3. **多 Target 项目**: 切换 target 验证输出文件名正确
4. **组选项导入**: 验证 `files.options.yml` 包含正确的组级编译选项
5. **侧边栏散列文件**: 点击 scatter 文件路径能正确打开
6. **烧录功能**: 默认 hex/elf 路径正确
