# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

## 简述

一个 Keil C51/STM32 的项目迁移工具、多工具链的集成开发环境, 用于提供在 vscode 上对 C51, STM32 项目进行 开发, 编译, 烧录, 调试, 管理的功能。

**主要支持 Keil 5 版本**  

**仅支持 Windows 平台**

***

## 安装

在扩展商店搜索 **eide** 或者 在 [github -> release](https://github.com/github0null/eide/releases) 中下载最新版本 **vsix** 包

***

## 功能

* 导入 Keil uVision 5 项目并完成 EIDE 项目的创建 (对 Keil uVision 5 支持较好)
* 导出 Keil 项目文件(.uvprojx, .uvproj)到工作区
* 创建、打开 EIDE 项目
* 创建、导入 项目模板
* 编译、快速编译，支持 Keil 所有工具链，以及附加的工具链
* 生成 hex，bin，elf
* 烧录到芯片
* 串口监视器
* 管理项目依赖
* 为 STM32 项目生成与调试器 `stm32-debugger`/`cortex-debug` 相关的 launch.json

***

## 工具链支持
#### 8051： ![status](https://img.shields.io/badge/Keil_C51-done-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-done-brightgreen.svg)

#### ARM：![status](https://img.shields.io/badge/ARMCC_V5-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-developing-orange.svg)

***

## 语法支持

* 标准 C 语法高亮，代码片段
* 8051 C 语法高亮，代码片段
* 8051 汇编(A51) 语法高亮，代码片段

***

![preview](./res/preview/show.png)

***

## 用法

#### 作者编写了一个 [使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)，这将帮助大家更方便的使用该插件

***

## 版本变化 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 每次的版本变化，[手册](https://blog.csdn.net/qq_40833810/article/details/104114921)就会更新，注意查看。
> #### 问题反馈、添加功能，途径1：[Github Issue](https://github.com/github0null/eide/issues)，途径2：QQ群: **941749328**

### [v1.7.0]
- 更改：C51 配置转移到 json 配置文件
- 新增：增加 SDCC 工具链，使用细节见[手册](https://blog.csdn.net/qq_40833810/article/details/104114921)
- 新增：插件配置 SDCC Install Directory（SDCC 安装目录）
- 修复：工具链安装位置有空格导致的无法编译的问题
- 修复：一些其他问题
- 优化：合并 js 提升插件加载速度
***

### [v1.6.0]
- 新增：加入多线程编译模式，默认开启，当编译的文件数大于 16 时有效；
- 更改：串口调试器`双向模式`的输出转移到虚拟文档, 详见[手册->串口调试器](https://blog.csdn.net/qq_40833810/article/details/104114921)
- 优化：提升快速编译的效率
- 修复：日志记录器引发的崩溃问题
- 修复：同名源文件生成的 obj 冲突的问题
- 修复：无法识别 .asm 后缀的汇编源文件的问题
- 修复：修复了一些其他问题
***

### [v1.5.0]
- 新增：对 ARM V6 工具链的支持，支持所有的编译选项，详见[手册->编译配置->ARM](https://blog.csdn.net/qq_40833810/article/details/104114921)
- 更改：ARM 的编译选项转移到 json 配置文件中，因此对于旧的项目要重新设置编译选项
- 修复：修复了一些其他问题
***

## 注意事项
  + **使用 ARM 烧录工具前请确保电脑已安装 jlink 驱动程序**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
