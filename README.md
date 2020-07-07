# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 8051/STM8/Cortex-M 的开发环境。用于在 vscode 上提供对 8051, STM8, Cortex-M 项目进行 开发, 编译, 烧录 的功能。

**仅支持 Windows 平台**

![preview](./res/preview/show.png)

***

## 功能特性 🎉

* 提供丰富的项目模板方便快速开始项目
* 支持从标准的 CMSIS Package 安装芯片的外设库
* 支持多种主流的编译工具
* 一键编译、快速编译, 自动生成 hex，bin
* 一键烧录到芯片，支持主流的烧录器
* 内置的串口监视器
* 为调试器 Cortex-debug / STM8-debug 自动生成调试配置

***

## 工具链支持 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-✔-brightgreen.svg)

***

## 使用步骤 📖

#### 1. 设置好要使用的工具链的路径

#### 2. 新建项目，然后就可以开始了

***

#### 这里有一个简要的 [使用说明](https://blog.csdn.net/qq_40833810/category_9688932.html)，可以帮助大家简单的了解该插件

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 遇到了 BUG ? 反馈途径 [1]：[Github Issue](https://github.com/github0null/eide/issues)，[2]：QQ群: **941749328**

### [v1.16.0]
- 新增：pyocd 烧录，用以支持 DAP-Link，[使用方法](https://blog.csdn.net/qq_40833810/article/details/104114921#_pyocd__169)
- 更改：完善 c_cpp_properties.json 的内容
- 修复：部分 keil 包解析错误
- 优化一些使用细节
***

### [v1.15.0]
- 新增: 自动从 Github 更新全局的编译器参数配置
- 更改: 调整 ARM-GCC 默认的项目编译配置
- 更改: 简化 JLink 烧录配置，使用 JLink 命令行代替 JFlash
- 更改: 默认使用 task 发送命令，可在插件设置中更改
***

### [v1.14.4]
- 修复: C51 宏的格式不正确导致的编译错误