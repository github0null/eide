# Embedded IDE

[![](https://img.shields.io/badge/home_page-em--ide.com-blue)](https://em-ide.com/)
[![](https://img.shields.io/badge/chat-discuss.em--ide.com-orange)](https://discuss.em-ide.com/)
[![](https://img.shields.io/visual-studio-marketplace/v/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide)
[![](https://img.shields.io/visual-studio-marketplace/i/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide)
[![](https://img.shields.io/visual-studio-marketplace/stars/CL.eide)](https://marketplace.visualstudio.com/items?itemName=CL.eide&ssr=false#review-details)

***

## [中文](./README_ZH-CN.md)

## Summary 📑

A mcu development environment for `8051/STM8/Cortex-M/MIPS/RISC-V` on VsCode. 

Provide `8051/STM8/Cortex-M/MIPS/RISC-V` project development, compilation, program flash and other functions.

Supported Platforms: 
  - **Windows x64 (>= Windows 10)**
  - **Linux x64**
  - **macOS**(Only tested in 'macOS 10.15 x64')

![preview](https://docs.em-ide.com/preview.png)

***

## Features 🎉

* Support 8051, STM8, Cortex-M, MIPS MTI, RISC-V, GCC projects.
* Support to import KEIL5/IAR/Eclipse projects, support to import 'IAR-STM8, IAR-ARM, Segger Embedded Studio' project source file resource tree.
* Support for installing standard KEIL chip support packs (only for Cortex-M projects).
* Provides many project templates for quick start a project.
* Build, rebuild, support many toolchains (armcc, gcc-arm-none-eabi, llvm-for-arm, riscv-gcc, xxx-gcc, keil_c51, sdcc ...).
* Program flash, support: jlink, stlink, openocd, pyocd ...
* ~~Built-in serial port monitor~~ (recommended to use `Serial Monitor` plug-in).
* Supports static checking projects by using Cppcheck.
* Automatically generates default debug configurations for debugger plug-in `cortex-debug, STM8-Debug`.
* Built-in many utility tools, 'CMSIS Config Wizard UI', 'Disassembly view', 'Program resource view'...
* Built-in implement `C/C++ IntelliSense Provider` for `ms-vscode.cpptools`, **Not Need to** configurate `c_cpp_properties.json` file.
* Built-in Msys Unix Shell environment.

***

## Quick Start 🏃‍♀️

1. Install any of the above compilers

2. Open the **Operations** bar of the extension to set the compiler installation path

3. Click on the `New` or `Import` function in the Operations bar to start your project

***

## Getting Start 📖

[https://em-ide.com](https://em-ide.com)

***

## Example

- Create A Project By Internal Template

![](https://docs.em-ide.com/img/show/new_prj.gif)

- Build Project

![](https://docs.em-ide.com/img/show/build_prj.gif)

- Flash Project (It failed because there was no connection to the development board, for demonstration purposes only)

![](https://docs.em-ide.com/img/show/flash_prj.gif)

- Show Source File Disassembly Code

![](https://docs.em-ide.com/img/show/show_disasm.gif)

- Program Resource View

![](https://docs.em-ide.com/img/show/show_prj_res.gif)

***

## ChangeLog 📌

[ChangeLog](https://marketplace.visualstudio.com/items/CL.eide/changelog)

***

## Community 🌈

- [Github](https://github.com/github0null/eide/issues)

- [Forum https://discuss.em-ide.com](https://discuss.em-ide.com/)

***

## How to build ?

You can build this project by your self.

> [!IMPORTANT]  
> The required version of NodeJS is **16** because of some historical reasons for this extension.

1. Install `NodeJS 16` (recommanded v16.20.2). You can use `nvm` to manage your NodeJS.
   Install `vsce` by `npm install -g cheerio@1.0.0-rc.9 vsce@2.15.0`

2. Clone this repo, Open folder by vscode and then run command: 

   ```shell
   npm install
   ```

3. Press `ctrl+shift+b` to show vscode task

   - Use `npm: webpack` to build this extension, and then you can press F5 to debug it.

   - Use `build vsix` to build as a vsix package.


> [!NOTE]  
> There may be syntax errors when opening project source code using VSCode, this is because the project uses an older Version of TypeScript, please press `Ctrl+Shift+P` to execute `TypeScript: Select TypeScript Version...` and select version: `v3.9.x`.

## Sponsor 👍

[Sponsor The Author](https://em-ide.com/sponsor)

Thanks:

![Sponsor List](https://em-ide.com/sponsor_list/image.png)