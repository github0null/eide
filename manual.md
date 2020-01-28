# EIDE 使用手册和注意事项

- [目录基本结构](#目录基本结构)
- [使用示例](#使用示例)
    - [stm32闪烁小灯](#stm32闪烁小灯)
- [其他功能](#其他功能)
    - [添加新的源文件目录到搜索列表中](#添加新的源文件目录到搜索列表中)
    - [将一个源文件目录从搜索列表移除, 操作并不会删除目录](#将一个源文件目录从搜索列表移除-操作并不会删除目录)
    - [添加预编译的宏](#添加预编译的宏)

***

### 目录基本结构
![目录结构](./res/preview/dir-struct.png)
- `.EIDE` 项目文件的目录和 EIDE 日志存放的位置
- `dependence` 项目依赖的存放位置, 其中内容由 EIDE 自动添加、创建、管理
- `out` EIDE 默认的输出目录, 编译产生的文件存放在此处
- `pack` ARM 包的安装位置, 用户无需更改此文件夹下的内容
- `src` 源文件的目录, 可以自由选择

> 其他未列出的目录不在 EIDE 的管理范围之内，也不由 EIDE 创建

### 使用示例

### stm32闪烁小灯
- #### 创建项目
<iframe width="720" height="480" src="https://github.com/github0null/eide/tree/master/res/preview/new-1.avi" allowfullscreen="true"></iframe>

- #### 简单调试，使用 stm32-debugger
<iframe width="720" height="480" src="https://github.com/github0null/eide/tree/master/res/preview/debug-1.avi" allowfullscreen="true"></iframe>

### 其他功能
#### 添加新的源文件目录到搜索列表中
![debug prj](./res/preview/add-src-dir.png)
***
#### 将一个源文件目录从搜索列表移除, 操作并不会删除目录
![debug prj](./res/preview/del-src-dir.png)
****
#### 添加预编译的宏
![debug prj](./res/preview/add-macro.png)