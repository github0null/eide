import { computed, onMounted, ref } from 'vue';
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

export function useVscodeNaiveTheme() {
  const isDark = ref(true);
  const overrides = ref<GlobalThemeOverrides>({});

  const refresh = () => {
    const bg = readCssVar('--vscode-editor-background', '#1e1e1e');
    const fg = readCssVar('--vscode-editor-foreground', '#d4d4d4');
    const widgetBg = readCssVar('--vscode-editorWidget-background', '#252526');
    const border = readCssVar('--vscode-editorWidget-border', '#3c3c3c');
    const hover = readCssVar('--vscode-list-hoverBackground', '#2a2d2e');
    const primary = readCssVar('--vscode-button-background', '#0e639c');

    isDark.value = isDarkBackground(bg);
    overrides.value = {
      common: {
        bodyColor: bg,
        cardColor: widgetBg,
        modalColor: widgetBg,
        popoverColor: widgetBg,
        textColorBase: fg,
        textColor1: fg,
        textColor2: fg,
        borderColor: border,
        dividerColor: border,
        hoverColor: hover,
        primaryColor: primary,
        primaryColorHover: readCssVar('--vscode-button-hoverBackground', '#1177bb'),
        inputColor: readCssVar('--vscode-input-background', '#3c3c3c'),
        placeholderColor: readCssVar(
          '--vscode-input-placeholderForeground',
          '#cccccc80',
        ),
      },
      Layout: {
        color: bg,
        siderColor: widgetBg,
        headerColor: widgetBg,
      },
      Menu: {
        itemColorActive: hover,
        itemColorActiveHover: hover,
        itemTextColorActive: fg,
      },
    };
  };

  onMounted(() => {
    refresh();
  });

  const theme = computed(() => (isDark.value ? darkTheme : null));

  return { theme, overrides, refresh };
}
