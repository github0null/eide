/***
 * !!! Don't include this file in your project !, it can only be used for code analysis !!! 
*/

#ifndef __VSCODE_CPPTOOL
#error "Don't include this file in your project !, it can only be used for code analysis !"
#endif // !

#ifdef _WIN32
#undef _WIN32
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

// storage type
#define __data
#define __idata
#define __pdata
#define __xdata
#define __code
#define __far
#define __near

// internal value type
typedef struct __bit __bit;
typedef struct __sbit __sbit;
typedef struct __sfr __sfr;
typedef struct __sfr16 __sfr16;
typedef struct __sfr32 __sfr32;

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
typedef struct bit bit;
typedef struct sbit sbit;
typedef struct sfr sfr;
typedef struct sfr16 sfr16;
typedef struct sfr32 sfr32;

#endif
