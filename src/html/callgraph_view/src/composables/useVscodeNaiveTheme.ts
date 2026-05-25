import { computed, onMounted, onUnmounted, ref } from 'vue';
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui';

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function isDarkBackground(hexOrRgb: string): boolean {
  const s = hexOrRgb.trim();
  if (s.startsWith('#') && s.length >= 7) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return true;
}

function buildOverrides(): GlobalThemeOverrides {
  const bg = readCssVar('--vscode-editor-background', '#1e1e1e');
  const fg = readCssVar('--vscode-editor-foreground', '#d4d4d4');
  const widgetBg = readCssVar('--vscode-editorWidget-background', '#252526');
  const border = readCssVar('--vscode-editorWidget-border', '#3c3c3c');
  const hover = readCssVar('--vscode-list-hoverBackground', '#2a2d2e');
  const activeBg = readCssVar('--vscode-list-activeSelectionBackground', '#094771');
  const activeFg = readCssVar('--vscode-list-activeSelectionForeground', '#ffffff');
  const primary = readCssVar('--vscode-button-background', '#0e639c');
  const primaryHover = readCssVar('--vscode-button-hoverBackground', '#1177bb');
  const inputBg = readCssVar('--vscode-input-background', '#3c3c3c');
  const inputFg = readCssVar('--vscode-input-foreground', '#f0f0f0');
  const placeholder = readCssVar(
    '--vscode-input-placeholderForeground',
    '#cccccc80',
  );
  const sideBarBg = readCssVar('--vscode-sideBar-background', '#252526');
  const checkboxBg = readCssVar(
    '--vscode-settings-checkboxBackground',
    inputBg,
  );
  const checkboxFg = readCssVar(
    '--vscode-settings-checkboxForeground',
    fg,
  );
  const checkboxBorder = readCssVar(
    '--vscode-settings-checkboxBorder',
    border,
  );

  return {
    common: {
      bodyColor: bg,
      cardColor: widgetBg,
      modalColor: widgetBg,
      popoverColor: widgetBg,
      textColorBase: fg,
      textColor1: fg,
      textColor2: fg,
      textColor3: readCssVar('--vscode-descriptionForeground', '#ccccccb3'),
      borderColor: border,
      dividerColor: border,
      hoverColor: hover,
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryHover,
      inputColor: inputBg,
      inputColorDisabled: inputBg,
      placeholderColor: placeholder,
      iconColor: readCssVar('--vscode-icon-foreground', '#cccccc'),
      iconColorHover: fg,
      iconColorPressed: fg,
      iconColorDisabled: placeholder,
    },
    Layout: {
      color: bg,
      siderColor: sideBarBg,
      headerColor: widgetBg,
    },
    Menu: {
      color: sideBarBg,
      itemColor: 'transparent',
      itemColorActive: activeBg,
      itemColorActiveHover: activeBg,
      itemColorHover: hover,
      itemTextColor: fg,
      itemTextColorActive: activeFg,
      itemTextColorHover: fg,
      itemTextColorChildActive: activeFg,
      itemIconColor: fg,
      itemIconColorActive: activeFg,
      itemIconColorHover: fg,
    },
    Select: {
      peers: {
        InternalSelection: {
          textColor: inputFg,
          color: inputBg,
          colorActive: inputBg,
          border: `1px solid ${border}`,
          borderActive: `1px solid ${readCssVar('--vscode-focusBorder', '#007acc')}`,
          borderHover: `1px solid ${border}`,
          borderFocus: `1px solid ${readCssVar('--vscode-focusBorder', '#007acc')}`,
          boxShadowFocus: `0 0 0 1px ${readCssVar('--vscode-focusBorder', '#007acc')}`,
          arrowColor: fg,
        },
        InternalSelectMenu: {
          color: widgetBg,
          optionTextColor: fg,
          optionTextColorActive: activeFg,
          optionColorPending: hover,
          optionColorActive: activeBg,
          optionColorActivePending: activeBg,
        },
      },
    },
    Input: {
      color: inputBg,
      colorFocus: inputBg,
      textColor: inputFg,
      border: `1px solid ${border}`,
      borderHover: `1px solid ${border}`,
      borderFocus: `1px solid ${readCssVar('--vscode-focusBorder', '#007acc')}`,
      boxShadowFocus: `0 0 0 1px ${readCssVar('--vscode-focusBorder', '#007acc')}`,
      placeholderColor: placeholder,
    },
    Button: {
      textColor: readCssVar('--vscode-button-foreground', '#ffffff'),
      color: primary,
      colorHover: primaryHover,
      colorPressed: primaryHover,
      colorFocus: primaryHover,
      border: `1px solid ${border}`,
      borderHover: `1px solid ${border}`,
      borderPressed: `1px solid ${border}`,
      borderFocus: `1px solid ${readCssVar('--vscode-focusBorder', '#007acc')}`,
    },
    Dropdown: {
      color: widgetBg,
      optionTextColor: fg,
      optionTextColorHover: fg,
      optionTextColorActive: activeFg,
      optionColorHover: hover,
      optionColorActive: activeBg,
    },
    Empty: {
      textColor: fg,
      iconColor: readCssVar('--vscode-icon-foreground', '#cccccc'),
      extraTextColor: readCssVar('--vscode-descriptionForeground', '#ccccccb3'),
    },
    Scrollbar: {
      color: readCssVar(
        '--vscode-scrollbarSlider-background',
        'rgba(121, 121, 121, 0.4)',
      ),
      colorHover: readCssVar(
        '--vscode-scrollbarSlider-hoverBackground',
        'rgba(100, 100, 100, 0.7)',
      ),
    },
    Spin: {
      color: primary,
      textColor: fg,
    },
    Result: {
      textColor: fg,
      titleTextColor: fg,
    },
    Tooltip: {
      color: widgetBg,
      textColor: fg,
    },
    Checkbox: {
      color: checkboxBg,
      colorChecked: checkboxBg,
      checkMarkColor: checkboxFg,
      border: `1px solid ${checkboxBorder}`,
      borderChecked: `1px solid ${checkboxBorder}`,
      borderFocus: `1px solid ${checkboxBorder}`,
    },
  };
}

export function useVscodeNaiveTheme() {
  const isDark = ref(true);
  const overrides = ref<GlobalThemeOverrides>({});

  const refresh = () => {
    const bg = readCssVar('--vscode-editor-background', '#1e1e1e');
    isDark.value = isDarkBackground(bg);
    overrides.value = buildOverrides();
  };

  let themeObserver: MutationObserver | undefined;

  onMounted(() => {
    refresh();
    requestAnimationFrame(() => refresh());

    themeObserver = new MutationObserver(() => refresh());
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-vscode-theme', 'data-vscode-theme-kind'],
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-vscode-theme', 'data-vscode-theme-kind'],
    });
  });

  onUnmounted(() => {
    themeObserver?.disconnect();
  });

  const theme = computed(() => (isDark.value ? darkTheme : null));

  return { theme, overrides, refresh };
}
