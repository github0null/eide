# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [English](./README_EN.md)

## 简述 📑

一个 8051/STM8/ARM 多工具链的集成开发环境、Keil 项目迁移工具。用于提供在 vscode 上对 8051, STM8, Cortex-M 项目进行 开发, 编译, 烧录, 管理的功能。

**仅支持 Windows 平台**

**Keil 项目迁移主要支持 Keil 5 版本，其他版本未做过测试**

***

![preview](./res/preview/show.png)

***

## 工具链支持 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-✔-brightgreen.svg)


***

## 语法扩展

* 标准 C 语法高亮，代码片段
* 8051 C 语法高亮，代码片段
* 8051 汇编(A51) 语法高亮，代码片段

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
* 自动生成调试配置

***

## 使用步骤 📖

#### 1. 设置好要使用的工具链的路径

#### 2. 新建或导入项目，然后就可以开始了

***

#### 这里有一个简单的 [使用说明](https://blog.csdn.net/qq_40833810/category_9688932.html)，可以帮助大家简单的了解该插件的特性

***

## 版本变化 🔔 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 每次的版本变化，使用说明 就可能会更新，注意查看。
> #### 遇到了BUG?😭 反馈途径 [1]：[Github Issue](https://github.com/github0null/eide/issues)，[2]：QQ群: **941749328**

### [v1.13.4]
- 新增: 为 RAM/ROM 视图增加重置按钮
- 修复: ARM-GCC 硬件浮点选项错误
- 更改: 根据选项值隐藏无用的视图选项
- 优化: 安装 keil package 时删除不必要的文件和目录以减小项目体积
- 优化一些细节
***

### [v1.13.3]
- 更改: 资源下载链接的位置
- 更改: 调整 IAR_STM8 的编译配置, 旧的配置将会失效
- 修复: 安装包中的组件时未进行筛选而导致的失败
***

### [v1.13.2]
- 更改: 调整图标
- 更改: 调整某些设置的范围
- 修复: 一些细节问题
***

## 注意事项 🚩
  + **导入功能: 不支持导入多目标的 Keil 项目**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导入过程: Keil 项目结构里的源文件都会被复制到 eide 项目的目录下，头文件搜索路径，宏，编译配置继承自 Keil**
