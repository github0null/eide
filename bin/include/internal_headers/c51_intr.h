/***
 * !!! Don't include this file in your project !, it can only be used for code analysis !!! 
*/

#ifndef __VSCODE_CPPTOOL
#error "Don't include this file in your project !, it can only be used for code analysis !"
#endif // !

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

// storage type
#define __data
#define __idata
#define __pdata
#define __xdata
#define __code
#define __far
#define __near

// internal value type
typedef char __bit;
typedef char __sbit;
typedef char __sfr;
typedef int __sfr16;
typedef int __sfr32;

#else // Keil C51

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
typedef char bit;
typedef char sbit;
typedef char sfr;
typedef int sfr16;
typedef int sfr32;

#endif
