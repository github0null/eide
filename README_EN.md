![App Icon](./res/icon/icon.png)
# EIDE

### [跳转至中文](https://github.com/github0null/eide/blob/master/README.md)

## Summary

A **STM32**, **C51** IDE, mainly used to move Keil project to vscode, and provide the function of development, compilation, burning, debugging and management of C51, STM32 project on vscode.
**mainly supports Keil 4,5 version**
**Only for Windows platform**

**GUI support english language**

***

## Download

Search **eide** in extension market or Download vsix package at [github -> release](https://github.com/github0null/eide/releases)

***

## version changes (recent three times)

> #### for the author's test environment is limited, so if you encounter a bug, you are welcome by [github -> issue](https://github.com/github0null/eide/issues) for feedback

> #### Warnings: you should install JLink driver in your PC before use JLink tools

> #### The author is working on a [manual](https://github.com/github0null/eide-doc/blob/master/README.md) that will make it easier to use the plug-in

- ### [v1.1.3]
- new: shows compilation timestamp and compilation time
- new: incremental compilation (compiles only files that have been changed), shortcut <kbd>F9</kbd>
- new: automatically generate the debugging configuration of cortex-debug

***
- ### [v1.1.2]
- fixed: the header file could not be found when ARM compiles
- fixed: header search path does not contain root directory
- new: increases timestamp and compilation time for compilation output
- new: editor context menu: manually convert the currently open ANSI file to UTF8 (Keil's default is ANSI, which will be scrambled in vscode)
- new: editor context menu: undo last file encoding conversion
- new: plugin Settings: convert all source files to utf-8 encoding when importing Keil project, turned on by default
- new: the value of the label can be copied to facilitate other operations
- new: add release/debug mode. Switch these modes to automatically add different macros at compile time. Users can customize the list of macros in plug-in Settings

***
- ### [v1.1.1]
- fix: unable to automatically create the dependence directory
- add: link to the LIB file. You can click the 'add LIB' button or manually copy the LIB file to the source directory to complete the LIB addition

***

## Function

* Create and open EIDE project
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

