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

### [v1.9.3]
- 新增: 显示 RAM 和 Flash 占比
- 更改: 使用树形视图显示项目文件结构
- 修复: 无效的宏导致的错误参数
- 修复: 多线程编译输出流阻塞导致的进程死锁问题
***

### [v1.9.2]
- 修复: 当编译选项的 json 配置格式错误时会被强制刷新为默认配置
- 更改: 可以一次性添加多个宏定义，宏之间用 ';' 分隔
- 新增: 一键转换 C51 关键字、寄存器定义到 SDCC 所需的格式
- 优化了一些细节
***

### [v1.9.0]
- 新增：GCC for ARM 工具链，使用前需要到`插件设置`设置好工具链安装目录
- 新增：可选择在编译时要使用的线程数
- 修复：工作区配置被强制刷新的问题
***

## 注意事项 🚩
  + **使用 ARM 烧录工具前请确保电脑已安装 JLink**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导入过程: Keil 项目结构里的源文件都会被复制到 eide 项目的目录下，头文件搜索路径，宏，编译配置继承自 Keil**
