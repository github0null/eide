![App Icon](./res/icon/icon.png)
# EIDE

### [跳转至中文](https://github.com/github0null/eide/blob/master/README.md)

## Summary

A tiny IDE for develop STM32 and C51 project on vscode. It is convenient to develop and manage C51 and STM32 projects in vscode. It also supports import and export of Keil uVision 5 projects **Only for Windows platform**

**GUI support english language**

***

## Download

Search `eide` in extension market or Download vsix package at [github -> release](https://github.com/github0null/eide/releases)

***

## version changes

> #### for the author's test environment is limited, so if you encounter a bug, you are welcome by [github -> issue](https://github.com/github0null/eide/issues) for feedback

> #### Warnings: you should install JLink driver in your PC before use JLink tools

> #### The author is working on a [manual](https://github.com/github0null/eide/blob/master/manual.md) that will make it easier to use the plug-in

- ### [v1.1.1]
- fixed: unable to automatically create the dependence directory
- add: links to LIB files

***

- ### [v1.1.0]
- Fixed: rte_components.h contents removed after project open
- Change: replace the icon of the installed Component
- Change: delete useless STD dependence

***

- ### [v1.0.9]
- Fixed: C51 macro definition problem causing compilation failure

***

- ### [v1.0.8]
- Fixed: garbled code problem caused by ARM build tools
- Fixed: C51 compilation parameters too few problem
- Fixed: unable to create the dependence directory

- ### [v1.0.7]
- Change: Move the RAM and ROM layout options to a separate local Web page![ram-rom-layout](./res/preview/ram_rom_layout.gif)

- Add: Automatic generation of "RTE_Components. H" file, as well as automatic changes, can use the plug-in Settings AutoGenerateRTE_Components disabled, turned on by default
- Add: The default GNU extensions option
- Add: AutoGenerateRTE_Components plug-in Settings
- Add: useMicroLib option
- Add: Hardware floating point options (only for cortex-m4 and cortex-m7)

- Repair: The macros added to C51 did not participate in the compilation process
- Repair: Failed to install F4, F7 pack pack problem
- Repair: The problem of Keil project files being overwritten when exporting
- Repair: Problems with deleting other files while using the 'fix dependency' feature

- Other: Enhance the accuracy of dependent imports and remove unnecessary files
- Other: Automatically remove unnecessary parts of the package to reduce project size

***

- ### [v1.0.6]
- Fixed header file not copied when importing Keil project
- Increased validation of the Keil path
- Added compile-mode Settings (8051 chip to support larger RAM and ROM) and the option to remove unused functions (to reduce code size) for the C51 project

****

- ### [v1.0.5]
- Add JLink uploader, C51 is not supported
- Add shortcuts: F6 -> compile, F7 -> upload to board, ctrl+F1 -> upload eide log to remote server
- Optimized logger for uploading application logs to help improve the plug-in
- Fixed some other issues

- upload hex to stm32 board ![upload-board](./res/preview/upload-board.gif)

****

- ### [v1.0.4]
- Optimize repeat paths
- fixed Chinese path problem
- fixed some other issues

****

- ### [v1.0.3]
- due to license issues, this release removed the built-in Keil compilation tool and the installation package was greatly reduced, so if you need to use the compilation function, you need to install Keil and set the path in the software
- fixed the failure of importing keil project
- automatically convert ANSI encoded files to UTF8 files when importing, to avoid scrambled codes
- optimized the build tool and fixed some faults
- fixed some other issues

## Function

* Open EIDE project
* Create EIDE project
* Import Keil uVision 5 project and create a new EIDE project for it **( only support Keil uVison 4, 5 )**
* Export Keil project file(.uvprojx, .uvproj) to workspace
* Manage project dependence
* Compile project (if it is a STM32 project, it will generate a launch.json for `stm32-debugger` debugger)
* `If you need a STM32 debugger, you can search `[stm32-debugger](https://github.com/github0null/stm32-debugger/releases)` in extensions market (It combines with EIDE for a better experience)`

***

## Warnings
  + **Chinese words should not exist in the installation path of the plug-in, otherwise it may fail when using the compile function**
  + **Not support debug for C51 project**

***

## Function Preview

#### Open Project
![Open prj](./res/preview/open_project_view.gif)

***

#### Create a new C51 or STM32 project
![Create prj](./res/preview/create_project_view.gif)

***

#### Import Keil uVison 5 project
![import prj](./res/preview/import_view.gif)

***

#### Export Keil uVison 5 XML
![export prj](./res/preview/export_view.gif)

***

#### Compile project
![compile prj](./res/preview/compile_view.gif)

***

#### You can install Keil package for this project (You can also not install it)
![install pack](./res/preview/install_pack.png)

***

#### Start debug (use `stm32-debugger`)
![debug prj](./res/preview/debug.png)

