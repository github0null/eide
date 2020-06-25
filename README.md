# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 8051/STM8/Cortex-M 的开发环境。用于在 vscode 上提供对 8051, STM8, Cortex-M 项目进行 开发, 编译, 烧录 的功能。

**仅支持 Windows 平台**

***

![preview](./res/preview/show.png)

***

## 工具链支持 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-✔-brightgreen.svg)

***

## 功能 🎉

* 创建、打开 EIDE 项目
* 创建、导入 项目模板
* 编译、快速编译, 生成 hex，bin
* 烧录到芯片
* 串口监视器
* 自动生成 Cortex-debug / STM8-debug 调试配置

***

## 使用步骤 📖

#### 1. 设置好要使用的工具链的路径

#### 2. 新建项目，然后就可以开始了

***

#### 这里有一个简要的 [使用说明](https://blog.csdn.net/qq_40833810/category_9688932.html)，可以帮助大家简单的了解该插件

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 每次的版本变化，使用说明 就可能会更新，注意查看。
> #### 遇到了 BUG ? 反馈途径 [1]：[Github Issue](https://github.com/github0null/eide/issues)，[2]：QQ群: **941749328**

### [v1.15.0]
- 新增: 自动从 Github 更新全局的编译器参数配置
- 更改: 调整 ARM-GCC 默认的项目编译配置
***

### [v1.14.4]
- 修复: C51 宏的格式不正确导致的编译错误
***

### [v1.14.3]
- 更改: 调整 STVP 的烧录参数
- 更改: 增加一些内置的项目模板，可在新建项目时选择
- 更改: 将 ARM_GCC 默认的 FABI 值由 hard 改为 softfp
***

### [v1.14.2]
- 修复: 完善 IAR_STM8 工具链的 编译参数 和 宏扩展
- 优化: 串口监视器支持 GBK 编码
- 优化一些细节
***
