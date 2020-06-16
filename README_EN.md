# Embedded IDE

[![](https://vsmarketplacebadge.apphb.com/version/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/installs/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/downloads/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide) [![](https://vsmarketplacebadge.apphb.com/rating/cl.eide.svg)](https://marketplace.visualstudio.com/items?itemName=CL.eide)

## Summary 📑

A 8051/STM8/ARM development environment for VsCode. Provide development, compilation, burning functions;

**Only for Windows platform**

***

![preview](./res/preview/show.png)

***

## Feature 🎉

* Export eide project as a Keil project file (.uvprojx, .uvproj)
* Create, Open eide project
* Create, Import eide project template
* Build, Fast build project; support all of Keil's toolchains, and additional toolchains
* Generate hex, bin, elf
* Download to device board
* Serialport monitor
* Generate Cortex-debug / STM8-debug debug configurations for STM32 / STM8 project

***

## Toolchain support 🔨

#### ![8051](https://img.shields.io/badge/-8051_:-grey.svg) ![status](https://img.shields.io/badge/Keil_C51-done-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-done-brightgreen.svg)


#### ![STM8](https://img.shields.io/badge/-STM8_:-grey.svg) ![status](https://img.shields.io/badge/IAR_STM8-done-brightgreen.svg) ![status](https://img.shields.io/badge/SDCC-done-brightgreen.svg)

#### ![ARM](https://img.shields.io/badge/-ARM_:-grey.svg) ![status](https://img.shields.io/badge/ARMCC_V5-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARMCC_V6-done-brightgreen.svg) ![status](https://img.shields.io/badge/ARM_GCC-done-brightgreen.svg)

***

## Usage 📖

#### There is a simple [user's manual](https://github0null.github.io/eide-manual) for foreign friends

***

## Version changes 🔔

> #### Feedback 👉 [Github Issue](https://github.com/github0null/eide/issues)

### [v1.14.0]
- New: Add reset button for RAM/ROM view
- Fixed: Error in ARM-GCC hardware floating-point option
- Changed: Remove the keil import function
- Changed: Hide useless view options based on option values
- Changed: Remove useless C51 syntax highlighting
- Optimized: Expand some keywords further
- Optimized: Remove unnecessary files and directories when installing keil Package to reduce project size
***

### [v1.13.1]
- Changed: Adjust the compiled configuration format for arm-gcc. The old configuration format is no longer valid
- Changed: Complete the project build with relative paths
- Optimized: Display of view
- Optimized: Reduce the length of the command line
- Optimized: Remove useless functions
- Fixed: The custom jflash path has been overwrited
***

### [v1.13.0]
- New: IAR for STM8 toolchain support
- New: STM8-Debug debug configuration
- New: custom jflash file
- Fixed: can't delete include path
- Fixed: some bugs
***