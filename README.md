![App Icon](./res/icon/icon.png)
# EIDE

### [Jump to english readme](https://github.com/github0null/eide/blob/master/README_EN.md)

## 简述

一个 Keil C51/STM32 的项目迁移工具 和 IDE, 用于提供在 vscode 上对 C51, STM32 项目进行 开发, 编译, 烧录, 调试, 管理的功能。
**主要支持 Keil 4，5 版本**  
### **仅支持 Windows 平台**

***

## 安装

在扩展商店搜索 **eide** 或者 在 [github -> release](https://github.com/github0null/eide/releases) 中下载最新版本 **vsix** 包

***

## 版本变化 (最近3次，详见 [CHANGELOG](./CHANGELOG.md))

> #### 因作者的测试环境有限, 因此如果遇到了 bug, 欢迎大家通过 [Github -> issue](https://github.com/github0null/eide/issues) 进行反馈

> #### 注意: 使用 JLink 工具前请确保电脑已安装 jlink 驱动程序

> #### 作者正在编写一个简单的 [使用手册和注意事项](https://github.com/github0null/eide-doc/blob/master/README.md)，这将帮助大家更方便的使用该插件

- ### [v1.1.4]
> 烧录注意事项：在烧录时，如果芯片已存在读保护，则首次烧录会失败，需要再尝试一次

- 修复: 烧录后无法自动复位芯片
- 新增: 项目模板，将你的项目框架导出为模板, 方便重复创建, 以提高效率
  - **说明**: 项目模板可从 磁盘/Github公开仓库 导入到工程, 仓库位置在插件中进行设置, [默认仓库位置](https://github.com/github0null/eide-doc)
- 新增: 插件设置 **Template.Repository.Url**, 用于设置远程的 Github 仓库
- 新增: 输出 .bin 文件
- 新增: 烧录读保护（注意：开启读保护后，会屏蔽自动复位选项；因为在烧录完成之后自动复位会触发读保护，导致芯片被擦除）
- 新增: 自动设置烧录文件的路径
- 新增: 插件设置`Convert Axf File To Elf File`: 在编译结束后转换输出的 .axf 为 .elf 以适应 GDB 调试器，默认关闭（这是一个实验性功能）
  - **说明**: .axf（由 Keil 生成）与 .elf（由 GCC 生成）的映像文件链接方式之间存在差异, 因此 .axf 文件在使用GDB调试时，ZI段（未初始化的全局变量、静态变量）可能未被正确置0, 将会是 -1, 开启此选项可能会改善这种情况

***

- ### [v1.1.3]
- 新增: 显示编译时间戳以及编译所用时间
- 新增: 增量编译(只编译被更改过的文件), 快捷键 <kbd>F9</kbd>
- 新增: 自动生成 cortex-debug 的调试配置

***

- ### [v1.1.2]
- 修复: ARM 编译时无法找到头文件
- 修复: 头文件搜索路径没有包含 root 目录
- 新增: 编辑器上下文菜单: 手动转换当前打开的 ANSI 格式的文件为 UTF8 格式，（Keil 的默认格式是ANSI，在 vscode 上会乱码）
- 新增: 编辑器上下文菜单: 撤销上次文件编码转换
- 新增: 插件设置: 在导入 Keil 项目时将所有源文件转换为 UTF-8 编码, 默认开启 (如果你的Keil源文件已经是无BOM的UTF-8格式的,可能会导致乱码,这时你需要关闭此选项)
- 新增: 可以复制标签的值，方便其他操作
- 新增: 加入 release/debug 模式，切换这些模式可以自动在编译时加入不同的宏, 用户可以在插件设置里自定义宏列表

***

## 功能

* 创建、打开 EIDE 项目
* 创建、导入 项目模板
* 导入 Keil uVision 5 项目并完成 EIDE 项目的创建 (对 Keil uVision 4, 5 支持较好)
* 导出 Keil 项目文件(.uvprojx, .uvproj)到工作区
* 管理项目依赖
* 编译、增量编译 项目 (**终端必须使用 Powershell**) (如果为 STM32 项目, 还会生成与调试器 stm32-debugger/cortex-debug 相关的 launch.json)
* 烧录到芯片
* `如果需要 STM32 调试功能, 可以在扩展商店搜索` [stm32-debugger](https://github.com/github0null/stm32-debugger/releases), 或者使用 **cortex-debug** 进行调试

***

## 注意事项
  + **插件的安装路径中不应该存在中文, 否则在使用 编译功能 时可能会导致失败**
  + **不支持 C51 的调试功能**
  + **导入功能: 对于过低版本的 Keil uVision 项目可能会导入失败**
  + **导出的 Keil uVision 项目文件只含有基本的 `项目结构`,`头文件依赖`和`宏定义包含`, 并不具备详细的 Keil 项目配置, 因此用 Keil 打开后需要进一步进行配置**

***

## 功能展示

#### 打开项目
![import prj](./res/preview/open_project_view.gif)

***

#### 新建项目
![import prj](./res/preview/create_project_view.gif)

***

#### 导入 Keil uVison 5 项目
![import prj](./res/preview/import_view.gif)

***

#### 导出 Keil uVison 5 XML
![export prj](./res/preview/export_view.gif)

***

#### 编译项目
![compile prj](./res/preview/compile_view.gif)

***

#### 您可以选择为 STM32 项目安装 keil ARM 包 (安装 Keil ARM 包不是必须的)
![install pack](./res/preview/install_pack.png)

***

#### 开始调试 (使用 stm32-debugger)
![debug prj](./res/preview/debug.png)
