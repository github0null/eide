# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

***

## [中文](./README_ZH-CN.md)

## Summary 📑

> **!!! Note: Currently we only support Windows platform (Windows 7 SP1 and later) !!!**

An embedded development environment for `8051/STM8/Cortex-M[0/0+/3/4/7]/RISC-V` on VsCode. 

Provide `8051/STM8/Cortex-M/RISC-V` project development, compilation, burning and other functions.

![preview](https://docs.em-ide.com/preview.png)

***

## Features 🎉

* Support development of 8051, STM8, Cortex-M\[0/0+/3/4/7], RISC-V, AnyGcc projects
* Support to import KEIL projects (KEIL 5 and later only)
* Support for installing standard KEIL chip support packs (only for Cortex-M projects)
* Provides rich project templates for quick start projects
* One-click compilation, fast compilation, support a variety of mainstream compilation tools (support: armcc, gcc-arm-none-eabi, keil_c51, sdcc ...)
* One key to burn chip, support a variety of mainstream burn device (support: jlink, stlink, openocd, pyocd ...)
* Built-in serial port monitor, one click to open the serial port
* Supports static checking of projects using Cppcheck
* Automatically generates default debug configurations for debugger plug-in `cortex-debug/STM8-Debug`
* Support for writing JS scripts to import arbitrary IDE project source file resources
* Built in a variety of utilities, 'CMSIS Config Wizard UI', 'disassembly view', 'program resource view'...

***

## Example

- Create An RISC-V Project By Internal Template

![](https://docs.em-ide.com/img/show/new_prj.gif)

- Build Project

![](https://docs.em-ide.com/img/show/build_prj.gif)

- Flash Project (It failed because there was no connection to the development board, for demonstration purposes only)

![](https://docs.em-ide.com/img/show/flash_prj.gif)

- Show Source File Disassembly Code

![](https://docs.em-ide.com/img/show/show_disasm.gif)

- Static Check Project By Cppcheck

![](https://docs.em-ide.com/img/show/cppcheck_prj.gif)

- Program Resource View

![](https://docs.em-ide.com/img/show/show_prj_res.gif)

***

## Toolchain Support 🔨
 
 ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)
 
 ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-✔-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-✔-brightgreen.svg)
 
 ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCLang-✔-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-✔-brightgreen.svg)

 ![RISC-V](https://img.shields.io/badge/-RISCV_:-grey.svg) ![status](https://img.shields.io/badge/RISCV_GCC-✔-brightgreen.svg)

 ![AnyGCC](https://img.shields.io/badge/-ANYGCC_:-grey.svg) ![status](https://img.shields.io/badge/GCC_Famliy_Compiler-✔-brightgreen.svg)

***

## Quick Start 🏃‍♀️

1. Install any of the above compilers

2. Open the **Operations** bar of the extension to set the compiler installation path

3. Click on the `New` or `Import` function in the Operations bar to start your project

***

## Document 📖

[https://docs.em-ide.com](https://docs.em-ide.com)

> The English document is being translated

***

## ChangeLog 📌

[ChangeLog](https://marketplace.visualstudio.com/items/CL.eide/changelog)

***

## Community 🌈

- [Forum https://discuss.em-ide.com](https://discuss.em-ide.com/)

- [Github](https://github.com/github0null/eide/issues)
