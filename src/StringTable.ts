/*
	MIT License

	Copyright (c) 2019 github0null

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

import * as vscode from 'vscode';
import * as os from 'os';

export enum LanguageIndexs {
    Chinese = 0,
    English
}

let langIndex: number = /zh-cn/i.test(vscode.env.language)
    ? LanguageIndexs.Chinese
    : LanguageIndexs.English;

try {
    const langType = vscode.workspace.getConfiguration('EIDE').get<string>('DisplayLanguage');
    switch (langType) {
        case 'zh-cn':
            langIndex = LanguageIndexs.Chinese;
            break;
        case 'en-us':
            langIndex = LanguageIndexs.English;
            break;
        default:
            break;
    }
} catch (error) {
    // nothing todo
}

export function getLocalLanguageType(): LanguageIndexs {
    return langIndex;
}

//------------------------------------------------
//---------------string table-------------
//------------------------------------------------

//------------------ settings view string ----------------

export const view_str$settings$outFolderName = [
    '输出目录名',
    'Output Folder Name'
][langIndex];

export const view_str$settings$prj_name = [
    '项目名称',
    'Project Name'
][langIndex];

export const view_str$settings$prjEnv = [
    '环境变量',
    'Env Variables'
][langIndex];

//------------------ upload view string ----------------

export const view_str$flasher$flashCommandLine = [
    '烧录命令',
    'Flash Command'
][langIndex];

export const view_str$flasher$eraseChipCommandLine = [
    '擦除芯片命令',
    'Erase Chip Command'
][langIndex];

export const view_str$flasher$targetName = [
    '目标芯片名称',
    'Target Name'
][langIndex];

export const view_str$flasher$interfaceType = [
    '接口类型',
    'Interface Type'
][langIndex];

export const view_str$flasher$openocd_target_cfg = [
    '芯片配置',
    'Chip Config'
][langIndex];

export const view_str$flasher$openocd_interface_cfg = [
    '接口配置',
    'Interface Config'
][langIndex];

export const view_str$flasher$downloadSpeed = [
    '下载速度',
    'Download Speed'
][langIndex];

export const view_str$flasher$eraseAll = [
    '擦除所有',
    'Erase All'
][langIndex];

export const view_str$flasher$binPath = [
    '程序文件',
    'Program File'
][langIndex];

export const view_str$flasher$eepromPath = [
    'eeprom 数据文件路径',
    'eeprom Data File Path'
][langIndex];

export const view_str$flasher$optionBytesPath = [
    '选项字节文件路径',
    'Option Bytes File Path'
][langIndex];

export const view_str$flasher$optionBytesConfig = [
    '选项字节配置',
    'Option Bytes Config'
][langIndex];

export const view_str$flasher$resetMode = [
    '复位模式',
    'Reset Mode'
][langIndex];

export const view_str$flasher$external_loader = [
    '外部加载算法',
    'External Loader File'
][langIndex];

export const view_str$flasher$cpuName = [
    '芯片名称',
    'CPU Name'
][langIndex];

export const view_str$flasher$baseAddr = [
    '烧录起始地址',
    'Flash Base Address'
][langIndex];

export const view_str$flasher$launchApp = [
    '烧录后启动程序',
    'Launch App After Program'
][langIndex];

export const view_str$flasher$options = [
    '其他选项',
    'Other Options'
][langIndex];

export const view_str$flasher$stcgalOptions = [
    '其他配置',
    'Other Config'
][langIndex];

export const view_str$flasher$other_cmds = [
    '附加命令行',
    'Extra CommandLine'
][langIndex];

//------------------ compile view string----------------

export const view_str$compile$cpuType = [
    'CPU 类型',
    'CPU Type'
][langIndex];

export const view_str$compile$archExtensions = [
    'CPU 扩展选项',
    'CPU Extended Options'
][langIndex];

export const view_str$compile$cpuVendor = [
    'CPU 厂商',
    'CPU Vendor'
][langIndex];

export const view_str$pack$components = [
    '外设组件',
    'Peripheral Components'
][langIndex];

export const view_str$compile$deprecated = [
    '弃用的属性',
    'Deprecated Proterty'
][langIndex];

export const view_str$compile$options = [
    '构建器选项',
    'Builder Options'
][langIndex];

export const view_str$project$cmsis_config_wizard = [
    'CMSIS Configuration Wizard',
    'CMSIS Configuration Wizard'
][langIndex];

export const view_str$compile$storageLayout = [
    'RAM / FLASH 布局',
    'RAM And ROM Layout'
][langIndex];

export const view_str$compile$useCustomScatterFile = [
    '使用自定义的 Scatter File',
    'Use Custom Scatter File'
][langIndex];

export const view_str$compile$scatterFilePath = [
    '链接脚本路径',
    'Linker Script File Path'
][langIndex];
export const view_str$compile$scatterFilePath_mdk = [
    'Scatter File 路径',
    'Scatter File Path'
][langIndex];

export const view_str$compile$floatingPointHardware = [
    '硬件浮点选项',
    'Hardware Floating-Point Option'
][langIndex];

export const view_str$compile$selectToolchain = [
    '选择一个工具链',
    'Select Toolchain'
][langIndex];

export const view_str$compile$selectFlasher = [
    '选择一个烧录工具',
    'Select Flasher'
][langIndex];

//-------------------Project View string----------------

export const view_str$project$sel_folder_type = [
    '选择要添加的文件夹类型',
    'Select the folder type to add'
][langIndex];

export const view_str$project$folder_type_fs = [
    '普通文件夹',
    'Normal Folder'
][langIndex];

export const view_str$project$folder_type_fs_desc = [
    '从磁盘中选择一个文件夹，将其直接链接到项目中，自动添加其中的源文件以及包含路径',
    'Select folder from disk, eide will link it directly into your project.'
][langIndex];

export const view_str$project$folder_type_virtual = [
    '虚拟文件夹',
    'Virtual Folder'
][langIndex];

export const view_str$project$folder_type_virtual_desc = [
    '新建一个虚拟文件夹（该文件夹在磁盘上是不存在的）来组织源文件的结构',
    'Create VirtualFolder (The folder does not exist on disk) to organize the source file structure.'
][langIndex];

export const view_str$project$add_source = [
    '添加源文件',
    'Add Source Files'
][langIndex];

export const view_str$project$sel_target = [
    '选择 Target 进行切换',
    'Switch Target'
][langIndex];

export const view_str$project$other_settings = [
    '项目设置',
    'Project Settings'
][langIndex];

export const view_str$project$cmsis_components = [
    '外设组件',
    'Peripheral Components'
][langIndex];

export const view_str$project$title = [
    '项目资源',
    'Project Resources'
][langIndex];

export const view_str$project$needRefresh = [
    '需要刷新',
    'Need Refresh'
][langIndex];

export const view_str$project$fileNotExisted = [
    '文件不存在',
    'File Not Existed'
][langIndex];

export const view_str$project$excludeFolder = [
    '已排除的文件夹',
    'Excluded Folder'
][langIndex];

export const view_str$project$excludeFile = [
    '已排除的文件',
    'Excluded File'
][langIndex];

export const uploadConfig_desc = [
    '烧录配置',
    'Flasher Configurations'
][langIndex];

export const include_desc = [
    '包含目录',
    'Include Directories'
][langIndex];

export const lib_desc = [
    '库搜索目录',
    'Library Search Directories'
][langIndex];

export const source_list_desc = [
    '源文件列表',
    'Source Files List'
][langIndex];

export const definition_list_desc = [
    '预处理器定义',
    'Preprocessor Definitions'
][langIndex];

export const project_dependence = [
    'C/C++属性',
    'C/C++ Attributes'
][langIndex];

export const view_str$dialog$add_to_source_folder = [
    '添加源文件夹到项目',
    'Add These Source Folders'
][langIndex];

export const add_include_path = [
    '添加到包含目录',
    'Add To Include Paths'
][langIndex];

export const add_lib_path = [
    '添加到库目录',
    'Add To Lib Paths'
][langIndex];

export const add_define = [
    '添加宏',
    'Add Macros'
][langIndex];

export const pack_info = [
    '芯片支持包',
    'Chip Support Package'
][langIndex];

export const compile_config = [
    '构建配置',
    'Builder Configurations'
][langIndex];

export const set_device_hint = [
    '为项目设置芯片型号',
    'Set device for this project'
][langIndex];

export const switch_workspace_hint = [
    '项目加载成功, 是否立即切换工作区 ? （需要切换工作区才能加载工作区配置）',
    'The project load successfully, do you want to switch workspace immediately ? Need to switch workspace so that the workspace configuration can be loaded.'
][langIndex];

//--------------- env ---------------

export const view_str$env_desc$project_name = [
    `项目名称`,
    `Project name`
][langIndex];

export const view_str$env_desc$project_root = [
    `项目根目录`,
    `Project root folder`
][langIndex];

export const view_str$env_desc$output_dir = [
    `编译输出目录`,
    `Build output folder`
][langIndex];

export const view_str$env_desc$builer_folder = [
    `构建器可执行文件目录`,
    `Builder executable file's folder`
][langIndex];

export const view_str$env_desc$toolchain_root = [
    `工具链根目录`,
    `Toolchain root folder`
][langIndex];

export const view_str$env_desc$compiler_prefix = [
    `GCC编译器前缀 (非GCC则没有前缀,为空)，例如：arm-none-eabi-`,
    `GCC Compiler Prefix (empty if it's not gcc). e.g. arm-none-eabi-`
][langIndex];

export const view_str$env_desc$compiler_folder = [
    `编译器可执行文件目录`,
    `Compiler executable file's folder`
][langIndex];

export const view_str$env_desc$compiler_ver = [
    `编译器版本号，如：'8.3.1'`,
    `Compiler Version. e.g. 8.3.1`
][langIndex];

export const view_str$env_desc$compiler_full_name = [
    `编译器全名 (可读名称)`,
    `Compiler Full Name (Human-readable Name)`
][langIndex];

export const view_str$env_desc$cc_base_args = [
    `C 编译器的基本参数 (CFLAGS)`,
    `Base C Compiler Flags (CFLAGS)`
][langIndex];

export const view_str$env_desc$cxx_base_args = [
    `C++ 编译器的基本参数 (CXXFLAGS)`,
    `Base C++ Compiler Flags (CXXFLAGS)`
][langIndex];

export const view_str$env_desc$asm_base_args = [
    `汇编器的基本参数 (ASMFLAGS)`,
    `Base Assembler Flags (ASMFLAGS)`
][langIndex];

export const view_str$env_desc$py3_cmd = [
    `插件内置的 python3 命令 (非windows平台则使用系统自带命令)`,
    `The built-in python3 commands of the plugin (for non-Windows platforms, use the system's built-in commands)`
][langIndex];

//---------------Other---------------

export const view_str$prompt$requireOtherExtension = [
    `请先安装扩展 "{}"`,
    `Please install extension "{}" first.`
][langIndex];

export const view_str$prompt$debugCfgNotSupported = [
    `仅支持如下类型的动态调试配置 '{0}'. 当前类型 '{1}' 不受支持！`,
    `Only the following type of dynamic debugging configurations '{0}' are supported. The current type '{1}' is not supported !`
][langIndex];

export const view_str$prompt$install_dotnet_and_restart_vscode = [
    `安装完.NET后，你需要完全重启VSCode以刷新系统环境变量`,
    `After installed .NET. You need to close all VSCode instance and restart it to refresh System Environment Variables.`
][langIndex];

export const view_str$prompt$reload_workspace_to_refresh_env = [
    `你需要重启插件以刷新环境变量`,
    `You need to reload workspace to refresh Environment Variables !`
][langIndex];

export const view_str$prompt$install_dotnet_failed = [
    `安装 [.NET6 runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) 时失败，你需要手动安装它！`,
    `Fail to install [.NET6 runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0), you need install it manually !`
][langIndex];

export const view_str$prompt$loadws_cfg_failed = [
    `加载VSCode工作区配置失败！请检查文件 {} 格式是否正确！`,
    `Load workspace configuration failed ! Please check your {} file.`
][langIndex];

export const view_str$gen_sct_failed = [
    `生成.sct文件失败`,
    `Fail to generate .sct file`
][langIndex];

export const view_str$virual_doc_provider_banner = [
    `通过修改并保存这个文件来更新项目配置（注意这个文件是临时的，不要使用其他工具打开这个文件）`,
    `You can modify the configuration by editing and saving this file.`
][langIndex];

export const view_str$prompt$filesOptionsComment = [
    `##########################################################################################`,
    `#                        Append Compiler Options For Source Files`,
    `##########################################################################################`,
    ``,
    `# syntax:`,
    `#   <your pattern>: <compiler options>`,
    `# For get pattern syntax, please refer to: https://www.npmjs.com/package/micromatch`,
    `#`,
    `# examples:`,
    `#   'main.cpp':           --cpp11 -Og ...`,
    `#   'src/*.c':            -gnu -O2 ...`,
    `#   'src/lib/**/*.cpp':   --cpp11 -Os ...`,
    `#   '!Application/*.c':   -O0`,
    `#   '**/*.c':             -O2 -gnu ...`,
    '',
    ''
].join(os.EOL);

export const view_str$prompt$userCanceledOperation = [
    `用户取消了操作。`,
    `The user canceled the operation.`
][langIndex];

export const view_str$prompt$chipPkgNotCompateThisVersion = [
    `不兼容的项目，'芯片支持包' 功能在 v3.18.0 版本的 eide 中发生了变化（[更新日志](https://marketplace.visualstudio.com/items/CL.eide/changelog)），点击 '继续' 将强制打开项目并移除不兼容的数据，点击 '取消' 则退出。`,
    `Incompatible project, the 'Chip Support Package' function has changed in the version v3.18.0 of eide ([ChangeLog](https://marketplace.visualstudio.com/items/CL.eide/changelog)), clicking 'Continue' will force the project to open, and clicking 'Cancel' will cancel the opening.`
][langIndex];

export const view_str$prompt$removeSrcDir = [
    `从项目中移除源文件夹 '{}' ?`,
    `Remove source folder '{}' from current project ?`
][langIndex];

export const view_str$prompt$needReloadToUpdateEnv = [
    `需要重启插件以刷新内置的环境变量，立即重启插件？`,
    `We need relaunch plug-in to refresh internal environment variables, relaunch now ?`
][langIndex];

export const view_str$prompt$reloadForOldProject = [
    `项目文件版本过旧，需要重载项目以更新项目数据！现在重启插件吗？`,
    `Project file version is too old, we need to reload the project to update the project file ! Restart the plugin now ?`
][langIndex];

export const view_str$prompt$setupToolchainPrefix = [
    `设置编译器前缀`,
    `Setup Compiler Prefix`
][langIndex];

export const view_str$prompt$requestAndActivateLicence = [
    `获取并激活许可证`,
    `Obtain And Activate Licence`
][langIndex];

export const view_str$prompt$requestAndActivateLicence_warn_setupPath = [
    `在开始之前激活之前，你必须先安装并设置编译器的路径！`,
    `Before you start activating, you must install and set the path of the compiler !`
][langIndex];

export const view_str$prompt$need_reload_project = [
    `'{}' 的项目文件 'eide.yml' 已被更改，重新加载项目？`,
    `The project file 'eide.yml' of '{}' has been changed !, reload it ?`
][langIndex];

export const view_str$prompt$src_folder_must_be_a_child_of_root = [
    `要被添加的源文件夹必须是项目根目录的子文件夹 !`,
    `The source folder to be added must be a child of project root folder !`
][langIndex];

export const view_str$prompt$prj_location = [
    `项目位置：'{}'`,
    `Project Location: '{}'`
][langIndex];

export const view_str$prompt$unresolved_deps = [
    `存在未解决的依赖项，请手动添加它们 !, 完成添加后，请删除该文件，避免再次弹出提示。`,
    `These are the unresolved dependencies, please add them manually ! After done, please delete this file, otherwise this file will be show again !`
][langIndex];

export const view_str$prompt$eclipse_imp_warning = [
    `在 eclipse 和 eide 之间有一些不兼容的参数，您需要检查并手动添加到 eide 项目 !\n\n当你解决了这些不兼容的参数，你需要删除这个提示文件，否则这个文件还会再次显示 !`,
    `There are some incompatible arguments between 'eclipse' and 'eide', you need check and add them to eide project manually !\n\nWhen you have solved these incompatible problems, you need delete this note file, otherwise this file will be show again !`
][langIndex];

export const view_str$prompt$tool_install_mode_online = [
    `在线安装`,
    `Install Online`
][langIndex];

export const view_str$prompt$tool_install_mode_local = [
    `在本地选择一个现有的安装位置`,
    `Select an existing installation location locally`
][langIndex];

export const view_str$prompt$select_tool_install_mode = [
    `已找到在线的安装包，您可以选择工具链的安装模式`,
    `Found online installation package. You can select an installation mode for the toolchain`
][langIndex];

export const view_str$prompt$select_file = [
    `选择该文件`,
    `Select This File`
][langIndex];

export const view_str$prompt$select_folder = [
    `选择该文件夹`,
    `Select This Folder`
][langIndex];

export const view_str$prompt$select_file_or_folder = [
    `选择该文件或文件夹`,
    `Select This File Or Folder`
][langIndex];

export const view_str$prompt$not_found_compiler = [
    `无法找到编译器 '{}' 的位置 ！`,
    `Not found the compiler '{}' location !`
][langIndex];

export const view_str$prompt$not_found_gcc_prompt_user_setup = [
    `无法找到编译器 '{}' 的位置 ！\n请确保编译器已安装，并设置到系统环境变量 PATH 中。\n右击 '构建配置' 打开 '设置工具链' 检查编译器前缀是否已设置。`,
    `Not found the compiler '{}' location ! \nPlease ensure that the compiler is installed and set to the system 'PATH' environment variable.\nRight-click on 'Builder Configuration' to open 'Setup Toolchain' and check if the compiler prefix has been set.`
][langIndex];

export const view_str$prompt$install_tools_by_online = [
    `已找到在线资源包，需要安装它吗？`,
    `The online package was found. Do you want to install it ?`
][langIndex];

export const view_str$placeHolder$selectCategory = [
    '选择模板的类别',
    'Select the category of the template'
][langIndex];

export const found_cache_desc = [
    '已缓存的',
    'Local Cache'
][langIndex];

export const invalid_project_path = [
    '无效的项目路径: ',
    'Invalid project path: '
][langIndex];

export const custom_dep_text = [
    '自定义',
    'Custom'
][langIndex];

export const build_in_dep_text = [
    '内置',
    'Build-in'
][langIndex];

export const export_keil_xml_ok = [
    '已成功导出 Keil 项目文件至 ',
    'Export Keil project xml to '
][langIndex];

export const export_keil_xml_failed = [
    '导出 Keil 项目文件失败',
    'Export Keil project xml failed'
][langIndex];

export const install_this_pack = [
    '安装此包',
    'Install this package'
][langIndex];

export const not_support_no_arm_project = [
    '暂不支持此项目类型',
    'Not support current project type'
][langIndex];

export const view_str$pack$installed_component = [
    '已安装的组件',
    'Installed component'
][langIndex];

export const view_str$pack$install_component_failed = [
    '安装组件失败',
    'Install component failed'
][langIndex];

export const view_str$pack$remove_component_failed = [
    '移除组件失败',
    'Remove component failed'
][langIndex];

export const uninstalled_package = [
    '项目未安装任何 Keil 包',
    'The project did not install any Keil packages'
][langIndex];

export const unset_device = [
    '项目还未设置目标设备',
    'The project has not set up the target device'
][langIndex];

export const project_record_read_failed = [
    '项目记录已损坏! 读取失败',
    'Item record corrupted !, Read failed'
][langIndex];

export const compile_tool_not_ready = [
    ' 编译工具的路径设置不正确 !',
    ' compile tool path is invalid !'
][langIndex];

export const project_exist_txt = [
    '项目文件夹已存在 !, 是否直接将项目创建在已存在的目录中 ?',
    'The project folder already exists !, Would you like to create the project directly in this existing directory ?'
][langIndex];

export const project_load_failed = [
    '项目加载失败 ! 打开输出面板查看日志以获取更多细节',
    'Project Load Failed ! Please open output panel and check log'
][langIndex];

export const project_is_opened = [
    '该项目已经被打开 !',
    'This project has been opened!'
][langIndex];

export const can_not_close_project = [
    '正在使用的工作区无法被关闭 !',
    'Workspace projects are not allowed to close, it\'s in use !'
][langIndex];

export const view_str$msg$err_ept_hash = [
    '这个模板的哈希值不正确，它可能被篡改了！您还想安装它吗？',
    `This template has incorrect hash value and it may have been tampered ! Do you still want to install it ?`
][langIndex];

export const view_str$msg$err_ewt_hash = [
    '这个模板的哈希值不正确，我们无法安装它！',
    `This template has incorrect hash and we can't install it !`
][langIndex];

export const view_str$prompt$project_is_opened_by_another = [
    `无法锁定项目 '{path}'，这个项目可能已被其他 EIDE 实例打开了 ！`,
    `Can't lock project: '{path}', maybe this project has been opened by another EIDE instance !`
][langIndex];

export const view_str$prompt$feedback = [
    `已经过去了一段时间，Embedded IDE 这款插件有帮到你吗？您可以在插件商店给予一个评分以帮助我们了解您的感受！`,
    `A few days passed, has this plugin(Embedded IDE) helped you ? You can help us know how you feel by giving us a rating in the plugin store !`
][langIndex];

//---------------Select string------------------

export const remove_this_item = [
    `确定要移除此项 '{}' 吗？`,
    `Remove this item: '{}' ?`
][langIndex];

export const sponsor_author_text = [
    `赞助作者`,
    `Sponsor The Author`
][langIndex];

export const rating_text = [
    '打分',
    'Rating'
][langIndex];

export const later_text = [
    '稍后',
    'Later'
][langIndex];

export const continue_text = [
    '继续',
    'Continue'
][langIndex];

export const cancel_text = [
    '取消',
    'Cancel'
][langIndex];

export const view_str$download_software = [
    '下载此软件',
    'Download This Software'
][langIndex];

export const gotoSet_text = [
    '去设置它',
    'Set it'
][langIndex];

export const txt_jump2settings = [
    '转到设置',
    'Goto Settings'
][langIndex];

export const txt_install_now = [
    '立即安装',
    'Install Now'
][langIndex];

export const txt_yes = [
    '是',
    'Yes'
][langIndex];

export const txt_no = [
    '否',
    'No'
][langIndex];

//---------------Operation---------------

export const view_str$operation$done = [
    '操作完成 !',
    'Operation completed !'
][langIndex];

export const view_str$operation$import_failed = [
    '项目导入失败 !',
    'Project import failed !'
][langIndex];

export const view_str$operation$import_done = [
    '项目已导入完毕, 是否立即切换工作区 ?',
    'The project is successfully imported. Do you want to switch workspace immediately ?'
][langIndex];

export const view_str$operation$create_prj_done = [
    '项目已完成创建, 是否立即切换工作区 ?',
    'The project is successfully created. Do you want to switch workspace immediately ?'
][langIndex];

export const view_str$operation$import_sel_out_folder = [
    '是否与原有的 KEIL 项目共存于同一目录下，如果选择 "No"，你需要为 EIDE 项目指定存放位置 ！',
    'Make eide project coexist with the Keil project in the same directory ? If you choose "No", you need to specify a folder to store the eide project !'
][langIndex];

export const view_str$operation$create_empty_project = [
    '空项目',
    'Empty Project'
][langIndex];
export const view_str$operation$create_empty_project_detail = [
    '新建一个空项目',
    'Create An Empty Project'
][langIndex];

export const view_str$operation$create_from_internal_temp = [
    '内置项目模板',
    'Internal Template'
][langIndex];
export const view_str$operation$create_from_internal_temp_detail = [
    '选择一个内置的项目模板，并通过该模板创建项目',
    'Select one of the built-in project templates and create the project by it'
][langIndex];

export const view_str$operation$create_from_local_disk = [
    '本地项目模板',
    'Local Template'
][langIndex];
export const view_str$operation$create_from_local_disk_detail = [
    '从本地磁盘选择一个项目模板，并通过该模板创建项目',
    'Select a project template from the local disk and create the project by it'
][langIndex];

export const view_str$operation$create_from_remote_repo = [
    '从远程仓库获取',
    'From Remote Repository'
][langIndex];
export const view_str$operation$create_from_remote_repo_detail = [
    '从远程仓库下载一个项目模板，并通过该模板创建项目',
    'Download a project template from the remote repository and create the project by it'
][langIndex];

export const view_str$operation$empty_8bit_prj = [
    '8 位 MCU 项目',
    '8Bit MCU Project'
][langIndex];

export const view_str$operation$empty_cortex_prj = [
    'Cortex-M 项目',
    'Cortex-M Project'
][langIndex];

export const view_str$operation$empty_riscv_prj = [
    'RISC-V 项目',
    'RISC-V Project'
][langIndex];

export const view_str$operation$empty_mips_prj = [
    'MIPS 项目',
    'MIPS Project'
][langIndex];

export const view_str$operation$empty_anygcc_prj = [
    '通用的 GCC 项目',
    'Generic GCC Project'
][langIndex];

export const view_str$operation$open_serialport = [
    '打开串口监视器',
    'Open Serialport Monitor'
][langIndex];

export const view_str$operation$serialport = [
    '打开串口',
    'Open Serial'
][langIndex];

export const view_str$operation$serialport_name = [
    '端口',
    'Port'
][langIndex];

export const view_str$operation$baudrate = [
    '波特率',
    'Baud'
][langIndex];

export const view_str$operation$setKeil51Path = [
    `设置 Keil_C51 'UV4.exe' 或者 'TOOLS.INI' 路径`,
    `Set Keil_C51 'UV4.exe' or 'TOOLS.INI' path`
][langIndex];

export const view_str$operation$setMDKPath = [
    `设置 MDK 'UV4.exe' 或者 'TOOLS.INI' 路径`,
    `Set MDK 'UV4.exe' or 'TOOLS.INI' path`
][langIndex];

export const view_str$operation$setToolchainInstallDir = [
    '设置 ${name} 的安装目录路径（编译器根目录）',
    'Set ${name} installation folder path (compiler root directory)'
][langIndex];

export const from_disk_desp = [
    '本地磁盘',
    'From Disk'
][langIndex];

export const template_location_desp = [
    '选择一个用于获取模板的位置',
    'Select a location to use to get the template'
][langIndex];

export const from_remote_repo_desp = [
    'Github 模板仓库',
    'From Github template repository'
][langIndex];

export const create_from_template_ok_desp = [
    '已从模板完成项目创建 !',
    'Create from template OK !'
][langIndex];

export const select_a_template_file = [
    '选择此 EIDE 模板文件',
    'select this EIDE template file'
][langIndex];

export const view_str$operation$setToolchainPath = [
    '设置工具链',
    'Configure Toolchain'
][langIndex];

export const view_str$operation$setupUtilTools = [
    '安装实用工具',
    'Setup Utility Tools'
][langIndex];

export const view_str$operation$openSettings = [
    '打开插件设置',
    'Open plug-in Settings'
][langIndex];

export const view_str$operation$onlineHelp = [
    '在线帮助',
    'Online Help'
][langIndex];
export const view_str$operation$onlineHelpTooltip = [
    '访问论坛网页以获取在线帮助',
    'Visit the forum page for online help'
][langIndex];

export const invalid_keil_path = [
    '无效的 Keil {} 安装路径',
    'Invalid Keil {} Setup path'
][langIndex];

export const select_keil_file = [
    '选择要导入的Keil项目文件',
    'Select the Keil project file to import'
][langIndex];

export const select_out_dir = [
    '选择项目的保存位置',
    'Select the save location for the project'
][langIndex];

export const input_project_name = [
    '输入一个要创建的项目名称',
    'Input a project name to create'
][langIndex];

export const view_str$operation$select_prj_type = [
    '选择创建项目的方式',
    'Select how to create a new project'
][langIndex];

export const view_str$operation$name_can_not_be_blank = [
    '名称不能为空',
    'The name cannot be empty'
][langIndex];

export const view_str$operation$name_can_not_have_invalid_char = [
    '名称不能含有特殊字符 &<>()@^|',
    'The name cannot contain special characters: &<>()@^|'
][langIndex];

export const import_project_hit = [
    '导入其他 IDE 的项目, 并完成 EIDE 项目的创建',
    'Import project from other IDE and complete the creation of EIDE project'
][langIndex];

export const create_project = [
    '新建项目',
    'Create Project'
][langIndex];

export const view_str$import_project = [
    '导入项目',
    'Import Project'
][langIndex];

export const create_project_hit = [
    '新建一个 EIDE 项目',
    'Create New EIDE Project'
][langIndex];

export const open_project = [
    '打开项目',
    'Open Project'
][langIndex];

export const open_project_hit = [
    '打开 EIDE 项目',
    'Open EIDE Project'
][langIndex];

export const close_project = [
    '关闭项目',
    'Close Project'
][langIndex];

//-------------MSG Title-------------

export const WARNING = [
    '警告',
    'Warning'
][langIndex];

export const ERROR = [
    '错误',
    'Error'
][langIndex];

export const INFORMATION = [
    '消息',
    'Information'
][langIndex];
