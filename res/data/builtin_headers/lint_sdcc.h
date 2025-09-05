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

typedef _Bool __bit;
typedef volatile _Bool __sbit;
typedef volatile unsigned char __sfr;
typedef volatile unsigned short __sfr16;
typedef volatile unsigned long __sfr32;

#if defined(__SDCC_GNU_AS)
extern void __delay_cycles(unsigned int x);
#endif
