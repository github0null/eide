# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 8051/STM8/ARM 多工具链的集成开发环境、Keil 项目迁移工具。用于提供在 vscode 上对 8051, STM8(使用 SDCC 工具链), STM32 项目进行 开发, 编译, 烧录, 管理的功能。

**仅支持 Windows 平台**

**Keil 项目迁移主要支持 Keil 5 版本**

***

![preview](./res/preview/show.png)

***

## 功能 🎉

* 导入 Keil uVision 5 项目并完成 EIDE 项目的创建 (对 Keil uVision 5 支持较好)
* 导出 Keil 项目文件(.uvprojx, .uvproj)到工作区
* 创建、打开 EIDE 项目
* 创建、导入 项目模板
* 编译、快速编译，支持 Keil 所有工具链，以及附加的工具链
* 生成 hex，bin，elf
* 烧录到芯片
* 串口监视器
* 管理项目依赖
* 为 STM32 项目生成与调试器 `cortex-debug` 相关的 launch.json

***

## 工具链支持 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-done-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-done-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-done-brightgreen.svg)

***

## 语法支持

* 标准 C 语法高亮，代码片段
* 8051 C 语法高亮，代码片段
* 8051 汇编(A51) 语法高亮，代码片段

***

## 用法 📖

#### 这里有一个简单的 [使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)，这将帮助大家简单的了解该插件

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 每次的版本变化，[手册](https://blog.csdn.net/qq_40833810/article/details/104114921)就可能会更新，注意查看。
> #### 遇到了问题?😭 👉 途径1：[Github Issue](https://github.com/github0null/eide/issues)，途径2：QQ群: **941749328**

### [v1.12.2]
- 修复: ARMCC V5 C++ 参数问题
- 修复: 一些细节问题
***

### [v1.12.1]
- 更改: 移除不必要的功能
- 更改: 修改视图结构
- 修复: 不必要的路径检查导致的问题
- 修复: 一些细节问题
***

### [v1.12.0]
- 新增: 可生成 LIB，通过修改编译配置选择
- 新增: 自动加载多工作区项目
- 新增: 可排除目录（非递归的）
- 新增: 可生成 bat 脚本，需要在设置中开启
- 更改: 调整 SDCC 的一些参数
- 更改: 为 Keil_C51 增加了一些链接器选项
- 修复: GCC 语法检查无法找到内置的头文件的问题
- 修复: stcgal 输出问题
- 修复: 修复一些细节
***

## 注意事项 🚩
  + **不支持多目标的 Keil 项目**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导入过程: Keil 项目结构里的源文件都会被复制到 eide 项目的目录下，头文件搜索路径，宏，编译配置继承自 Keil**
