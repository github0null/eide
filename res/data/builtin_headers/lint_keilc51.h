/***
 * !!! Don't include this file in your project !, it can only be used for code analysis !!! 
*/

#ifndef __VSCODE_CPPTOOL
#error "Don't include this file in your project !, it can only be used for code analysis !"
#endif // !

#ifdef _WIN32
#undef _WIN32
#endif

#ifdef _MSC_VER
#undef _MSC_VER
#endif

#define __C51__

// keywords

#define interrupt
#define using
#define _at_
#define _priority_
#define _task_

// storage type

#define reentrant
#define compact
#define small
#define large
#define data
#define bdata
#define idata
#define pdata
#define xdata
#define code

// internal value type

typedef _Bool bit;
typedef volatile _Bool sbit;
typedef volatile unsigned char sfr;
typedef volatile unsigned short sfr16;
typedef volatile unsigned long sfr32;
