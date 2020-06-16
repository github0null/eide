# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 8051/STM8/Cortex-M 的开发环境。用于在 vscode 上提供对 8051, STM8, Cortex-M 项目进行 开发, 编译, 烧录, 管理的功能。

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
* 导出 Keil 项目文件(.uvprojx, .uvproj) 到工作区
* 编译、快速编译，支持 Keil 所有工具链，以及附加的工具链
* 生成 hex，bin，elf
* 烧录到芯片
* 串口监视器
* 管理项目依赖
* 自动生成调试配置

***

## 使用步骤 📖

#### 1. 设置好要使用的工具链的路径

#### 2. 新建项目，然后就可以开始了

***

#### 这里有一个简单的 [使用说明](https://blog.csdn.net/qq_40833810/category_9688932.html)，可以帮助大家简单的了解该插件的特性

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 每次的版本变化，使用说明 就可能会更新，注意查看。
> #### 遇到了BUG?😭 反馈途径 [1]：[Github Issue](https://github.com/github0null/eide/issues)，[2]：QQ群: **941749328**

### [v1.14.2]
- 修复: 完善 IAR_STM8 工具链的 编译参数 和 宏扩展
- 优化: 串口监视器支持 GBK 编码
- 优化一些细节
***

### [v1.14.1]
- 更改: 排除目录时递归排除所有子目录
- 修复一些问题
- 优化一些使用细节
***

### [v1.14.0]
- 新增: 为 RAM/ROM 视图增加重置按钮
- 修复: ARM-GCC 硬件浮点选项错误
- 更改: 移除 keil 导入功能
- 更改: 根据选项值隐藏无用的视图选项
- 更改: 移除无用的 c51 语法高亮
- 优化: 进一步扩展一些关键字
- 优化: 安装 keil package 时删除不必要的文件和目录以减小项目体积
- 优化一些细节
***
