# EIDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

## Summary 📑

A Keil C51/STM32 **project migration tool** and **IDE** with multiple toolchains. Provide development, compilation, burning, management functions for **8051**, **stm32** projects on vscode.

**Keil 5 version is mainly supported.**

**Only for Windows platform**

***

![preview](./res/preview/show.png)

***

## Feature 🎉

* Import Keil uVision 5 project as a vscode workspace
* Export eide project as a Keil project file (.uvprojx, .uvproj)
* Create, Open eide project
* Create, Import eide project template
* Build, Fast build project; support all of Keil's toolchains, and additional toolchains
* Generate hex, bin, elf
* Download to device board
* Serialport monitor
* manage project
* Generate `cortex-debug` debug configurations for STM32 project

***

## Toolchain support 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-done-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-done-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-done-brightgreen.svg)

***

## Syntax support

* Standard C syntax highlights, code snippets
* 8051 C syntax highlights, code snippets
* 8051 assembly(A51) syntax highlights, code snippets

***

## Usage 📖

#### There is a simple [user's manual](https://github0null.github.io/eide-manual) for foreign friends

***

## Version changes 🔔

> #### Feedback 👉 [Github Issue](https://github.com/github0null/eide/issues)

### [v1.9.0]
- Add: GCC for ARM toolchain
- Add: You can choose the number of threads to use at compile time
- Fixed：problem with workspace configuration being forced to refresh
***

### [v1.8.0]
- Change: remove build-in JLink tool
- Fixed: The ARM V6 path '\' causes an uncompile problem
- Fixed: The build tool fast-mode could not open the header file
- Improved: Increase the number of threads in multiple threads
- Improved: The plug-in size is greatly reduced
***

### [v1.7.0]
- Change: C51 config move to a json config file
- Add: Add SDCC Toolchain
- Fixed: The toolchain installation location has a white space, resulting in an uncompilable problem.
- Fixed: other problem
- Improved: merge js script file. Increases plug-in loading speed
***

## Attention 🚩
  + **Make sure that JLink is installed on your computer before using the ARM burn tool**
  + **Import keil project will be failed if Keil uVision's version is tool low**
