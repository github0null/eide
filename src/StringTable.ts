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

export enum LanguageIndexs {
    Chinese = 0,
    English
}

export const langIndex: number = /zh-cn/.test(vscode.env.language)
    ? LanguageIndexs.Chinese : LanguageIndexs.English;

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

export const view_str$flasher$commandLine = [
    '命令行',
    'Command Line'
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
    '使用自定义的链接脚本',
    'Use Custom Linker Script File'
][langIndex];

export const view_str$compile$scatterFilePath = [
    '链接脚本路径',
    'Linker Script File Path'
][langIndex];

export const view_str$compile$floatingPointHardware = [
    '硬件浮点选项',
    'Hardware Floating-Point Option'
][langIndex];

export const view_str$compile$selectToolchain = [
    '选择一个工具链',
    'Select A Toolchain'
][langIndex];

export const view_str$compile$selectFlasher = [
    '选择一个烧录工具',
    'Select A Flasher'
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
    'Select a folder from disk, eide will link it directly into your project.'
][langIndex];

export const view_str$project$folder_type_virtual = [
    '虚拟文件夹',
    'Virtual Folder'
][langIndex];

export const view_str$project$folder_type_virtual_desc = [
    '新建一个虚拟文件夹（该文件夹在磁盘上是不存在的）来组织源文件的结构',
    'Create a VirtualFolder (The folder does not exist on disk) to organize the source file structure.'
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
    '链接库目录',
    'Library Directories'
][langIndex];

export const source_dir_desc = [
    '源文件目录',
    'Source File Directories'
][langIndex];

export const definition_list_desc = [
    '预处理器定义',
    'Preprocessor Definitions'
][langIndex];

export const project_dependence = [
    '项目属性',
    'Project Attributes'
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
    'Set a device for this project'
][langIndex];

export const switch_workspace_hint = [
    '项目加载成功, 是否立即切换工作区 ?',
    'The project load successfully, do you want to switch workspace immediately ?'
][langIndex];

//--------------- env ---------------

/*
                    "desc.task.cmd.env.target_name": "项目名称",
                    "desc.task.cmd.env.project_root": "项目根目录",
                    "desc.task.cmd.env.output_dir": "编译输出目录",
                    "desc.task.cmd.env.builer_folder": "构建器可执行文件目录",
                    "desc.task.cmd.env.toolchain_root": "工具链根目录",
                    "desc.task.cmd.env.compiler_prefix": "编译器前缀，例如：arm-none-eabi-",
                    "desc.task.cmd.env.compiler_folder": "编译器可执行文件目录",

                    "desc.task.cmd.env.target_name": "Project name",
                    "desc.task.cmd.env.project_root": "Project root folder",
                    "desc.task.cmd.env.output_dir": "Build output folder",
                    "desc.task.cmd.env.builer_folder": "Builder executable file's folder",
                    "desc.task.cmd.env.toolchain_root": "Toolchain root folder",
                    "desc.task.cmd.env.compiler_prefix": "Compiler prefix, like: arm-none-eabi-",
                    "desc.task.cmd.env.compiler_folder": "Compiler executable file's folder",
*/

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
    `编译器前缀，例如：arm-none-eabi-`,
    `Compiler prefix, like: arm-none-eabi-`
][langIndex];

export const view_str$env_desc$compiler_folder = [
    `编译器可执行文件目录`,
    `Compiler executable file's folder`
][langIndex];

//---------------Other---------------

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
    `无法找到编译器 '{}' 的安装位置 ！`,
    `Not found the compiler '{}' location !`
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
    '项目加载失败 !',
    'Project Load Failed !'
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

//---------------Select string------------------

export const later_text = [
    '稍后',
    'Later on'
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

export const view_str$operation$empty_anygcc_prj = [
    '通用的 GCC 项目',
    'Universal GCC Project'
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
    '设置 Keil_C51 的 TOOLS.INI 路径',
    'Set Keil_C51\'s \'TOOLS.INI\' path'
][langIndex];

export const view_str$operation$setMDKPath = [
    '设置 MDK 的 TOOLS.INI 路径',
    'Set MDK\'s \'TOOLS.INI\' path'
][langIndex];

export const view_str$operation$setToolchainInstallDir = [
    '设置 ${name} 的安装目录路径',
    'Set ${name} installation folder path'
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
    'New Project'
][langIndex];

export const view_str$import_project = [
    '导入项目',
    'Import Project'
][langIndex];

export const create_project_hit = [
    '新建一个 EIDE 项目',
    'Create a new EIDE project'
][langIndex];

export const open_project = [
    '打开项目',
    'Open Project'
][langIndex];

export const open_project_hit = [
    '打开 EIDE 项目',
    'Open a EIDE project'
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
