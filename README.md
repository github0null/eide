# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一款适用于 8051/STM8/Cortex-M 的单片机开发环境，用于在 vscode 上提供对 8051, STM8, Cortex-M 项目进行 开发, 编译, 烧录 的功能。

**注意：**
 - **仅支持 Windows 平台**
 - **构建工具依赖于 .NET FrameWork 3.5，没有的自行安装**

![preview](./res/preview/show.png)

***

## 功能特性 🎉

* 支持 8051，STM8，Cortex-M 项目
* 提供丰富的项目模板方便快速开始项目
* 支持从标准的 CMSIS Package 安装芯片的外设库
* 一键编译、快速编译，支持多种主流的编译工具
* 一键烧录到芯片，支持多种主流的烧录器
* 内置的串口监视器
* 为调试器 Cortex-debug / STM8-debug 自动生成调试配置

***

## 工具链支持 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-✔-brightgreen.svg)

***

## 使用方法 📖

#### 这里有一个 [使用手册](https://www.em-ide.com/docs/eide-manual)

***

## 遇到了问题 ?

反馈途径: 

- [Github Issue](https://github.com/github0null/eide/issues)

- [论坛 https://discuss.em-ide.com](https://discuss.em-ide.com/)

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

### [v1.21.1]
- 新增：添加新设置，允许设置输出目录名称
- 更改：允许添加多个链接脚本
- 更改：将 EIDE.json 重命名为 eide.json
- 优化：模板视图支持嵌套显示
***

### [v1.20.4]
- 修复：打开串口监视器时出现资源已经释放的错误
- 修复：在没有打开工作区时无法编译项目
- 调整：将 "项目" 栏重命名为 "项目资源"
- 优化：在 "项目资源" 栏中支持双击文件以非预览模式打开
***

### [v1.20.3]
- 调整：创建项目的向导
- 调整：调整内置的模板
- 修复：获取模板信息时没有进度条显示
