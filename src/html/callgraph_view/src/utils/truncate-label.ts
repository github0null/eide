/** 下拉/列表展示用：过长文本截断并保留完整字符串供 title 使用 */
export function truncateLabel(text: string, maxLen = 36): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen - 1)}…`;
}
