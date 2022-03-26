# Change Log

所有值得注意的版本变化将被记录在这个文件中。

***

### [v3.0.0] (preview edition) (v3.0.0-RC1)

**New**:
  - Support linux platform (ubuntu)

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