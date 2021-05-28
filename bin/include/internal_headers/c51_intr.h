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

// compiler flags
#ifdef __SDCC

// keywords
#define __reentrant
#define __trap
#define __critical
#define __interrupt(x)
#define __using(x)
#define __at(x)
#define __asm__(x)

// for pic
#define __wparam
#define __shadowregs

// storage type
#define __data
#define __idata
#define __pdata
#define __xdata
#define __code
#define __far
#define __near

// internal value type
typedef __bit __bit;
typedef __sbit __sbit;
typedef __sfr __sfr;
typedef __sfr16 __sfr16;
typedef __sfr32 __sfr32;

#else // Keil C51

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
typedef bit bit;
typedef sbit sbit;
typedef sfr sfr;
typedef sfr16 sfr16;
typedef sfr32 sfr32;

#endif
