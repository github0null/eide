# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [中文](./README_ZH-CN.md)

## Summary 📑

> Supported Platform: **Windows X64 (>= Windows 10)**, **Linux x64**

A mcu development environment for `8051/AVR/STM8/Cortex-M/RISC-V/Universal-Gcc` on VsCode. 

Provide `8051/AVR/STM8/Cortex-M/RISC-V` project development, compilation, program flash and other functions.

![preview](https://docs.em-ide.com/preview.png)

***

## Features 🎉

* Support 8051, AVR, STM8, Cortex-M, RISC-V, Universal-Gcc projects.
* Support to import KEIL5/Eclipse projects, support to import 'IAR-STM8, IAR-ARM, Segger Embedded Studio' project source file resource tree.
* Support for installing standard KEIL chip support packs (only for Cortex-M projects).
* Provides many project templates for quick start a project.
* Build, rebuild, support many toolchains (armcc, gcc-arm-none-eabi, riscv-gcc, xxx-gcc, keil_c51, sdcc ...).
* Program flash, support: jlink, stlink, openocd, pyocd ...
* Built-in serial port monitor.
* Supports static checking projects by using Cppcheck.
* Automatically generates default debug configurations for debugger plug-in `cortex-debug, STM8-Debug`.
* Built-in many utility tools, 'CMSIS Config Wizard UI', 'Disassembly view', 'Program resource view'...
* Built-in implement `C/C++ IntelliSense Provider` for `ms-vscode.cpptools`, **Not Need to** configurate `c_cpp_properties.json` file.

***

## Example

- Create An Project By Internal Template

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

## Quick Start 🏃‍♀️

1. Install any of the above compilers

2. Open the **Operations** bar of the extension to set the compiler installation path

3. Click on the `New` or `Import` function in the Operations bar to start your project

***

## Document 📖

[https://docs.em-ide.com](https://docs.em-ide.com)

***

## ChangeLog 📌

[ChangeLog](https://marketplace.visualstudio.com/items/CL.eide/changelog)

***

## Community 🌈

- [Github](https://github.com/github0null/eide/issues)

- [Forum https://discuss.em-ide.com](https://discuss.em-ide.com/)
