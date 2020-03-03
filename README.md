# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)      [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)     [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

## 简述

一个 Keil C51/STM32 的项目迁移工具 和 IDE, 用于提供在 vscode 上对 C51, STM32 项目进行 开发, 编译, 烧录, 调试, 管理的功能。
**主要支持 Keil 5 版本**  
### **仅支持 Windows 平台**

***

## 安装

在扩展商店搜索 **eide** 或者 在 [github -> release](https://github.com/github0null/eide/releases) 中下载最新版本 **vsix** 包

***

## 功能

* 创建、打开 EIDE 项目
* 创建、导入 项目模板
* 导入 Keil uVision 5 项目并完成 EIDE 项目的创建 (对 Keil uVision 5 支持较好)
* 导出 Keil 项目文件(.uvprojx, .uvproj)到工作区
* 编译、增量编译 项目 (如果为 STM32 项目, 还会生成与调试器 stm32-debugger/cortex-debug 相关的 launch.json)
* 烧录到芯片
* 串口监视器
* 管理项目依赖
* 如果需要 STM32 调试功能, 可以使用 **cortex-debug** 进行调试

***

## 语法支持

* 标准 C 语法高亮，代码片段
* 8051 C 语法高亮，代码片段
* 8051 汇编(A51) 语法高亮，代码片段

***

![preview](./res/preview/show.png)

***

## 用法

作者编写了一个 [使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)，这将帮助大家更方便的使用该插件

***

## 版本变化 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 因作者的测试环境有限, 因此如果遇到了 bug, 大家可以通过 [Github -> issue](https://github.com/github0null/eide/issues) 进行反馈
> #### 也可以通过QQ群: **941749328** 进行反馈，提出想法和意见；欢迎大家加入，共同进步(ง •_•)ง

### [v1.4.0]
- 新增：导入 Keil 项目时将编译参数一并导入，导出时自动为 Keil 设置编译参数
- 新增：8051 汇编(A51) 语法高亮，代码片段
- 新增：STC 烧录器，需要 Python3 支持，并安装 [STC 烧录器: stcgal](https://github.com/grigorig/stcgal)，具体用法见[使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)
  - 安装 stcgal：命令行执行 `pip3 install stcgal --user`
- 修复：C51 优化类型选择无效的问题
- 修复：C51 编译时出现 “拒绝访问” 的问题
- 更改：导出 Keil 项目前不需要安装 Keil pack，但导出后需要在 keil 中手动设置设备型号
- 更改：美化了一下烧录输出，使输出变得更加直观
- 优化：自动选择要用的 shell，无需再设置默认终端为 PowerShell
***

### [v1.3.0]
- 更改：取消勾选默认选项：`导入时自动转换文件为 UTF-8`
- 添加：编译选项：GNU Extension 选项，默认勾选
- 修复：无法生成 .bin 文件的问题
- 修复：生成的 cortex-debug 调试配置不正确的问题
- 修复：C/C++ 混合编译的参数问题
- 修复：导入不完整的问题
***

### [v1.2.2]
- 新增: 串口监视器，串口设置，详见[使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)
***

## 注意事项
  + **使用 ARM 烧录工具前请确保电脑已安装 jlink 驱动程序**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导出的 Keil uVision 项目文件含有基本的 `项目结构`,`头文件依赖`,`宏定义包含`,和 EIDE 支持的编译参数**
