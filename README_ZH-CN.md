# Embedded IDE

[![](https://img.shields.io/badge/主页-em--ide.com-blue)](https://em-ide.com/)
[![](https://img.shields.io/badge/论坛-discuss.em--ide.com-orange)](https://discuss.em-ide.com/)
[![](https://img.shields.io/visual-studio-marketplace/v/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide)
[![](https://img.shields.io/visual-studio-marketplace/i/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide)
[![](https://img.shields.io/visual-studio-marketplace/stars/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide&ssr=false#review-details)

***

## 简述 📑

一款适用于 8051/STM8/Cortex-M/MIPS/RISC-V 的单片机开发环境。

在 vscode 上提供 **8051**, **AVR**, **STM8**, **Cortex-M**, **MIPS MTI**, **RISC-V** ... 项目的 开发, 编译, 烧录 等功能。

支持的平台: 
  - **Windows x64 (>= Windows 10)**
  - **Linux x64**
  - **macOS**（仅在 'macOS 10.15 x64' 中测试过）

![preview](https://docs.em-ide.com/preview.png)

***

## 功能特性 🎉

* 支持开发 8051，STM8，AVR，Cortex-M，MIPS MTI, RISC-V, AnyGcc 项目。
* 支持导入 KEIL5/IAR/Eclipse 项目，支持导入 `IAR-STM8, IAR-ARM, Segger Embedded Studio` 项目源文件资源树。
* 支持安装标准的 KEIL 芯片支持包 (仅用于 Cortex-M 项目)。
* 提供丰富的项目模板方便快速开始项目。
* 一键编译，支持多种主流的编译工具 (armcc, gcc-arm-none-eabi, riscv-gcc, xxx-gcc, keil_c51, sdcc ...)。
* 一键烧录到芯片，支持多种主流的烧录器 (jlink, stlink, openocd, pyocd ...)。
* ~~内置的串口监视器，一键打开串口~~（建议使用 `Serial Monitor` 插件）。
* 支持使用 Cppcheck 对项目进行静态检查。
* 自动生成默认调试配置，为调试器插件 Cortex-debug / STM8-debug 生成默认配置。
* 内置多种实用工具，`CMSIS Config Wizard UI`, `反汇编查看`，`程序资源视图` ...
* 内置 C/C++ 插件的 `C/C++ IntelliSense Provider`，**无需配置** `c_cpp_properties.json` 即可获得源码跳转，补全提示功能。
* 内置 Msys Unix Shell 环境，方便执行 shell 命令或脚本

***

## 快速开始 🏃‍♀️

1. 安装上述的任意一款编译器

2. 打开扩展的 Operations 栏，设置编译器的安装路径

3. 点击 Operations 栏的 `新建` 或 `导入` 功能，开始你的项目

***

## 入门 📖

[https://em-ide.com](https://em-ide.com)

***

## 更新日志 📌

[ChangeLog](https://marketplace.visualstudio.com/items/CL.eide/changelog)

***

## 遇到了问题 ? 😥

反馈途径: 

- [Github Issue](https://github.com/github0null/eide/issues)

- [论坛: https://discuss.em-ide.com](https://discuss.em-ide.com/)

***

## 如何构建 ?

你可以自行构建该扩展

1. 安装 `NodeJS 16`

2. 克隆该仓库，用 VSCode 打开该项目，并执行如下命令

   ```shell
   npm install
   ```

3. 按下快捷键 `ctrl+shift+b` 打开构建命令

   - 使用 `npm: webpack` 可构建带有调试信息的扩展，稍后你可以按 F5 进行调试

   - 使用 `build vsix` 构建并打包成 VSIX

## 赞助 👍

[请作者喝咖啡](https://em-ide.com/sponsor)
