# Change Log

所有值得注意的版本变化将被记录在这个文件中。

All notable version changes will be recorded in this file.

***

### [v3.26.1] revision

**Fix**:
  - `Project Toolchain`: Revert commit 'support generic gcc for arm or riscv projects.'
  - `Project Migration`: Fix user context data not migrated. [issues 479](https://github.com/github0null/eide/issues/479)

***

### [v3.26.0] update

**Change**:
  - `Project File`: Use yaml instead of json and update project data schema. Rename `eide.json` to `eide.yml`.

**Fix**:
  - `Target Switch`: Fix file's options was overrided when switch to other target.

**Improve**:
  - `Project Templates`: Add local cache for fetching remote templates repository.

**Notice:** This version contains important changes. After the automatic migration is completed, you will no longer be able to open your project using the old version of the plugin.

***

### [v3.25.7] revision

**Improve**:
  - `Builder Options`: Support ARM/Thumb Mode select options. Fix [issues 475](https://github.com/github0null/eide/issues/475)

***

### [v3.25.6] revision

**Fix**:
  - `Flasher`: fix flasher crashed when enumSerialPort failed.
  - `Setup Toolchain`: fix performace issue for OnSetToolchainPath(). update toolchain descriptions.
  - `sdcc+binutils Toolchain`: fix "fatal error: cannot execute 'cc1'" for Win32 platform.
  - `Misc`: Compatibility improvement for [vscode task issue 260534](https://github.com/microsoft/vscode/issues/260534)

***

### [v3.25.3] revision

**Improve**:
  - `Debug`: Support 'attach' mode for 'one-click' debugging.

***

### [v3.25.2] revision

**Improve**:
  - `Debug`: Support one-click to start debugging for `probe-rs` flasher. Require extension [probe-rs.probe-rs-debugger](https://marketplace.visualstudio.com/items?itemName=probe-rs.probe-rs-debugger)

***

### [v3.25.1] revision

**Improve**:
  - `Import Project`: Improve project parser when import an eclipse project.
  - `Debug`: One-click to start debugging. NOT NEED ANY `launch.json`. [See Here](https://em-ide.com/docs/advance/debug_project)
  - `Toolchain Options`: New option `use-newlib-nano`, `not-use-syscalls` for `arm-none-eabi-gcc` toolchain.

***

### [v3.25.0] update

**New**:
  - `Flasher`: Support new flasher [probe-rs](https://probe.rs/docs/overview/about-probe-rs/). Used for 'ARM', 'RISCV' chips.

***

### [v3.24.2] update

**New**:
  - `8051 Toolchain`: Support new SDCC + Binutils Toolchain for mcs51 https://github.com/github0null/sdcc-binutils-mcs51/blob/master/README_zh.md

**Fix**:
  - `ELF View`: Fix issue [461](https://github.com/github0null/eide/issues/461)

***

### [v3.23.14] revision

**New**:
  - `Project Templates Explorer`: New online project templates web site: https://templates.em-ide.com 

**Fix**:
  - `Task Execution Broken`: Fix build task not work on latest vscode.
  - `Symbol Table`: Fix `ENOBUF` when dump symbol table from a big file.

**Improve**:
  - `Project Templates`: Update internal project templates.
  - `C/C++`: Update builtin lint headers.
  - `Other`: Miscellaneous things.

***

### [v3.23.13] revision

**Improve**:
  - `Create Project`: Miscellaneous things. (init project files, init project settings ... etc.)

***

### [v3.23.12] revision

**Improve**:
  - `GNU Arm Toolchain`: Support new mcpu: `cortex-m52, cortex-m55, cortex-m85`.
  - `unify_builder`: Optimize builder speed.

  - `File Options`: Add memory assignment feature for `AC5`, `AC6` toolchain. Thanks the contributor [Deadline039](https://github.com/Deadline039)
  - `File Options GUI`: Update the translation text. Optimize layout.
  - `DebugConfig Generator GUI`: Change gui element width. Sort the option result list.
  - `AC5/AC6 Assembler`: Support use `<key>=<val>` preprocessor format for AC5/AC6 armasm.
  - `Makefile Generator`: Improve makefile generator.
  - `Builder Options`: Add more options for `arm-gcc` and `any-gcc` toolchain.

**Fix**:
  - `IAR ARM Toolchain`: Miss auto-gen `-I` params for iar assembler.
  - `Keil Project Import`: Force use ';' as the path delimiter on unix and windows.
  - `Eclipse Project Import`: Incorrect project type was detected.

**Change**:
  - `EIDE View Container`: By default, we will collapse the `Operations` view.
  - `Webpanel Views`: Starting from this version, we will use singleton pattern for `Builder Options View`, `Storage Layout View`, `Cmsis Header Config Wizard`, This means that for each view, only one page can be opened for each project.

***

### [v3.23.6] revision

**Fix**:
  - `Map View`: Fix in some cases, 'map.view' item's diff size is incorrect (LLVM_ARM Toolchain).

**Improve**:
  - `Map View`: Add a Graph button to switch dynamic chart. Improve COSMIC_STM8 'map.view' feature.
  - `LLVM Arm Toolchain`: Add '-Oz' option.
  - `Builder Options`: Better option description text. Change web view elements layout.
  - `Toolchain Download`: Update remote package `arm-none-eabi-gcc` to v14.3.

***

### [v3.23.2] revision

**Improve**:
  - `LLVM Arm Toolchain`: Support `map view`, `symbol tables` features for LLVM Arm Toolchain.
  - `Switch Target`: Improve using status-bar to switch target.
  - `Builder Options`: Improve description text for some options.
  - `Plug-in Settings`: New option: `EIDE.Option.EnableClangdConfigGenerator` to control auto generate '.clangd' file.

**Change**:
  - `unify_builder`: Update to v3.10.1

***

### [v3.23.1] update

**New**:
  - `Arm Project`: Support new toolchain [LLVM-embedded-toolchain-for-Arm](https://github.com/ARM-software/LLVM-embedded-toolchain-for-Arm).

**Improve**:
  - `Arm Project`: Improve `CPU Extension Options` feature.
  - `GCC Toolchain`: More c/c++ options in builder options GUI. like: '-Oz', '-flto', '-fno-rtti' ...
  - `Intellisence`: Improve intellisence config provider.
  - `JLink`: Update jlink to v8.50, fix jlink exe name error on linux.

**Change**:
  - `unify_builder`: Update to v3.10.0

***

### [v3.22.0] update

> NOTE: Update the version of file `eide.json` to `v3.6`

**New**:
  - `Toolchain`: Add `Armv8-M.Main, Armv8.1-M.Main` architectures support for `AC6 (armclang)` and `arm-none-eabi-gcc`.

**Fix**:
  - `Keil Project Import`: Miss match RTE source files when import mdk arm projects. Fix mdk C macro importer.

**Change**:
  - `Exclude List`: Show all exclude list for every targets. (command: `_cl.eide.project.source.modify.exclude_list`)
  - `CMSIS Core Headers`: Built-in cmsis header zip files in plug-in.

***

### [v3.21.5] revision

**Fix**:
  - `unify_builder`: Unresolved variables in compiler command line.
  - `Keil Project Import`: Incorrect option mapping when import keil project.

***

### [v3.21.4] revision

**Fix**:
  - `unify_builder`: `pre-build` task was running unexpectedly.
  - `Project View`: Some command callbacks passed wrong params.
  - `CMSIS Pack`: Package info was not be cleaned after uninstalled package.

***

### [v3.21.3] revision

**Fix**:
  - `Eclipse Importer`: Eclipse project parser crashed on some empty node.

**Optimize**:
  - `Export Makefile`: Use relative linker script path when export makefile. Generate `builder.params` to system tmp dir when export makefile.

***

### [v3.21.2] revision

**New**:
  - `File Option`: New option `Always In Build`. This will make the source file always be builded regardless of whether it changes or not.
  - `Linker Option`: New option `Don't Output Specific Binary Files`. You can exclude some specific binary type when output binary files.

**Fix**:
  - `SDCC model`: Debug option missed on linker.

**Optimize**:
  - `CMSIS Library`: Update built-in cmsis dsp lib/headers.
  - `Keil Project Import`: Parse file options when import keil arm project.
  - `Create Project`: Use projectName when create .code-workspace file.
  - `unify_builder`: Update unify_builder to v3.9.4

***

### [v3.21.1] revision

**New**:
  - `Map View`: Support show `map.view` file for SDCC and KEIL_C51 toolchain.
  - `Scatter File Highlight`: Support a simple arm scatter file (`.sct`) language support.

**Fix**:
  - `Program Matcher`: Sometimes armcc problem matcher missed matchs.
  - `CMSIS Config Wizard`: Missed skip value for `<e>` tag.

***

### [v3.21.0] update

**New**:
  - `Xpack Toolchain`: Add xpack-dev-tools `package.json` support.
  - `Right-click Menu`: Add `Compile` button for source file.
  - `Project Resource`: Add new inline button: `Add File`.
  - `Builder Configuration`: Add `open` button for `linker script` path config.

**Optimize**:
  - `CMSIS Config Wizard`: Minor refactoring to improve parser. Support `<n>` `<s.i>` tags. Support error prompt.
  - `Open Project`: Add progress bar when opening a project.
  - `Create Project`: Improve create project. Fill default project name when creating a new project.
  - `Import Project`: Improve Keil project import. Support import RTE source files.
  - `Built-in Project Templates`: Update stm8s/sdcc project templates.
  - `COSMIC-STM8`: Improve COSMIC-STM8 project. Support cosmic-stm8 '.lkf' file grammar highlight.
  - `unify_builder`: Update unify_builder to **v3.9.1**. Improve increment compile. Improve makefile generator.
  - `Source Compile Options`: Improve GUI. Add a textarea to show current compile commands.
  - `Build Project`: Support silent mode. Add spinning animation for 'build' and 'flash' status bar.
  - `Compile Database Generator`: Auto generate `compile_commands.json`.

**Changes**:
  - `Custom Task`: Rename task type `eide.msys` to `eide.bash`.
  - `Project Build`: Remove project variables which starts with `EIDE_TOOL_`.

***

### [v3.20.1] revision

**Optimize**:
  - `Internal Templates`: Update internal project templates.
  - `unify_builder`: Optimize makefile generator.
  - `Project Resource`: Add batch operation support on files or folders. Thanks [Deadline039](https://github.com/Deadline039) !
  - `CMSIS Config Wizard`: Add a search input box. Now you can search config.
  - `CMSIS Config Wizard`: Add non-number options support. Thanks [Deadline039](https://github.com/Deadline039) !

**Fix**:
  - `Chip Package`: Fix package parser bug.

***

### [v3.20.0] update

**New**:
  - `Export GNU Makefile`: Support export GNU Makefile for help users customize the automatic build process.

**Change**:
  - `unify_builder`: Update unify_builder to v3.8.0

**Fix**:
  - `OpenOCD`: Can't get interface/target list for xpack openocd v12.

***

### [v3.19.9] revision

**New**:
  - `Plug-in Settings`: New plug-in settings: `Win32.Msys.Enable`, to determine whether to enable the built-in MSYS tools.
  - `Project Variables`: Export `EIDE_xxx` variables into project variables.

**Change**:
  - ~~`Other`: Append msys path to the tail of system PATH, not head.~~

***

### [v3.19.8] update

**Fix**:
  - `Chip Package`: Storage layout default value missed.
  - `Unify Builder`: Fix ac6 linker options missed on macos. Thanks [@Deadline039](https://github.com/Deadline039).

**Optimize**:
  - `Unify Builder`: Use 'dotnet unify_builder.dll' instead of 'unify_builder.exe' on arm64 platform.
  - `C/C++ Config Provider`: Use g++ when provide compilerPath for cpptools.
  - `Other`: Append msys path to the tail of system PATH, not head.

***

### [v3.19.6] update

**Change**:
  - `Builder Options`: Combine all builder options (`*.options.json`) into `eide.json`.
  - `Files Options`: Combine all file's options (`*.files.options.yml`) into single file: `files.options.yml`.

**Optimize**:
  - `Project TreeView`: Expand Project TreeView's root node when you open a project.
  - `Keil Project Import`: Do not disable internal hex file output if keil project not have any actived User Commands.
  - `Source Code`: Update dependence packages to resolve package vulnerabilities.
  - `Chip Package Manager`: Optimize code.

Update build environment to NodeJS `v16`.

***

### [v3.18.2] revision

**Fix**:
  - `unify_builder`: Fix makefile dependence parser bugs. Update unify_builder to `v3.7.4`

***

### [v3.18.1] revision

**Fix**:
  - `Project Resources`: When user unfold an unsorted vritual sources folder, the 'eide.json' will be changed by mistake.

***

### [v3.18.0] update

**Incompatible Changes**:
  - `Chip Support Package`: 
    - Remove folder: `.eide/deps` and use VirtualFolder `<virtual_root>/<deps>` instead it.
    - The Chip Support Package in older projects will become invalid. And you need to reinstall chip-package and reinstall all CMSIS components.

**New**:
  - `Cortex-Debug Configuration Generator`: A new Debugger Configuration Generator with a simple GUI.
  - `pyOCD Flasher UI`: Support append additional cli command when program flash.
  - `VSCODE_PORTABLE`: Support `VSCODE_PORTABLE` environment variables.

**Fix**:
  - `Project Environment`: Project environment variables missed.

**Change**:
  - `Builder Configuration UI (SDCC)`: Automatic get processors list by execute command: `sdcc -v`

**Optimize**
  - `MDK Project Import`: Optimize import `Keil User Command`.

***

### [v3.17.3] preview

**New**:
  - `Cortex-Debug Configuration Generator`: A new Debugger Configuration Generator with a simple GUI.
  - `pyOCD Flasher UI`: Support append additional cli command when program flash.
  - `VSCODE_PORTABLE`: Support `VSCODE_PORTABLE` environment variables.

**Fix**:
  - `Project Environment`: Project environment variables missed.

**Change**:
  - `Builder Configuration UI (SDCC)`: Automatic get processors list by execute command: `sdcc -v`

**Optimize**
  - `MDK Project Import`: Optimize import `Keil User Command`.

***

### [v3.17.1] revision

**Fix**:
  - `Permission Error`: Fix Permission Denied when execute unify_builder on Unix-like system. 

**Optimize**
  - `Armcc Memory Print`: Optimize ARMCC map memory information print.

***

### [v3.17.0] update

**New**:
  - `unify_builder`: Print 'Section Memory Usage' for AC5 / AC6 Compiler.
  - `Global Environment Variables`: A new plug-in settings: 'EIDE.Builder.EnvironmentVariables' for preset some global `Environment Variables`.

**Change**:
  - `unify_builder`: Bundle unify_builder executable files in plug-in package.

Merge `v3.16.2-prerelease` bugs fix.

***

### [v3.16.1] update

**Fix**:
  - `Open Project`: fix cannot open project if a error target in usr.ctx.json.
  - `Project Floatpoint Selection`: fix function hasFpu() not match 'm33.dsp'.
  - `Diagnostic Bugs`: fix diagnostic information generator bugs.
  - `Others`: fix other miscellaneous bugs.

**Optimize**:
  - `.NET Runtime`: compatible with version > 6.0 of the .NET runtime.
  - `Static Check`: optimize cppcheck params generator.

***

### [v3.16.0] update

**Change**:
  - `Cortex-Debug Config`: Auto generate debug config now has been **Removed**. Use the right-click menu function instead. 

**Fix**:
  - `Keil Project Export`: Source file type error for '*.asm'.

**Optimize**:
  - `GUI Prompt String`: Change some prompt string.
  - `JLink Flasher Template`: Allow use '${hexFile}, ${binFile}...' variables in `jlink.flasher.cmd.template` file.
  - `STLink Flasher`: Use codepage `437` when exec STM32_Program_CLI.exe in win32 system.

***

### [v3.15.1] update

**Optimize**:
  - `GCC Compiler Driver`: Auto select gcc/g++ for c/c++ source files; Support new linker option `Linker Driver`.
  - `MDK Project Import`: Support import keil project's User Commands (BeforeMake and AfterMake commands).
  - `RightClick Menu`: Optimize menu item order.

***

### [v3.15.0] update

**New**:
  - `RightClick Menu`: Add groups for menu

**Optimize**:
  - `COSMIC STM8`: Auto select crts*.stm8 library 

***

### [v3.14.20240116] revision

**New**:
  - `Clangd Support`: Auto generate `.clangd` config for your project. (Only for gcc/clang compiler !)
  - `Library Generator Support`: Add libs generator, support archive your obj files after build done.

**Optimize**:
  - `OpenOCD Flasher`: Allow select 'None' config.

***

### [v3.14.0] update

**New**:
  - `Status Bar`: Add status bar 'Build' and 'Flash'

**Change**:
  - `Proxy Site`: Discard domain: github0null.io
  - `unify_builder`: Move obj files to '.obj' dir when build

**Optimize**:
  - `Model files`: Remove model file's UTF8-BOM header
  - `Project auto reload`: Optimize auto save/reload project when you modified 'eide.json'

***

### [v3.13.2023060401] revision

**Fix**:
  - `Incorrect GCC Options`: Move gcc '--specs=xxx' options to 'global' region. [issue](https://github.com/github0null/eide/issues/259)

**Optimize**:
  - `Source Exclude List`: Allow use Env Variables in exclude path string.
  - `Eclipse Project Importer`: Optimize eclipse project parser, allow resolve virtual folder and folder link.
  - `Armcc Options`: Remove duplicate option 'optimize-for-time' for AC5

***

### [v3.13.2023060101] revision

**Optimize**:
  - `Source Exclude List`: Allow use Env Variables in exclude path string.
  - `Eclipse Project Importer`: Optimize eclipse project parser, allow resolve virtual folder and folder link.

***

### [v3.13.0] update

**New**:
  - `MIPS Project`: Support new project type `MIPS` and new toolchain `MTI GCC`, thanks [@eatradish](https://github.com/eatradish).
  - `Status Bar`: Add status bar for project target switch.
  - `STM8 MapView`: Support MapView for COSMIC-STM8 Compiler.

**Fix**:
  - `Switch Target`: Not copy source options file if it's not existed when switch target.
  - `Cpptools Intellisense`: Notify cpptools update source config after active project changed.

**Change**:
  - `IAR Arm Toolchain`: Remove auto-gen '-I' include options for iar arm assembler.

**Optimize**:
  - `COSMIC_STM8`: Auto generate `.d` files for COSMIC_STM8.
  - `KeilC51 Importer`: Setup 'CClasses, UserClasses' when import a keilc51 project.
  - `System Variables`: Add some system variables, like: `${SYS_Platform}, ${SYS_DirSep} ...`
  - `Auto Save`: Compare content before save project.
  - `Source Folder`: Need to confirm before remove src folder.
  - `IAR Toolchain`: Add more cpu list for selection.

***

### [v3.12.2023052101] revision

**New**:
  - `MIPS Project`: Support new project type `MIPS` and new toolchain `MTI GCC`, thanks [@eatradish](https://github.com/eatradish).
  - `Status Bar`: Add status bar for project target switch.

**Fix**:
  - `Switch Target`: Not copy source options file if it's not existed when switch target.
  - `Cpptools Intellisense`: Notify cpptools update source config after active project changed.

**Change**:
  - `IAR Arm Toolchain`: Remove auto-gen '-I' include options for iar arm assembler.

**Optimize**:
  - `COSMIC_STM8`: Auto generate `.d` files for COSMIC_STM8.
  - `KeilC51 Importer`: Setup 'CClasses, UserClasses' when import a keilc51 project.
  - `System Variables`: Add some system variables, like: `${SYS_Platform}, ${SYS_DirSep} ...`
  - `Auto Save`: Compare content before save project.
  - `Source Folder`: Need to confirm before remove src folder.
  - `IAR Toolchain`: Add more cpu list for selection.

***

### [v3.12.0] update

**New**:
  - `COSMIC STM8`: Support new toolchain: `COSMIC STM8` for stm8 series.

**Fix**:
  - `Export Template`: Zip project template 7za failed on linux.

**Optimize**:
  - `unify_builder`: Show commandline when build failed on source file.
  - `Disassembly View`: Optimize disasm launguage syntax with visual jump

***

### [v3.11.3] revision

**Fix**:
  - `Extra Compiler Options`: Cannot evaluate inherited parameters.
  - `unify_builder`: Cannot handle more than one `args expressions` for file options.
  - `unify_builder`: Remove global extra options for `sdxxasm`.

**Optimize**:
  - `unify_builder`: More color render for compiler output messages.
  - `unify_builder`: Add 'ASM_FLAGS' for sdcc sdxxasm.
  - `Debug Config`: Auto generate toolchain prefix for cortex-debug.

**Please update `eide_binaries` to v11.0.1+ (Restart plug-in to auto fetch update).**

***

### [v3.11.2] update

**New**:
  - `Disassembly View`: Add 'Visualize Jumps' for disassembly code, [more informations](https://interrupt.memfault.com/blog/gnu-binutils#new-feature-visualize-jumps)
  - `Language Mode`: Add a setting `EIDE.DisplayLanguage` to choose a language for UI, prompts.

**Fix**:
  - `Memory Layout View`: Error format when user input an integer number.

**Optimize**:
  - `Utility Tools`: Use `start` command to install win32 driver.
  - `Promblem Matcher`: Match compiler errors in linker logs.

***

### [v3.11.1] update

**New**:
  - `Object Order For Linker`: Allow specify an order for any obj files before the builder start to link your program.
    
    ![](https://em-ide.com/public-assets/img/v3.11.x/obj_order_preview.png)

  - `Extra Compiler Args`: Use Webview UI to replace config file. More Convenience !
    
    ![](https://em-ide.com/public-assets/img/v3.11.x/source_extra_args_preview.png)

  - `Toolchain Configurations`: Add webview UI to configure `toolchain path` or `toolchain prefix` for current project.
    
    ![](https://em-ide.com/public-assets/img/v3.11.x/toolchain_cfg_preview.png)
  
**Change**:
  - `Remove Built-in Serial-Monitor`: We removed built-in serial monitor for eide. Please use [ms-vscode.vscode-serial-monitor](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-serial-monitor) now !
  - `Extra Compiler Args For Source Files`: For `virtualPathFiles`, pattern must start with: `<virtual_root>/`

***

### [v3.10.11] revision

**Fix**:
  - `Terminal Environment Variables`: Environment variable values are incorrectly linked together !

***

### [v3.10.10] revision

**New**:
  - `Project Explorer`: Lock opened project.
  - `Environment Variables View`: Allow show all available variables.

**Fix**:
  - `Symbol View`: Not found elf path when use IAR ARM toolchain.

**Optimize**:
  - `Environment Variables`: Allow use 'K, M, G' in 'MCU_RAM_SIZE', 'MCU_ROM_SIZE' variables.
  - `CMSIS Config Wizard`: Use workspace encoding for cmsis config wizard.
  - `Github Proxy`: Optimize proxy, enable proxy for 'GMT+8:00' timezone by default.

***

### [v3.10.9] update

**New**:
  - `Project Resource`: Add `Symbol Table` virtual file in `Output Files`, click it to show `elf symbols` (support 'armcc', 'gcc', 'iar').
  - `Builder Options` : Add `X/O Base`, `R/O Base`, `R/W Base` options for armcc, and allow import them from keil project.

**Optimize**:
  - `launch.json Generator`: Don't force override 'svdPath' in launch.json config.
  - `Project Resource`: Show promt when remove a filesystem source dir.

***

### [v3.10.7] revision

**Fix**:
  - `Project Resource`: Can't auto add source files when folder changed.

**New**:
  - `Project Resource`: Allow drag and drop files and folders in UI (**Only for virtual source items**): 
    
    ![](https://em-ide.com/public-assets/img/eide_drag_and_drop.gif)

**Change**:
  - `Minimum Version Requirement Of VSCode`: Change `v1.63.0` to `v1.67.0`

***

### [v3.10.6] revision

**Fix**:
  - `cpptools configuration provider not work`: Fix provider file filter bug.

**Optimize**:
  - `Resource Explorer`: Keep `non-existed` filesystem source folders. Optimize folder watcher
  - `Settings Scope`: Allow user override more eide settings by `workspace settings`.
  - `FileWatcher`: Auto close file watcher if watcher has an error.
  - `Prompt messages`: Optimize some UI hint messages.

***

### [v3.10.5] revision

**Fix**:
  - `Symbol Link`: Not work for symbol link source folder.

**Optimize**:
  - `High Cpu Load`: Optimize code, reduce `find in system path` operations

***

### [v3.10.4] revision

**Fix**:
  - `Task type: 'eide.msys'`: The `env` property does not work.

**Change**:
  - `Task type: 'eide.msys'`: Use `label` property for task title, not `name`

***

### [v3.10.3] revision

**New**:
  - `New task type: 'eide.msys'`: You can write user task in `tasks.json` file, and execute `unix shell` command in `windows` platform.
  - `Github Template`: Allow Create Project From Github Repository. 

**Optimize**:
  - `High Cpu Load`: Don't check and search toolchain path when plug-in startup, cache search result.
  - `Riscv Builder Options UI`: Add auto-complete for `arch`, `abi`, `code-model` options.
  - `Cmsis Core Libraries`: Filter unused `*.lib` when unzip cmsis core libraries.
  - `Openocd v0.12.0-rc2`: Update Openocd to `v0.12.0-rc2`, repo: `https://github.com/github0null/eide_builtin_openocd`

***

### [v3.10.1] preview

**New**:
  - `Shell Flasher`: Allow install shell flasher scripts from remote repo.
  - `Configure Toolchain`: Add a button to setup tool prefix for gcc family compiler.

**Fix**:
  - `Eclipse Importer`: Can not parse 'link.location' in '.project' file.

**Optimize**:
  - `Configure Toolchain`: Don't check all toolchain status when plug-in launch.
  - `Resource Manager`: Don't remove non-existed source dirs in eide.json.

***

### [v3.10.0]

**New**:
  - macOS support (Only have tested in 'macOS 10.15 x64').
  - Notify user to reload project when project file has been changed.
  - Use markdown string for tooltips.

**Fix**:
  - Error program file addr priority for `.bin` file.
  - Error welcome string for project view.

**Optimize**:
  - MDK Importer: auto import keil project options.
  - Builder Options UI: auto scroll variables table.
  - Built-in task format warning in vscode `OUTPUT` panel.
  - Enable install utility tools functions for non-win32 platform.
  - New linker options: `Disable memory print for old gcc`.
  - Allow close workspace project.
  - Optimize project attr yaml config hint.
  - Add path completion provider for project yaml config (use char '\' trigger completion).
  - Project auto save period: 3 min.

***

### [v3.9.2022102302] preview

**New**:
  - macOS support (Only have tested in 'macOS 10.15 x64')

**Optimize**:
  - Built-in task format warning in vscode `OUTPUT` panel.
  - Enable install utility tools functions for non-win32 platform.

***

### [v3.9.2022101601] preview

**New**:
  - Notify user to reload project when project file has been changed.

**Fix**:
  - Error program file addr priority for `.bin` file

**Optimize**:
  - New linker options: `Disable memory print for old gcc`
  - Allow close workspace project
  - Optimize project attr yaml config hint
  - Add path completion provider for project yaml config
  - Project auto save period: 3 min

***

### [v3.9.2022100701] preview

**New**:
  - Use markdown string for tooltips.

**Optimize**:
  - Error welcome string for project view.

***

### [v3.9.1] revision (v3.9.2022092001 preview)

**Fix**:
  - Env was overrided when import a 'multi-project' iar workspace
  - Sdcc problem matcher doesn't work
  - Error path convert: '${VAR}/../path/dir' -> 'path/dir' when use `NodeJs.normalize()`, use `File.normalize` replace `NodeJs.normalize()`
  - Source file is not compiled when their reference were updated (unify_builder)

**Change**:
  - Remove Makefile template file generate

**Optimize**:
  - Export built-in env variables to unify_builder
  - Export more env variables to builder process environment
  - Resolve recursive vars when parse iar eww file
  - When import a iar project, create new folder if iar project not have independent folder
  - Reload jlink device list after install a cmsis device package
  - Add '${OutDirRoot}' var
  - Auto convert '\' to '/' when use `bash` command in builder task for win32
  - Update built-in msys version to `v1.0.18`

***

### [v3.9.0]

**New**:
  - Support IAR ARM C/C++ Compiler
  - Support import IAR ARM workbench
  - Support install chip info for JLink when installed cmsis device package (you need to install `jlink-devices-addon` before getting start)
  - New compiler problem matcher
  - Allow nested env variables (max deep: 5)
  - Generate `compiler.log` file to build folder
  - Provide diagnostic informations into `Problems` panel from `compiler.log` file after project build finished
  - Allow execute post install command when install external tools.
  - Allow empty `linkerScript` file path for `armcc/gcc`. (empty path will cause builder ignore pass linkerScript args to linker)
  - Allow use env variables in `includePath`, `libPath`

**Fix**:
  - Can not post progress message when install external tools
  - Some compiler config errors in `sdcc` model

**Change**:
  - Remove terminal problem matcher, use `vscode.Diagnostic` api to provide project problem after build end
  - Provide more terminal link matcher for eide builder task

**Optimize**:
  - Add `${configName}` in file path env map
  - Search keywords in external tools details
  - Del old folder when reinstall external tools
  - Optimize prompt message for `Configure Toolchain` function.
  - Optimize cmsis header wizard parser. (allow string prefix/suffix for number value)

***

### [v3.8.2022090801] preview version

**New**:
  - Generate `compiler.log` file to build folder
  - Provide diagnostic informations into `Problems` panel from `compiler.log` file after project build finished

**Change**:
  - Remove terminal problem matcher, use `vscode.Diagnostic` api to provide project problem after build end
  - Provide more terminal link matcher for eide builder task

***

### [v3.8.2022090701] preview version

**New**:
  - New IAR compiler problem message matcher
  - Support auto install chip info to JLink by `jlink-device-addon` tool when install cmsis device package

**Optimize**:
  - Allow use `${configName}` in file path environment variables
  - Do not delete unused files when cmsis device package has been installed
  - Output compiler log after build done

***

### [v3.8.2022082801] preview version

**New**
  - Allow execute post install command when install external tools.

**Optimize**
  - Optimize prompt message for `Configure Toolchain` function.
  - Allow empty `linkerScript` file path for `armcc/gcc`. (empty path will cause builder ignore pass linkerScript args to linker)
  - Allow use env variables in `includePath`, `libPath`.
  - Optimize cmsis header wizard parser. (allow string prefix/suffix for number value)

***

### [v3.8.8] revision (patch for v3.8.4)

**New**:
  - Add `Exclude/Include Child Sources` context menu for source folder
  - Brand new documentation, product landing page, here: https://em-ide.com

**Change**:
  - Adjust `eide.json` structure
  - Generate a `.eide.usr.ctx.json` file to save user context data (can be ignored in `.gitignore`)

**Optimize**:
  - Format project name when import project from other IDE
  - Optimize source code structure

***

### [v3.8.3] revision

**Change**:
  - 调整 armgcc 构建配置中的 `linkerScriptPath` 值修改方式，由 文件选择器 更改为 字符串输入框
  - 调整某些文件的显示图标
  - 更新内置模板

***

### [v3.8.2] revision

**New**:
  - 支持通过 [external_tools_index](https://github.com/github0null/eide_default_external_tools_index) 安装更多的外部工具，并在插件激活后自动将这些工具的路径附加到VSCode当前的环境变量中

**Change**:
  - 将 log 输出至 `<user-home>/.eide/cl.eide.log`，不再将 `.eide/log` 目录作为 log 存放位置

***

### [v3.8.0]

**New**:
  - 新增 Eclipse 项目导入功能
  - 新增 `Setup Utility Tools` 功能 (位于 Operation 栏)，可用于自动安装 eide 默认提供的相关工具
  - 为 Arm 项目提供更多的 cpu 选项
  - 支持为 'Custom Flasher' 设置全片擦除命令
  - 新增终端类型：`Eide Terminal`, 插件已将 内置工具，编译器等二进制程序路径 导出至该终端的环境变量
  - 增加两个设置项，用于决定是否自动搜索和添加 `IncludePath` 及 `.obj .a` 至项目（默认值为 false）
    ```
    EIDE.SourceTree.AutoSearchIncludePath
    EIDE.SourceTree.AutoSearchObjFile
    ```
  - 增加以下新的 `builder task` 变量:
    ```
    ${ConfigName}:        项目 Configuration 名称，例如：'Debug', 'Release'
    ${CompilerId}:        编译器 id, 例如：'gcc', 'sdcc', 'ac5'
    ${CompilerName}       编译器短名称，例如：'GNU Tools for Arm Embedded Processors 8-2019-q3-update'
    ${CompilerFullName}   编译器完整名，例如：'arm-none-eabi-gcc.exe (GNU Tools for Arm Embedded Processors 8-2019-q3-update) 8.3.1 20190703 ...'
    ${CompilerVersion}    编译器版本号，例如：'8.3.1'

    ${re:ProjectRoot}     项目根目录相对路径，该值固定为：'.'
    ${re:BuilderFolder}   构建工具目录相对路径
    ${re:OutDir}          输出目录相对路径，如：'build/Debug'
    ${re:ToolchainRoot}   编译器根目录相对路径
    ${re:CompilerFolder}  编译器可执行文件目录相对路径
    ```
  - 支持在安装 jlink 等烧录软件时，自动安装驱动
  - 新增内置命令行工具 `verchk`, 用于比较版本字符串，可在 `builder task 中使用`
  - 增加 SDCC 模块拆分优化（将源文件尽可能按一个函数一个文件进行拆分，使 SDCC 能够优化程序大小），可在 `构建配置->全局` 中打开，默认关闭
  - 增加 `compile_commands.json` 输出
  - 重构 `Memory Layout` 视图，更好地融入 VsCode 风格
  - 为新项目自动添加 `.clang-format` 文件
  - 增加 Save Project 右键菜单项

**Fix**:
  - 修复 STVP 无法擦除芯片的问题
  - 错误的路径转换 '.' -> './'，导致编译器无法识别包含路径
  - 通过修改 exc-cfg.yaml 文件无法排除根目录（需要重启才能正常），以及排除文件夹后，文件图标状态未刷新的问题
  - 修复从 cmsis package 解析芯片默认 Memory Layout 时出现错误
  - 修复 STVP 命令行中的多余参数导致的烧录失败

**Change**:
  - 调整 TreeView 中的一些图标
  - 生成 Cortex-Debug 调试配置时，只生成必要字段
  - 调整烧录器配置默认值
  - 移除内置的 `Output Panel` Grammar 文件，推荐使用扩展：`IBM.output-colorizer`
  - 在芯片支持包中切换芯片后，不再覆盖 `memory layout` 配置
  - 支持直接设置 Keil `UV4.exe` 路径来定位编译器路径
  - 自动搜索源文件夹时，跳过以 '.' 开头的文件夹
  - 项目自动保存时间间隔改为 100 s
  - 自动搜索源文件时，排除以 `.` 开头的文件夹
  - 移除添加源文件夹时，不能添加根目录之外的文件夹的限制
  - 更改输出目录时，不删除旧的
  - 支持为 Any-gcc 选择 linker 类型，可选项：`gcc, ld`，用于支持较老版本的 gcc
  - 新建空项目时，不再自动生成默认 `main.c` 文件
  - 项目中所有的配置文件名都加上 `target name` 前缀（在旧的版本中，仅 `release` target 无前缀）
  - 新建构建配置时，armclang 默认汇编器改为 arm-auto
  - armcc 问题匹配器正则表达式调整：https://github.com/github0null/eide/blob/4f91c5bc43ff699f0f2f569a573d1a49be4e8d3a/package.json#L1511

**Optimize**:
  - 根据 stvp 烧录配置的芯片名，从 stvp database 中获取 `ram, flash` 大小，用于在编译时显示 `ram/flash` 占比
  - 增加如下可在文件路径中使用的变量：
    ```
    ${workspaceFolder}
    ${workspaceFolderBasename}
    ${OutDirBase}
    ```
  - 加载项目时，去除 `Project Attribute` 中的空值项
  - 支持在插件设置的 路径设置项 中使用相对路径（相对路径基于当前工作区）
  - 优化 builder options Web view 页面相关控件宽度
  - 未找到 .NET 运行时进行下载前，先检查上一次下载的安装包是否有效
  - 优化项目保存逻辑

***

### [v3.7.2022072601] preview version

**New**:
  - 为 armclang 新增 'armv8m' cpu 类型

**Fix**:
  - 修复 STVP 无法擦除芯片的问题

**Optimize**:
  - 根据 stvp 烧录配置的芯片名，从 stvp database 中获取 `ram, flash` 大小，用于在编译时显示 `ram/flash` 占比
  - 增加如下可在文件路径中使用的变量：
    ```
    ${workspaceFolder}
    ${workspaceFolderBasename}
    ${OutDirBase}
    ```

***

### [v3.7.2022072103] preview version

**New**:
  - 支持为 'Custom Flasher' 设置全片擦除命令

**Change**:
  - 调整 TreeView 中的一些图标
  - 生成 Cortex-Debug 调试配置时，只生成必要字段
  - 调整烧录器配置默认值
  - 移除内置的 `Output Panel` Grammar 文件，推荐使用扩展：`IBM.output-colorizer`
  - 在芯片支持包中切换芯片后，不再覆盖 `memory layout` 配置
  - 支持直接设置 Keil `UV4.exe` 路径来定位编译器路径
  - 自动搜索源文件夹时，跳过以 '.' 开头的文件夹
  - 项目自动保存时间间隔改为 100 s

**Optimize**
  - 加载项目时，去除 `Project Attribute` 中的空值项

***

### [v3.7.2022071801] preview version

**New**:
  - 新增 Eclipse 项目导入功能
  - 新增 `Setup Utility Tools` 功能 (位于 Operation 栏)，可用于自动安装 eide 默认提供的相关工具

***

### [v3.7.2022071301] preview version

**New**:
  - 新增终端类型：`Eide Terminal`, 插件已将 内置工具，编译器等二进制程序路径 导出至该终端的环境变量
  - 增加两个设置项，用于决定是否自动搜索和添加 `include path` 及 `.obj .a` 至项目（对于新建项目，默认值为 false）：
    ```
    EIDE.SourceTree.AutoSearchIncludePath
    EIDE.SourceTree.AutoSearchObjFile
    ```
  - 增加以下新的 `builder task` 变量:
    ```
    ${ConfigName}:        项目 Configuration 名称，例如：'Debug', 'Release'
    ${CompilerId}:        编译器 id, 例如：'gcc', 'sdcc', 'ac5'
    ${CompilerName}       编译器短名称，例如：'GNU Tools for Arm Embedded Processors 8-2019-q3-update'
    ${CompilerFullName}   编译器完整名，例如：'arm-none-eabi-gcc.exe (GNU Tools for Arm Embedded Processors 8-2019-q3-update) 8.3.1 20190703 ...'
    ${CompilerVersion}    编译器版本号，例如：'8.3.1'

    ${re:ProjectRoot}     项目根目录相对路径，该值固定为：'.'
    ${re:BuilderFolder}   构建工具目录相对路径
    ${re:OutDir}          输出目录相对路径，如：'build/Debug'
    ${re:ToolchainRoot}   编译器根目录相对路径
    ${re:CompilerFolder}  编译器可执行文件目录相对路径
    ```
  - 支持在安装 jlink 等烧录软件时，自动安装驱动
  - 新增内置命令行工具 `verchk`, 用于比较版本字符串，可在 `builder task 中使用`

**Fix**
  - 错误的路径转换 '.' -> './'，导致编译器无法识别包含路径
  - 通过修改 exc-cfg.yaml 文件无法排除根目录（需要重启才能正常），以及排除文件夹后，文件图标状态未刷新的问题

**Change**:
  - 自动搜索源文件时，排除以 `.` 开头的文件夹
  - 移除添加源文件夹时，不能添加根目录之外的文件夹的限制
  - 更改输出目录时，不删除旧的
  - 支持为 Any-gcc 选择 linker 类型，可选项：`gcc, ld`，用于支持较老版本的 gcc
  - 新建空项目时，不再自动生成默认 `main.c` 文件
  - 项目中所有的配置文件名都加上 `target name` 前缀（在旧的版本中，仅 `release` target 无前缀）

**Optimize**:
  - 支持在插件设置的 路径设置项 中使用相对路径（相对路径基于当前工作区）
  - 优化 builder options Web view 页面相关控件宽度

***

### [v3.7.2022063001] preview version

**New**:
  - 增加 SDCC 模块拆分优化（将源文件尽可能按一个函数一个文件进行拆分，使 SDCC 能够优化程序大小），可在 `构建配置->全局` 中打开，默认关闭
  - 增加 `compile_commands.json` 输出

***

### [v3.7.2022062501] preview version

**New**:
  - 重构 `Memory Layout` 视图，更好地融入 VsCode 风格
  - 为新项目自动添加 `.clang-format` 文件

**Fix**:
  - 修复从 cmsis package 解析芯片默认 Memory Layout 时出现错误
  - 修复 STVP 命令行中的多余参数导致的烧录失败

**Change**:
  - 新建构建配置时，armclang 默认汇编器改为 arm-auto
  - 自动保存时间间隔改为 `30s`

***

### [v3.7.2022061501] preview version

**New**:
  - 增加 Save Project 右键菜单项

**Change**:
  - armcc 问题匹配器正则表达式调整：https://github.com/github0null/eide/blob/4f91c5bc43ff699f0f2f569a573d1a49be4e8d3a/package.json#L1511
  - 自动保存项目改为 3min 间隔

**Optimize**:
  - 未找到 .NET 运行时进行下载前，先检查上一次下载的安装包是否有效
  - 优化项目保存逻辑

***

### [v3.7.2]

**New**:
  - 增加右键菜单项：只生成 `builder.params`, 不触发编译
  - 为新建项目增加默认工作区设置：`"C_Cpp.errorSquiggles": "Disabled"`
  - 支持 iar-stm8 编译错误匹配（由于无法匹配多行，因此暂时不能匹配问题的描述）：
    ```
    "c:\Users\xxxx\xxxxx\xxxxxx\xxxx.c",55  Error[Pe020]:
          identifier "xxxx" is undefined
          xxxxxx
    ```
  - 对于离线 vsix 安装包，支持直接安装内置的 .NET6 运行时（仅windows）

**Change**:
  - 使用 2 空格缩进 'eide.json'，便于 `git diff`
  - 使用 `dotnet --list-runtimes` 检查运行时
  - 未找到 .NET6 运行时时，自动安装默认版本 `.NET6.0.5 runtime`，不再给出提示让用户确认（仅windows）

**Optimize**:
  - 将 `Build, Rebuild ...` 等命令加入到右键菜单项中
  - 将 `Erase Chip` 命令加入到右键菜单项中，并增加快捷键：`ctrl+alt+e`
  - 在安装 cmsis 组件时，自动检查 deps 组件根目录是否已加入项目
  - 删除多余的设置项：
    ```
    EIDE.Option.ShowOutputFilesInExplorer
    EIDE.Option.ShowSourceReferences
    EIDE.Option.PrintRelativePathWhenBuild
    EIDE.Builder.GenerateMakefileParameters
    ```

***

### [v3.7.1]

**Fixed**:
  - Can not update source refs after build done.

**Optimized**:
  - Add `Erase All` right-click menu in `Flasher Configurations` view.
  - Auto add a default `.gitignore` file for new project.
  - remove `runToMain: true` for cortex-debug debug config, use: `runToEntryPoint: "main"` now.
  - Optimize drop-down field prompt for `Builder Options View`.

***

### [v3.7.0]

**Change**:
  - Use [.NET6](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) runtime, not `Mono`.
  - No longer support `X86 (32Bit)` platform.

**Optimize**:
  - Remove some discarded extension settings.
  - Optimize multi-thread build speed.

***

### [v3.6.4]

**Fixed**:
  - Can not throw exception when extension can not get an available binaries version.
  - Can not switch to rebuild mode after user changed global builder options.

**Changed**:
  - Allow mult-thread build for `Keil_C51` project.

***

### [v3.6.3]

**Fixed**:
  - When there are too many nested folders, the response is slow when excluding directories.
  - Can not auto fetch eide-binaries update.

**Changed**:
  - Merge unify_builder's commandline args to a single params file.

**Optimized**:
  - Support pass source extra compiler args to cpptools.

***

### [v3.5.4]

**Fixed**:
  - Duplicated include path items: `.eide/deps` in project.
  - Can not parse old version `JLinkDevices.xml`.
  - Enum serialport failed when use `65001` code-page in windows os.

**Optimized**:
  - Optimize cpptools config provider for `gcc` family compilers.

***

### [v3.5.1]

**Optimized**:
  - Allow use project env vars(like: `${OutDir}, ${ProjectName} ...`) in shell flasher commandline.
  - Auto check program files for stvp flasher.
  - Optimize external tool executable path parser.
  - Optimize some message prompt.

***

### [v3.5.0]

**Fixed**:
  - Source ref parser encoding bug for iar_stm8 compiler.

**Optimized**:
  - Replace `arch` command by `uname -m` for `arch-linux`.
  - Auto search executable path in system env when default tool path is invalid.
  - Use monospaced font for `*.mapView`.
  - Disable online tool installer for `linux` platform.

**Changed**:
  - Remove `extensionDependencies` and built-in auto active extensionDependencies.
  - Force use unix path for virtual source path to compat old project.
  - Adjust default `project templates repo`, now it's: https://github.com/github0null/eide-templates

***

### [v3.4.0]

**Optimized**:
  - Optimize openocd flash command-line.
  - Allow show disasm for `elf`/`axf`.

**Fixed**:
  - Cannot provide C/C++ intellisense configuration for files that contain symbol links for `linux` platform.
  - The `exclude source list` in the old project template is invalid for `linux` platform.
  - Can't parse toolchain system includes and defines for `linux` platform.

***

### [v3.2.0]

**New**:
  - Allow use project env vars in compiler params and user macro.
  - Allow use project env vars in shell flasher command-line.

**Optimize**:
  - Support auto-select armasm/armclang compiler for arm/gnu asm source files.
  - Optimize cppcheck config for linux platform.

***

### [v3.1.0]

**New**:
  - Support linux platform (ubuntu).
  - Add internal `AVR` project template.

**Changed**:
  - Move eide-binaries folder location to user's home folder.
  - Remove external-tools default config value for plug-in settings.
  - Remove 'c_cpp_properties.json' for eide projects.

***

### [v3.0.202203xxxx] (preview edition) (v3.1.0-RC)

**New**:
  - Support linux platform (ubuntu)

**Fixed**:
  - Fix incompatible commandline format when use vscode task.

**Changed**:
  - Move eide-binaries folder location to user's home folder.
  - Remove 'c_cpp_properties.json' for eide projects.

***

### [v2.16.8] (revision)

**Optimize**:
  - Add `disableOutputTask` options for linker.
  - Optimize pyOcd target name parser.
  - Adjust default builder thread number.

**Changed**:
  - Adjust extension activation events

***

### [v2.16.7] (revision)

**Bug Fixes**:
  - Can't register `customConfigProvider` for c/c++ plug-in `v1.18.x`

***

### [v2.16.6] (revision)

**Bug Fixes**:
  - When switch target, the `Flasher Configurations` -> `programFile` become empty.
  - The `Project Resource` view cannot be refreshed due to a file opening failure in the `Output Files` view.
  - When using `any-gcc` toolchain, can't open builder options for 'release' target.

**Optimized**:
  - Automatically refresh `Output Files` view` after using the cleanup function.
  - Add some utility compiler options for gcc toolchain.
  - Generate `tasks.json` and `settings.json` for new project.

***

### [v2.16.5] (revision)

**New Features**:
  - Support modify the source file exclude list directly by temporary yaml config file.
  - Support new VSCode terminal type: `Eide Msys Bash`.
  - Support vscode `problem matcher` and `terminal links provider` for `Keil_C51` toolchain.

**Bug Fixes**:
  - The cppTools configuration is not refresh after the project loaded.
  - Some workspace config in `*.code-workspace` file are override after project load.

**Changes**:
  - The `axf2elf` function now is `disabled` by default and must be manually `enabled`.

**Optimized**:
  - Use `-l` show disassambly source line for gcc.
  - Optimize linker output color render:
    - match ```Fatal error: Lxxxx:``` for armcc
    - match ```undefined reference to `xxx'``` for gcc
    - match ```multiple definition of `xxx'``` for gcc
    - match ```section `xxx' will not fit in region `xxx'``` for gcc
    - match ```region `xxx' overflowed by xxx bytes``` for gcc
  - Support `${portList}` variable for shell flasher.
  - Export some executable file's directories to system environment.
  - Add default `vscode task` for new project.
  - Reduce unnecessary pop-ups.

***

### [v2.16.4] (revision)

**New Features**:
  - Built-in MSYS environment. For `builder user task` and `shell flash command` is very useful.
  - Support auto run `pre-install.sh / post-install.sh` when install a project from template. (please place `*-install.sh` in the `.eide` folder)
  - Auto check project template hash before install it. 
  - Support automatically read and load PyOCD chip list.

**Bug Fixes**:
  - Using prefix matches when excluding folders causes other folders to be excluded
  - When there is a case difference between variables in the shell flash command line, the replacement of variables cannot be completed.
  - When switch project target, some flash config not update.
  - When switch project target, `programFilePath` become `null`.

**Optimized**:
  - Allow display any files in file system folder for project explorer.
  - Support the use of environment variables and Bash scripts in the command line of custom shell flash mode
  - Don't delete duplicated user include path in source folder include paths.
  - Pass more compilerArgs for cpptools (for `armclang`, `gcc family` compilers)
  - Support independent c/c++ options for armclang
  - Limit cpptools config provider update interval (>150ms)

***

### [v2.16.2] (revision)

**Bug Fixes**:
  - Some plug-in settings `TAG` missing.
  - Can't use `Show Disassembly` for `any-gcc` and `riscv_gcc`

**Optimized**:
  - Add default `make hex` and `make bin` task for `any-gcc` project
  - Auto pass `any-gcc` global compiler options to cpptools compiler args

***

### [v2.16.0]

**New Features**:
  - Support `any-gcc` project and `any-gcc` toolchain. Used to support any gcc family compilers.
  - Support auto update eide-binaries
  - Support `BigEndian` options for `armcc/armclang`
  - Support access to **private** template repo that need to provide `Github Personal Access Token` in plug-in Settings 

**Bug Fixes**:
  - Failed to jump definition. Not provide browsePath for the workspace causes the C/C ++ **Go To Definition** functionality is fail to jump to source files in the workspace

**Optimized**:
  - Allow user add custom forceIncludeFile for c/c++ intellisense. Go to eide plug-in settings to set it.
  - Align inline input box for `builder options ui`.

***

### [v2.15.3] (revision)

**New Features**:
  - Support `SC000`, `SC300` chips for armcc/armclang

**Bug Fixes**:
  - **Source files** under project resources **root** are ignored.
  - A warning appears when creating a project using a workspace template.

**Changes**:
  - English README are preferred.
  - Use CustomConfigurationProvider provide Intellisence information for `C/C++`, no longer use `c_cpp_properties. Json`.
  - Use unify `env.ini` file for each target in a project. Instead of creating a separate '\<taregt\>.env.ini' file for each target. (**so the old env configuration will be invalid**)
  - In the `env.ini` file, the `"workspace.order"` variable will be **invalid**, please use the `"EIDE_BUILD_ORDER"` variable instead. [docs](https://docs.em-ide.com/#/zh-cn/multi_prj_workspace?id=%e6%9e%84%e5%bb%ba%e4%bc%98%e5%85%88%e7%ba%a7)

**Optimized**:
  - Better build output rendering for `keil_c51, iar_stm8` toolchain
  - Provide more complete brows Info to C/C++ plug-in.
  - Output a more detailed log to "unify_builder.log".
  - In dark theme, some 'file' icon has low contrast.
  - When using the Exclude file function, use filters to ignore files with invalid file suffixes.

***

### [v2.15.2] (revision)
- **修复：v2.15.1 更新增加了源文件路径变量支持，导致打开项目时加载速度过慢的问题**
- 优化：当开启 VT100 终端颜色失败时，自动禁用编译输出的关键字高亮（可通过向 Builder.AdditionalCommandLine 设置添加 `-force-color` 强制开启高亮）
***

### [v2.15.1] (revision)
- 新增：支持在**源文件路径**，**烧录选项->程序文件** 中使用**变量**（不区分大小写）. 暂支持以下变量：
  - `$(OutDir)`：         输出目录
  - `$(ProjectName)`：    项目名
  - `$(ExecutableName)`： 输出的可执行文件路径，不含后缀
  - `$(ProjectRoot)`：    项目根目录
  - `项目设置->环境变量` 中的变量（变量名必须只包含字母，数字或下划线）
- 修复：状态栏 **打开串口命令失效**
- 修复：sdcc 错误输出高亮匹配失效
- 优化：使用编辑器右键菜单打开反汇编时，自动根据源文件的当前被选中的 `行` 或者 `标识符`，跳转至相应的反汇编行（没有找到则跳转至开头）
- 优化：当源文件不在当前工作区时，向 C/C++ 插件提供源文件的搜索目录
- 优化：打开文件选取对话框时，设置初始路径为项目根目录
- 优化：在使用 Importer 导入多 Target 项目时，使用 \<prjName>+\<targetName> 作为 id，区分列表项
- 优化：优化下载 eide-binaries 时的站点选择
- 优化：若某些烧录器不支持 `Erase Chip`，则忽略该命令
***

### [v2.15.0] (**requirements: VsCode ^1.60.0**)
- 新增：向**项目属性**视图增加一个**修改**按钮，允许以直接修改 yaml 配置文件的形式修改其配置，[文档](https://docs.em-ide.com/#/zh-cn/project_deps)
- 新增：向**项目资源**视图增加一个配置按钮，允许**为单个的文件或组增加任意编译选项**，支持使用 glob 模式匹配源文件和组，[文档](https://docs.em-ide.com/#/zh-cn/project_manager?id=为源文件附加单独的编译选项)
- 新增：为 **虚拟文件夹**/**源文件** 增加修改路径选项，允许修改文件的路径（方便直接修改整个虚拟文件夹树以及其链接到的源文件）
- 新增：将烧录选项 `程序文件` 的文件选择器取消，改为输入框；允许一次烧录多个程序文件，**程序文件** 字段格式 '`<filePath>[,addr][;<filePath>...]`'
- 新增：增加全片擦除功能，`ctrl+shift+p` 打开命令面板，输入 `Erase Chip`，即可执行（某些烧录器可能不支持，则该命令将退化为普通的烧录命令）
- 新增：在 **项目资源** 树中增加 `Output Files` 目录，用于查看生成的编译产物; 同时增加 axf, elf 信息查看功能，点击 axf/elf 文件即可打开
- 新增：增加文件右键菜单项：打开所在目录
- 新增：支持 armcc 反汇编查看，通过编辑器右键菜单 `查看反汇编` 即可打开
- 新增：鼠标悬停显示文件,文件夹数量（仅虚拟文件夹）
- 新增：支持通过编写外部 js 脚本来导入其他IDE项目文件中的文件树，宏，头文件等信息（方便导入 `SEGGER Embedded Studio`，`IAR For ARM` 等其他任意 IDE 的项目），[文档](https://docs.em-ide.com/#/zh-cn/project_manager?id=从其他-ide-项目导入源文件资源)
- 新增：在输出目录生成 .map.view 文件，打开即可显示 map 文件的资源统计视图（仅支持ARMCC/GCC工程），[文档](https://docs.em-ide.com/#/zh-cn/utility_functions?id=查看程序资源视图)
- 新增：支持在线下载安装 Keil 芯片支持包，默认远程仓库地址：https://github.com/github0null/eide-cmsis-pack
- 修复：CMSIS Config Wizard 在解析不符合要求的字符串类型时，出现误判
- 修复：删除 CMSIS 包之后，相应的 MCU 预定义宏被删除
- **更改：调整某些配置的显示名称**，如 **项目依赖** 更改为 **项目属性**
- 更改：使用 Linux VT100 颜色代码添加更完备的编译输出日志高亮（**win10 以下的系统可能不支持**；可通过向插件配置 `Builder.AdditionalCommandLine` 添加 `-no-color` 关闭色彩输出）
- **更改：支持为 Armcc v5/v6 工具链单独设置编译器路径，同时保留旧的 MDK TOOLS.INI 设置方法**
- 更改：生成 *.obj 时，根据相对路径将 obj 生成至相应的文件夹树中（若有无法计算相对路径的文件，统一生成至 `obj` 目录）
- 优化：当烧录选项 `程序文件` 为空时，使用默认的程序文件路径（ui 上显示为 `${projectName}.hex`）
- 优化：允许带空格的虚拟文件夹命名
- 优化：项目资源文件夹树排序显示
- 优化：读取完 JLink Device 列表后，删除临时文件
- 优化：调整构建工具的 Log 显示
- 优化：CMSIS Wizard UI：使被禁用的子项表单控件无法被选中
- 优化：CMSIS Wizard UI：调整布局，优化 vscode 主题颜色适配
- 优化：完善 CMSIS Wizard 的语法支持程度
***

### [v2.14.0]
- 优化：增加一些编译器预定义宏
- 优化：优化 Builder Config UI，修复选项卡阴影区域显示不正常的问题
- 新增：支持显示源文件的头文件引用，默认开启，可在插件设置中关闭
- 新增：增加 [CMSIS Configuration Wizard](https://arm-software.github.io/CMSIS_5/Pack/html/configWizard.html) 功能。 打开带有 CMSIS Config 格式的头文件，右键菜单选择 `CMSIS Configuration Wizard` 即可打开配置UI，[文档](https://docs.em-ide.com/#/zh-cn/cmsis_wizard)
***

### [v2.13.0]
- 优化：切换不同的烧录器时，保留旧的烧录配置
- 优化：为 STLink，JLink 烧录器增加**附加命令行**选项，用于为烧录程序附加额外的命令行
- 修复：打开 RAM/ROM Layout 偶尔出现内容为空的问题，适应 vscode 主题色
- 修复：同时打开多个 vscode 实例时，JLink Device List 读取冲突而导致 JLink Device List 为空
- 修复：安装 Keil 包时，Components 为空导致包安装失败
***

### [v2.12.3]
- 新增：增加一条命令 `eide.reinstall.binaries`，允许重新安装 eide-binaries
- 优化：支持自动读取 JLink 内部 Device 列表，以及加载 JLink 安装目录下的 'JLinkDevices.xml'
- 优化：使用扩展推荐，取消原来的扩展包绑定，将自动附加扩展推荐到项目工作区（在工作内打开 **扩展** -> **推荐** 即可查看）
- 优化：允许向虚拟文件夹添加 c/c++ 头文件
- 优化：优化构建器选项 UI (使用 element UI 代替部分 boostrap 组件)
- 支持 sdcc 编译 .asm 汇编文件
- 优化：为 STLink 下载方式兼容 STM32CubeProgramer 下载器，将默认 stlink 下载器安装包修改为 [st_cube_programer.7z](https://github.com/github0null/eide-resource/blob/master/packages/st_cube_programer.7z)
***

### [v2.12.1]
- 修复：当使用路径相对于工作区的 openocd cfg 文件时，生成的 cortex-debug 配置中出现错误
- 修复：打开构建器选项时，偶尔无法正常显示 UI
- 更改：在项目加载时保留无效的包含路径，库目录
- 优化：在使用多项目工作区时，将默认的构建优先级改为 100
- 优化：下载安装 eide binaries 时，优化站点选择
- 优化：导入 MDK 项目时，优化 RTE 组件的导入
***

### [v2.12.0]
- 新增：在设置工具链路径时，支持显式选择工具链的安装模式（仅支持免费的工具链）
- 新增：增加 vscode 演示，将在插件被安装时启动
- 修复：修复 cmsis pack 解析问题：https://discuss.em-ide.com/d/87
- 更改：将 cmsis pack 的默认安装位置改为：`.pack`, cmsis header 的安装位置改为：`.cmsis`
- 更改：将扩展改为扩展包，一并安装其他实用性扩展
- 更改：将插件改为在线安装，缩小 vsix 安装包大小，离线版下载位置：https://github.com/github0null/eide/releases
- 优化：能够自动在环境变量中获取 Keil 的安装位置，Keil 环境变量：`Keil_Root`
- 优化：增强 MDK 项目的导入功能，自动导入 MDK 项目中的包组件，增加组件缺失时的提示功能；导入成功后，组件存放位置：`.cmsis`
- 优化：优化构建器选项的 UI，适应 vscode 语言配置
- 优化：在插件启动后自动将 cortex-debug 需要的路径设置到插件环境变量
- 优化：安装 cmsis pack 的组件时对不需要的模板文件进行过滤
- 优化：新增插件设置，允许禁用相关的右键上下文菜单
***

### [v2.11.0]
- 新增：支持多项目工作区的构建，具体细节见文档：https://docs.em-ide.com/#/zh-cn/multi_prj_workspace
- 新增：支持 GCC 可执行文件的大小显示和占用比（要显示占用比，须在项目环境变量中设置芯片大小信息）
- 优化：优化构建输出显示
- 更改：默认 eide 模板后缀改为 `ept`, 多项目工作区模板后缀为 `ewt`
***

### [v2.10.2]
- 修复：串口监视器无法打开，找不到可执行文件位置
- 优化：执行终端任务时附加 eide 的可执行程序目录到环境变量
***

### [v2.10.1]
- 修复：在多项目工作区无法切换活动项目
- 优化：为 c/c++ includePath 字段增加 `${workspaceFolder}` 前缀，用以支持多工作区项目
- 优化：优化提示信息
***

### [v2.10.0]
- **新增：支持使用 cppcheck 对项目进行静态检查**
- 优化：优化 eide.json 的结构, 删除不必要的信息
- 更改：调整在线安装工具时工具的安装目录，更改至：`<用户根目录>/.eide/tools`
***

### [v2.9.1]
- 修复：将内置 unify_builder 默认字符集更改为 GBK，修复中文乱码的错误
***

### [v2.9.0]
- **更改：使用内置的 Mono 运行时代替 .NetFramework 运行时**
- 更改：eide 默认模板仓库转移至 https://github.com/github0null/eide-resource
- 新增：支持在线安装缺失的工具
- 新增：对某个源文件查看反汇编（仅支持 GCC 系列）
***

### [v2.8.1]
- **更改：调整某些插件设置的命名（旧的设置将会失效）**
- 更改：调整 **工具链设置** 图标的显示状态
- 新增：新增插件设置项 `EIDE.JLink.DeviceXmlPath`，用于设置 JLink 芯片支持列表
- 修复：连接远程仓库超时，但连接未能关闭
- 优化：添加源文件时根据文件后缀进行过滤
- 优化：调整 Makefile 模板的获取方式
***

### [v2.8.0]
- 新增：支持生成通用的 Makefile 模板，在项目右键菜单中即可操作
***

### [v2.7.0]
- 优化：汉化某些编译选项名称
- 新增：优化编译选项界面，支持 vscode 主题色
***

### [v2.6.0]
- 新增：允许为项目设置一些环境变量，主要用于在 `Builder Options` 中使用，在 **其他设置** 中打开进行更改
***

### [v2.5.7]
- 新增：为 SDCC 增加 **pdk13/pdk14/pdk15** 芯片类型选项
- 优化：为 SDCC 优化 C/C++ 配置的生成
***

### [v2.5.6]
- 更改：使用 SDCC 编译时，允许修改 obj 文件后缀（用于兼容 **pic gputils** 工具），在 linker 配置中修改
- 更改：使用 SDCC 编译时，允许禁用内置的输出任务，在 linker 配置中修改
***

### [v2.5.5]
- 更改：调整命令名称
- 优化：修改编译选项后下次编译自动判断是否需要重新编译
***

### [v2.5.4]
- **新增：根据 Windows 版本自动区分要使用的 .NET 运行时**
- 修复：屏蔽某个源文件时，与其名称前缀相同的源文件也被屏蔽
- 更改：移除 c/c++ 插件依赖项
***

### [v2.5.3]
- 新增：为串口监视器波特率设置增加`状态栏按钮`
- 修复：iar stm8 链接时打印信息不全
- 优化：为 armcc5 增加 C, C++ 其他编译选项，移除旧的选项 `misc-control`
- 优化：仅在存在打开的项目时激活编辑器标题栏图标
- 优化：增加打开插件设置选项
***

### [v2.5.2]
- 修复：多目标项目切换 Target 时烧录配置字段重叠
- 优化：为 `Arm gcc` 工具链添加全局选项
- 优化：支持以 `.o .obj` 为后缀的链接库文件
- 优化：添加 `build clean, download` 快捷方式到编辑器标题栏 (可在插件设置中关闭)
- 优化：添加命令 `Reload JLink Device List` 用于重新加载 JLink 可用芯片列表
- 优化：添加命令 `Reload STM8 Device List` 用于重新加载 STM8 可用芯片列表
- 更改：将自定义烧录器标签改为 `shell`
- 更改：导出模板时，将模板文件名改为 `项目名`, 而不是项目目录名
- 新增：添加了一些内置模板
***

### [v2.5.1]
- **新增：STLink 烧录支持添加外部下载算法和选项字节**
- 修复：openocd 烧录参数格式错误
- 修复：pyocd 空配置文件导致的更新调试配置失败
- **修复：RISC-V 没有为 Linker 传递全局参数**
- **优化：支持在环境变量中自动搜索 `编译器`，`烧录工具` 的安装位置 (需要将相关插件配置的值置空)**
- 优化：显示依赖项列表时进行排序
- **优化：优化编译器选项 UI**
- 更改：为 pyocd 配置文件名加上 target 前缀
***

### [v2.5.0]
- **新增：支持 RISC-V 工程开发**
- 修复：arm gcc 版本过高(v10-2020-q4)导致增量编译失效的问题
- 修复：无法从高版本 openocd 中获取 `.cfg` 配置文件列表
- 优化：在 custom 烧录方式中加入可选变量 `${port}`，代指当前串口
- 优化：支持在工作区中搜索 openocd `.cfg` 配置文件
- **更改：移除 arm gcc 中的 `plain-char-is-signed` 选项**
***

### [v2.4.1]
- 更改：优化编译器选项界面 UI
- 更改：调整用于语法检查的关键字
- 优化：自动根据烧录配置生成相应的调试配置
***

### [v2.4.0]
- **新增：支持使用 UI 来修改编译器参数**
- 修复：缺少 chcp 命令而导致的插件无法启动
- **更改：移除 sdcc 的 deivce-options 选项，相关参数到 misc-controls 中添加**
***

### [v2.3.2]
- 更改：调整 IAR-STM8 编译器选项参数
- 更改：生成 c/c++ 配置时添加 `${default}` 参数
***

### [v2.3.1]
- 新增：在构建时打印源文件的路径，可在插件设置中开启或关闭
- 优化：构建时尝试提升进程优先级，以加快构建速度
- 优化：减少 github api 的调用，防止因超过访问速率限制而导致无法从 github 获取模板
- **更改：去除链接器编译选项中的 `output-lib` 选项，使用 `output-format` 选项代替**
- 更改：更改插件的激活方式
***

### [v2.2.1]
 - **修复：在切换目标后包含路径变为绝对路径**
 - 优化：在构建前检查编译工具的路径是否有效
 - 更改：调整某些项的标签名
 - 更改：调整 STM8 的调试配置生成
***

### [v2.2.0]
- 新增：支持导入KEIL项目时导入芯片RAM/FLASH布局信息，fpu浮点选项信息
- **修复：排除功能无法排除嵌套的源文件夹**
- 优化：为不支持FPU的芯片隐藏浮点选项
- 更改：移除多余浮点选项 `default`， 将由已有选项 `none` 代替
***

### [v2.1.1]
- 新增：支持 cortex-m23, cortex-m33
- 修复：导入KEIL项目时由于某些包含路径存在后缀 '\\'，而导致路径不正确
- 修复：导入KEIL项目时带有"的宏定义解析出错
- 修复：切换 Target 之后，编译，烧录配置没有更新
- 更改：修改插件图标为圆形
- 更改：调整字符串提示，和某些工具的图标
- 优化：导入KEIL项目时自动选择工具链
- 优化：为外部工具的路径设置增加默认值
***

### [v2.0.0]
- 新增：支持以虚拟文件夹形式组织源文件
- **新增：支持 KEIL 项目导入功能，但只支持 KEIL 5 及以上版本**
- 新增：支持更改项目名称
- 优化：当使用的工具没有安装时，给出提示和下载链接
- 优化：隐藏 axf2elf 工具的输出，将其重定向到 axf2elf.log 文件
***

### [v1.23.2]
- 优化：为 github 站点进行代理，提升模板仓库连接速度和下载速度
- 优化：调整构建器的输出提示
- 调整：更改某些字符串提示
***

### [v1.23.1]
- 更改：调整 sdcc, gcc 默认编译配置
- 更改：调整某些提示信息
- 新增：允许为项目创建 target, 和切换 target
***

### [v1.22.2]
- 优化：汉化某些提示信息
- 优化：隐藏某些不必要的设置或选项
***

### [v1.22.1]
- 修复：在工作区文件夹内无法启动扩展
***

### [v1.22.0]
- 新增：允许通过自定义shell命令下载程序
- 修复：解析 GD32 keil 包时出现的问题
- 调整：调整功能按钮；移除多余的按钮，将其放到右键菜单
- 优化：压缩配置, 移除无用的 eide 项目配置
***

### [v1.21.4]
- 新增：为 ARMCC 增加 `代码大小` 和 `代码速度` 优化的选项
- 优化：为模板名称排序
- 修复：打开多个项目时，日志输出位置重叠
***

### [v1.21.3]
- 优化：优化调试配置的生成
- 修复：导出 keil 项目时没有设置输出目录
- 更改：调整 C/C++ 插件的配置生成
***

### [v1.21.2]
- 新增：添加新设置，允许设置输出目录名称
- 更改：允许添加多个链接脚本
- 更改：将 EIDE.json 重命名为 eide.json
- 优化：模板视图支持嵌套显示
***

### [v1.20.4]
- 修复：打开串口监视器时出现资源已经释放的错误
- 修复：在没有打开工作区时无法编译项目
- 调整：将 "项目" 栏重命名为 "项目资源"
- 优化：在 "项目资源" 栏中支持双击文件以非预览模式打开
***

### [v1.20.3]
- 调整：创建项目的向导
- 调整：调整内置的模板
- 修复：获取模板信息时没有进度条显示
***

### [v1.20.2]
- 调整：将依赖项目录 deps 移动到 .eide
- 调整：builder 的日志格式
***

### [v1.20.1]
- 调整：构建工具的输出
***

### [v1.20.0]
- 调整：Github 模板的显示结构
- 调整：根据下载配置生成调试配置
***

### [v1.19.0]
- 修复：解析调试配置失败时，launch.json 被重置
- 修复：命令行输出错位
- 更改：将从模板创建选项合并到新建项目
- 更改：调整视图的默认显示顺序
- 更改：调整构建工具的输出
***

### [v1.18.10]
- 更改：调整生成 hex, bin, s19 的命令行
***

### [v1.18.9]
- 更改：调整串口监视器
***

### [v1.18.8]
- 更改：调整用于完善语法高亮的宏
- 修复：更改编译配置后没有在下一次编译时触发重新编译
***

### [v1.18.7]
- 更改：允许将项目创建在已存在的目录中
- 修复：导出 Keil XML 时没有为 ASM 导出全局的宏
***

### [v1.18.6]
- 更改：调整了一些字符串提示
- 更改：为某些编译配置增加 output-debug-info 选项，用以指定是否生成调试信息
***

### [v1.18.4]
- 更改：允许为 KEIL_C51 的宏设置值
- 更改：调整 KEIL_C51 汇编器为 A51，不再使用 AX51
- 更改：调整 OpenOCD 下载的命令行
***

### [v1.18.3]
- 更改：调整输出目录
- 更改：调整 dependence 目录
- 更改：调整某些文本提示
- 更改：Build 功能: 使用编译器输出的 *.d 引用文件来确定哪些源文件需要重新编译，移除旧的方法
***

### [v1.18.1]
- 修复：输出目录不存在导致 jlink 烧录失败并无法再次进行烧录
- 更改：使某些输入框能够一直获得焦点，防止因鼠标单击空白而导致输入框消失
- 更改：调整构建工具的输出
***

### [v1.18.0]
- 新增：为编译器输出增加高亮
- 更改：调整默认快捷键
- 更改：使用 jsonc 解析某些带注释的 vsocde 配置
***

### [v1.17.2]
- 更改：调整了一些图标
- 更改：调整了一些字符串提示
- 更改：调整了构建工具
***

### [v1.17.1]
- 修复：文件夹变化过快导致的刷新文件夹失败
- 更改：调整一些默认的编译配置
- 新增：支持使用 .eideignore 在打包项目时排除某些文件
***

### [v1.17.0]
- 新增：OpenOCD 烧录
- 更改：快速编译在搜索头文件时忽略文件名的大小写
- 更改：修补 axf 时保留符号表
- 优化一些使用细节
***

### [v1.16.0]
- 新增：pyocd 烧录，用以支持 DAP-Link，[使用方法](https://blog.csdn.net/qq_40833810/article/details/104114921#_pyocd__169)
- 更改：完善 c_cpp_properties.json 的内容
- 修复：部分 keil 包解析错误
- 优化一些使用细节
***

### [v1.15.0]
- 新增: 自动从 Github 更新全局的编译器参数配置
- 更改: 调整 ARM-GCC 默认的项目编译配置
- 更改: 简化 JLink 烧录配置，使用 JLink 命令行代替 JFlash
- 更改: 默认使用 task 发送命令，可在插件设置中更改
***

### [v1.14.4]
- 修复: C51 宏的格式不正确导致的编译错误
***

### [v1.14.3]
- 更改: 调整 STVP 的烧录参数
- 更改: 增加一些内置的项目模板，可在新建项目时选择
- 更改: 将 ARM_GCC 默认的 FABI 值由 hard 改为 softfp
***

### [v1.14.2]
- 修复: 完善 IAR_STM8 工具链的 编译参数 和 宏扩展
- 优化: 串口监视器支持 GBK 编码
- 优化一些细节
***

### [v1.14.1]
- 更改: 排除目录时递归排除所有子目录
- 修复一些问题
- 优化一些使用细节