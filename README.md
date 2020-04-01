# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 Keil C51/STM32 的项目迁移工具、多工具链的集成开发环境, 用于提供在 vscode 上对 8051, STM32 项目进行 开发, 编译, 烧录, 调试, 管理的功能。

**主要支持 Keil 5 版本**  

**仅支持 Windows 平台**

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

> #### 每次的版本变化，[手册](https://blog.csdn.net/qq_40833810/article/details/104114921)就会更新，注意查看。
> #### 遇到了问题?😭 👉 途径1：[Github Issue](https://github.com/github0null/eide/issues)，途径2：QQ群: **941749328**

### [v1.9.0]
- 新增：GCC for ARM 工具链，使用前需要到`插件设置`设置好工具链安装目录
- 新增：可选择在编译时要使用的线程数
- 修复：工作区配置被强制刷新的问题
***

### [v1.8.0]
- 更改：移除内嵌的 JLink 工具，需要自行设置 JLink 安装路径
- 修复：ARM V6 路径 `\` 导致无法编译的问题
- 修复：构建工具 Fast-Mode 无法打开头文件的问题
- 修复：一些其他问题
- 优化：提升多线程的线程数
- 优化：插件大小大大减小
***

### [v1.7.0]
- 更改：C51 配置转移到 json 配置文件
- 新增：增加 SDCC 工具链，使用细节见[手册](https://blog.csdn.net/qq_40833810/article/details/104114921)
- 新增：插件配置 SDCC Install Directory（SDCC 安装目录）
- 修复：工具链安装位置有空格导致的无法编译的问题
- 修复：一些其他问题
- 优化：合并 js 提升插件加载速度
***

## 注意事项 🚩
  + **使用 ARM 烧录工具前请确保电脑已安装 JLink**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导入过程: Keil 项目结构里的源文件都会被复制到 eide 项目的目录下，头文件搜索路径，宏，编译配置继承自 Keil**