# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/CL.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)      [![](https://vsmarketplacebadge.apphb.com/installs/CL.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)     [![](https://vsmarketplacebadge.apphb.com/rating/CL.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

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
* 编译、增量编译 项目 (**终端必须使用 Powershell**) (如果为 STM32 项目, 还会生成与调试器 stm32-debugger/cortex-debug 相关的 launch.json)
* 烧录到芯片
* 串口监视器
* 管理项目依赖
* 如果需要 STM32 调试功能, 可以使用 **cortex-debug** 进行调试

***

## 用法

作者编写了一个 [使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)，这将帮助大家更方便的使用该插件

***

## 版本变化 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 因作者的测试环境有限, 因此如果遇到了 bug, 大家可以通过 [Github -> issue](https://github.com/github0null/eide/issues) 进行反馈
> #### 也可以通过QQ群: **941749328** 进行反馈，提出想法和意见；欢迎大家加入，共同进步(ง •_•)ง

### [v1.2.2]
- 新增: 串口监视器，串口设置，详见[使用手册](https://blog.csdn.net/qq_40833810/category_9688932.html)

***
### [v1.2.1]
- 更改: 使用与 Keil 一致的 ROM/RAM 布局
- 修复: Keil package 的一些细节问题
- 修复: 一些编译参数的乱码问题
- 新增: 可以选择自定义的 ARM scatter 链接脚本, 在编译配置中更改

***
### [v1.2.0]
- 修复: 导入失败和模板下载问题

***

## 注意事项
  + **使用烧录工具前请确保电脑已安装 jlink 驱动程序**
  + **终端必须使用 Powershell**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导出的 Keil uVision 项目文件只含有基本的 `项目结构`,`头文件依赖`和`宏定义包含`, 并不具备详细的 Keil 项目配置, 因此用 Keil 打开后需要进一步进行配置**
