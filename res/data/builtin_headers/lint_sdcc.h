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

// keywords

#define __reentrant
#define __trap
#define __critical
#define __interrupt(x)
#define __using(x)
#define __at(x)
#define __asm__(x)
#define __naked

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

#define __bit   bool
#define __sbit  volatile bool
#define __sfr   volatile unsigned char
#define __sfr16 volatile unsigned short
#define __sfr32 volatile unsigned long
