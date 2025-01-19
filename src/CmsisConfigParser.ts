/*
    MIT License

    Copyright (c) 2019 github0null

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

export interface CmsisConfigItemRange {

    start: number;

    end: number;

    step?: number;
};

export interface CmsisConfigItemEnums {

    val: string;

    desc: string;
};

export interface CmsisConfigItemDispInfo {

    operate?: { operator: string, val: number }; // disp val -> real val

    prefix?: string;

    radix?: number;
};

export interface CmsisConfigItem {

    type: string;

    name: string;

    desc: string;

    detail: string[];

    // 映射到 #define XXX 语句的位置
    location?: { start: number, end?: number /* included last line */ };

    line_idx: number;

    // ---

    var_name?: string;

    var_disp_value?: string; // displayed in UI, and will be modified by UI

    var_value: string; // real value to be wrote to file

    var_fmt_value?: string; // value format string

    // --- var attr

    var_def_val?: string;

    var_range?: CmsisConfigItemRange;

    var_enum?: CmsisConfigItemEnums[];

    var_skip_val?: number; // 对于标签 <c> 是跳过的行数，对于标签 <q> <o> <s> 是跳过的项数

    var_mod_bit?: { start: number, end?: number };

    var_len_limit?: number; // only for string

    var_disp_inf: CmsisConfigItemDispInfo;

    // --- gui attr

    css_class?: string;

    // ---

    children: CmsisConfigItem[];
};

export interface CmsisConfiguration {
    items: CmsisConfigItem[];
};

export function parse(lines: string[]): CmsisConfiguration | undefined {

    // rm whitespace for line
    lines = lines.map((line) => line.trimEnd());

    let startIdx = -1, endIdx = -1;
    {
        // The Configuration Wizard section must begin within the first 100 lines of code and must start with the following comment line:
        //  '// <<< Use Configuration Wizard in Context Menu >>>'
        for (let idx = 0; idx < Math.min(200, lines.length); idx++) {
            const line = lines[idx].toLowerCase();
            if (line.indexOf('<<< use configuration wizard in context menu >>>') != -1) {
                startIdx = idx;
                break;
            }
        }

        // The Configuration Wizard section can end with the following optional comment:
        //  '// <<< end of configuration section >>>'
        if (startIdx != -1) {
            for (let idx = startIdx + 1; idx < lines.length; idx++) {
                const line = lines[idx].toLowerCase();
                if (line.indexOf('<<< end of configuration section >>>') != -1) {
                    endIdx = idx;
                    break;
                }
            }
        }
    }

    // check index
    if (startIdx == -1) {
        return undefined; // not found config
    }

    // The Configuration Wizard end tag is OPTIONAL. Some CMSIS devices config files no define.
    // If undefine, the last line is end. 
    if (endIdx == -1) {
        endIdx = lines.length - 1;
    }

    const cmsisConfig: CmsisConfiguration = { items: [] };

    // parser start

    const context: ParserContext = {
        grp_stack: [],
        last_ele: undefined,
        macro_list: [],
        comment_skip_line_count: 0
    };

    for (let index = startIdx + 1; index < endIdx; index++) {

        const cur_grp  = getCurGroup(context);
        const cur_line = lines[index];
        const cur_ele  = context.last_ele;

        // skip some lines for <c> tag
        if (cur_ele?.type == 'code')
            context.comment_skip_line_count++;

        // is a cmsis header start ? 
        if (isCmsisTag(cur_line)) {

            // is a group start ?
            if (fieldMatcher['group'].start.test(cur_line)) {
                const match = fieldMatcher['group'].start.exec(cur_line);
                if (match && match.length > 1) {
                    const nGrp = newItemsGroup();
                    nGrp.name = match[1];
                    context.grp_stack.push(nGrp);
                    cur_grp ? cur_grp.children.push(nGrp) : cmsisConfig.items.push(nGrp);
                    continue; // go next line
                }
            }
            // is group end tag ?
            else if (cur_grp && fieldMatcher[cur_grp.type] && fieldMatcher[cur_grp.type].end?.test(cur_line)) {
                context.grp_stack.pop();
                context.last_ele = undefined;
                continue; // go next line
            }

            // 检查是否处于 <c> 标签的内容范围内
            let is_in_code_region = false;
            if (cur_ele?.type == 'code') {
                // 将被跳过的行不属于 <c> 的内容文本
                if (cur_ele.var_skip_val && cur_ele.var_skip_val >= context.comment_skip_line_count)
                    is_in_code_region = false;
                else
                    is_in_code_region = true;
            }

            // is a new element (skip parse '//' comment for code type)
            if (!is_in_code_region) {

                let validElement = false;

                for (const fieldType in fieldMatcher) {
                    const match = fieldMatcher[fieldType].start.exec(cur_line);
                    if (match && match.length > 1) {
                        if (fieldType == 'group') { // this node is a group
                            const nGrp = newItemsGroup();
                            nGrp.name = match[1];
                            context.grp_stack.push(nGrp);
                            cur_grp ? cur_grp.children.push(nGrp) : cmsisConfig.items.push(nGrp);
                            context.comment_skip_line_count = 0;
                            validElement = true;
                            break;
                        } else { // this node is a element
                            const newItem = parseElement(cur_line, fieldType, match, context);
                            if (newItem) {
                                newItem.line_idx = index;
                                context.last_ele = newItem;
                                cur_grp ? cur_grp.children.push(newItem) : cmsisConfig.items.push(newItem);
                                context.comment_skip_line_count = 0;
                                validElement = true;
                                // if this element have a END matcher, push it to stack
                                if (fieldMatcher[fieldType].end)
                                    context.grp_stack.push(newItem);
                                break;
                            }
                        }
                    }
                }

                if (validElement)
                    continue; // go next line
            }
        }

        // parse element content
        if (cur_ele) {

            // <c> 标签作特殊处理
            if (cur_ele.type == 'code') {

                // check skip lines
                if (cur_ele.var_skip_val && cur_ele.var_skip_val >= context.comment_skip_line_count)
                    continue;

                if (cur_ele.location == undefined)
                    cur_ele.location = { start: index };
                cur_ele.location.end = index;

                // '!' 表示代码段已被注释，'' 表示取消注释
                cur_ele.var_value = cur_line.trimStart().startsWith('//')
                    ? '!' 
                    : '';
            }
        }

        // 解析宏定义或者赋值语句
        const macroMatcher = /^\s*#define\s+(?<key>\w+)\s*(?<value>.+)?/;
        let match = macroMatcher.exec(cur_line);
        if (!match || match.groups == undefined) {
            if (cur_line.trim().startsWith('//') || 
                cur_line.trim().startsWith('/*'))
                continue; // 跳过注释
            // 匹配赋值表达式：'GPIO.G.redPortMode = A = 1; // ABC'
            const exprMatcher_s = /(?<key>[a-zA-Z_][\w$]*)\s*=/;
            match = exprMatcher_s.exec(cur_line);
            if (!match || match.groups == undefined)
                continue; // 没有匹配到任何 宏定义 或者 赋值语句，则跳过
            const exprMatcher_e = /=(?<value>[^=;]+);/;
            const m = exprMatcher_e.exec(cur_line);
            if (!m || m.groups == undefined)
                continue; // 没有匹配到 赋值 ，则跳过
            match.groups['value'] = m.groups['value'].trim();
        }

        const keyVal = match.groups;
        if (keyVal['value'] == undefined)
            keyVal['value'] = '1'; // 没有显式指定值的，则赋默认值 1

        const macroItem: MacroItem = {
            name: keyVal['key'],
            value: keyVal['value'].trim(),
            line_idx: index,
            line_txt: cur_line,
        };
        context.macro_list.push(macroItem);
    }

    const updateConfigItemValue = (configItem: CmsisConfigItem, macroItem: MacroItem) => {
        configItem.var_value = macroItem.value;
        configItem.location = { start: macroItem.line_idx };
        updateElementDispVal(configItem);
    };

    const findNextMacro = (line_idx: number, skip_count?: number, range?: { start: number, end: number }): MacroItem | undefined => {
        // 使用顺序遍历
        for (let i = 0; i < context.macro_list.length; i++) {
            const macro = context.macro_list[i];
            if (range) {
                if (macro.line_idx < range.start)
                    continue;
                if (macro.line_idx > range.end)
                    return undefined;
            }
            if (macro.line_idx > line_idx)
                return context.macro_list[i + (skip_count || 0)];
        }
    };
    const findNextMacroByName = (name: string, range?: { start: number, end: number }): MacroItem | undefined => {
        return context.macro_list.find((macro) => {
            if (range) {
                if (macro.line_idx < range.start)
                    return false;
                if (macro.line_idx > range.end)
                    return false;
            }
            if (macro.name == name)
                return true;
        });
    };

    //
    // 接下来统一处理所有解析完成的 c defines 和 配置项
    // 为 每个配置项 匹配一个 c defines
    //

    const stk = cmsisConfig.items.map(item => item);
    while (stk.length > 0) {
        const cur_item = <CmsisConfigItem>stk.shift();

        // <h> 标签：仅作为分组，不需要匹配对应的宏定义
        if (cur_item.type == 'group') {
            cur_item.children.forEach(t => stk.push(t));
            continue;
        }

        // <!c> 标签：已经处理过了，不需要匹配对应的宏定义，直接跳过
        if (cur_item.type == 'code')
            continue;

        // <n> 标签是没有值的，因此 location 是它自身
        if (cur_item.type == 'notice') {
            cur_item.location = { start: cur_item.line_idx };
            continue;
        }

        // 为每个配置项查找与之匹配的宏，然后更新配置项的值
        let macroItem: MacroItem | undefined;
        if (cur_item.var_name) { // 如果指定了标识符名字，则必须匹配标识符
            macroItem = findNextMacroByName(cur_item.var_name);
        } else {
            macroItem = findNextMacro(cur_item.line_idx, cur_item.var_skip_val);
        }

        try {
            if (macroItem) {
                updateConfigItemValue(cur_item, macroItem);
            }
            if (!cur_item.location) {
                throw Error(`Error: Not match any C defines, at line ${cur_item.line_idx + 1}`);
            }
        } catch (error) {
            // 对于发生错误的项，GUI标红提示
            cur_item.type = 'notice'; // 强制改为 notice, 避免用户去修改选项值
            cur_item.location = { start: cur_item.line_idx };
            cur_item.name += ' - !!! ' + (<Error>error).message;
            cur_item.detail.push((<Error>error).message);
            cur_item.detail.push((<Error>error).message);
            cur_item.detail.push((<Error>error).message);
            cur_item.css_class = 'err_blink';
        }

        cur_item.children.forEach(t => stk.push(t));
    }

    return cmsisConfig;
}

/////////////////////////////////////////////////////////////////////////////
//                              internal
/////////////////////////////////////////////////////////////////////////////

interface TagMatcher {
    [tag: string]: { start: RegExp, end?: RegExp }
};

interface MacroItem {
    name: string;
    value: string;
    line_idx: number;
    line_txt: string;
};

interface ParserContext {
    grp_stack: CmsisConfigItem[];
    last_ele: CmsisConfigItem | undefined;
    macro_list: MacroItem[];
    comment_skip_line_count: number; // 仅给 <!c> 标签使用
};

// ---

const fieldMatcher: TagMatcher = {
    'group': { start: /^\/\/\s*<h>\s*(?<name>.+)/, end: /^\/\/\s*<\/h>/ },
    'section': { start: /^\/\/\s*<e(?<var_skip_val>\d+)?(?:\.(?<var_mod_bit_s>[\d]+))?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/, end: /^\/\/\s*<\/e>/ },
    'tooltip': { start: /^\/\/\s*<i>\s*(?<detail>.+)\s*$/ },
    'defval': { start: /^\/\/\s*<d>\s*(?<var_def_val>.+)\s*$/ },
    'code': { start: /^\/\/\s*<!?c(?<var_skip_val>\d+)?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/, end: /^\/\/\s*<\/[!]?c>/ },
    'bool': { start: /^\/\/\s*<q(?<var_skip_val>\d+)?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/ },
    'option': { start: /^\/\/\s*<o(?<var_skip_val>\d+)?(?:\.(?<var_mod_bit_s>[\d]+)(?:\.\.(?<var_mod_bit_e>[\d]+))?)?(?: (?<var_name>\w+))?>\s*(?<name>[^<]+)(?<suffix>(?:.*)?)$/i },
    'string': { start: /^\/\/\s*<s(?<var_skip_val>\d+)?(?:\.(?<var_len_limit>[\d]+))?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/ },
    'enums': { start: /^\/\/\s*<(?<enum_val>\w+)=>\s*(?<enum_desc>.+)$/ },
    'notice': { start: /^\/\/\s*<n>\s*(?<name>.+)/ }
};

const likeTagMatcher = /^\/\/\s*</;
function isCmsisTag(str: string): boolean {
    return likeTagMatcher.test(str);
}

const varNameMatcher = /^\s*([\w])\s*/;
function parseVarName(str: string): string | undefined {
    const match = varNameMatcher.exec(str);
    if (match && match.length > 1) return match[1];
}

interface NumberValueInfo {
    num: number;
    isHex?: boolean;
    fmtStr?: string;
}

const numberMatcher = /\b(0x[0-9a-f]+|[\d\.]+)\b/i;
function parseNumber(str: string): NumberValueInfo {
    const m = numberMatcher.exec(str);
    if (m && m.length > 1) {
        const numVal = m[1];
        const isHex = numVal.toLowerCase().startsWith('0x');
        const isFloat = !isHex && numVal.includes('.');
        return {
            num: isFloat ? parseFloat(numVal) : parseInt(numVal, isHex ? 16 : 10),
            isHex: isHex,
            fmtStr: str.replace(numberMatcher, '<num>') // in UI, '<num>' will be replace to real value
        };
    }
    return { num: NaN }
}

function toNumber(numStr: string): number {
    return parseInt(numStr, numStr.toLowerCase().startsWith('0x') ? 16 : 10);
}

function parseEnums(str: string): CmsisConfigItemEnums[] | undefined {
    const lines = str.match(/<\w+=>\s*[^<]+/g)?.map((m) => `// ${m.trim()}`);
    if (!lines) { return undefined }
    const res: CmsisConfigItemEnums[] = [];
    for (const line of lines) {
        const match = fieldMatcher['enums'].start.exec(line);
        if (match && match.groups) {
            res.push({
                val: match.groups['enum_val'],
                desc: match.groups['enum_desc']
            });
        }
    }
    return res;
}

function getCurGroup(context: ParserContext) {
    if (context.grp_stack.length == 0) return undefined;
    return context.grp_stack[context.grp_stack.length - 1];
}

function newConfigItem(): CmsisConfigItem {
    return {
        line_idx: -1,
        name: '',
        type: '',
        desc: '',
        var_value: '',
        detail: [],
        children: [],
        var_disp_inf: {}
    };
}

function newItemsGroup(): CmsisConfigItem {
    const item = newConfigItem();
    item.type = 'group';
    return item;
}

// ---

const subNodeNames = [
    // 这些节点只能依附于一个父节点，作为父节点的属性；它们不能单独存在
    'tooltip', 
    'defval', 
    'enums'
];
const optionPropMatchers = [
    // 一个 <o> 选项后面可能会跟随一些属性，用于描述值的格式或者范围，下面的正则用于匹配它们
    /<(?<var_range_s>\d+|0x[0-9a-f]+)-(?<var_range_e>\d+|0x[0-9a-f]+)(?::(?<var_range_step>\d+|0x[0-9a-f]+))?>/i,
    /<#(?<disp_operator>[\+\-\*\/])(?<disp_operate_val>\d+|0x[0-9a-f]+)>/i,
    /<f\.(?<disp_fmt>[d|h|o|b])>/i
]
function parseElement(line: string, type: string, match: RegExpExecArray, context: ParserContext): CmsisConfigItem | undefined {

    let item: CmsisConfigItem | undefined;

    // 如果这个节点用于描述上一个配置项，则不要新建新配置
    if (subNodeNames.includes(type)) {
        item = context.last_ele;
        if (item == undefined)
            return; // 如果上一个配置项不存在，则直接丢弃
    }
    // 否则，为这个这个节点新建一个新的配置项
    else {
        item = newConfigItem();
        item.type = type;
    }

    // field value
    const keyVal = match.groups || {};

    // set field value
    {
        item.name = keyVal['name'] || item.name;

        item.desc = (keyVal['desc'] || item.desc).trimStart();

        if (keyVal['detail']) item.detail.push(keyVal['detail']);

        item.var_name = (keyVal['var_name'] || item.var_name)?.trimStart();

        item.var_value = (keyVal['var_value'] || item.var_value).trimStart();

        item.var_def_val = (keyVal['var_def_val'] || item.var_def_val)?.trimStart();

        // parse props for 'option' field
        if (item.type == 'option') {
            // desc
            item.desc = (keyVal['suffix'] || item.desc).trimStart();
            // props
            const suffix = keyVal['suffix'] || ''
            if (suffix) {
                // 配置项与选项写在一行，需要解析选项，如：// <o> USART2_TX Pin <0=>Not Used <1=>PA2 <2=>PD5
                if (/<\w+=>\s*[^<]+/.test(suffix)) {
                    const enums = parseEnums(suffix);
                    if (enums) {
                        if (item.var_enum == undefined)
                            item.var_enum = [];
                        item.var_enum = item.var_enum.concat(enums);
                    }
                }
                // 匹配选项的附加属性
                else {
                    for (const matcher of optionPropMatchers) {
                        const opt_match = matcher.exec(suffix)
                        if (opt_match && opt_match.groups) {
                            for (const key in opt_match.groups) {
                                keyVal[key] = opt_match.groups[key] || keyVal[key]
                            }
                        }
                    }
                }
            }
        }

        if (keyVal['var_range_s'] && keyVal['var_range_e']) {
            item.var_range = { start: toNumber(keyVal['var_range_s']), end: toNumber(keyVal['var_range_e']) };
            if (keyVal['var_range_step']) item.var_range.step = toNumber(keyVal['var_range_step'])
        }

        if (keyVal['enum_val']) {
            if (item.var_enum == undefined) item.var_enum = [];
            const enums = parseEnums(line);
            if (enums) item.var_enum = item.var_enum.concat(enums);
        }

        if (keyVal['var_skip_val']) item.var_skip_val = toNumber(keyVal['var_skip_val']);

        if (keyVal['var_mod_bit_s']) {
            item.var_mod_bit = { start: toNumber(keyVal['var_mod_bit_s']) };
            if (keyVal['var_mod_bit_e']) item.var_mod_bit.end = toNumber(keyVal['var_mod_bit_e']);
        }

        if (keyVal['var_len_limit']) {
            item.var_len_limit = toNumber(keyVal['var_len_limit']);
        }

        if (keyVal['disp_operator'] && keyVal['disp_operate_val']) {
            item.var_disp_inf.operate = {
                operator: keyVal['disp_operator'],
                val: toNumber(keyVal['disp_operate_val'])
            };
        }

        if (keyVal['disp_fmt']) {
            switch (keyVal['disp_fmt']) {
                case 'd': // dec
                    item.var_disp_inf.radix = 10;
                    item.var_disp_inf.prefix = undefined;
                    break;
                case 'h': // hex
                    item.var_disp_inf.radix = 16;
                    item.var_disp_inf.prefix = '0x';
                    break;
                case 'o': // oct
                    item.var_disp_inf.radix = 8;
                    item.var_disp_inf.prefix = '0';
                    break;
                case 'b': // bin
                    item.var_disp_inf.radix = 2;
                    item.var_disp_inf.prefix = '0b';
                    break;
                default:
                    break;
            }
        }
    }

    // 如果这个节点用于描述上一个配置项，那么这个函数仅用于完善上一个配置的值
    // 因此我们应该返回 空
    if (item == context.last_ele)
        return undefined;

    // 如果这个配置项是新建的，则返回它
    return item;
}

function align_hex_val(hex_str: string): string {

    let fmt_len = 1

    for (let index = 0; index < 8; index++) {

        fmt_len <<= 1

        if (fmt_len == hex_str.length) {
            return hex_str
        }
        else if (fmt_len > hex_str.length) {
            let rm_size = fmt_len - hex_str.length
            return `${'0'.repeat(rm_size)}${hex_str}`
        }
    }

    return hex_str
}

function get_mask(start: number, end_?: number): number {

    let end = end_ || start

    let mask_val = 0

    for (let index = 0; index < (end - start) + 1; index++) {
        mask_val <<= 1
        mask_val |= 1
    }

    return mask_val << start
}

function updateElementDispVal(item: CmsisConfigItem) {

    if (item.type == 'section') {

        let { num, isHex, fmtStr } = parseNumber(item.var_value);

        // raw value
        {
            item.var_disp_value = num.toString(); // section is a bool value
            item.var_fmt_value = fmtStr;
        }

        // apply bits
        if (item.var_mod_bit && (!isNaN(num))) {

            item.var_mod_bit.end = undefined // 'section' bits size must be '1'
            let mask = get_mask(item.var_mod_bit.start, item.var_mod_bit.end) >>> item.var_mod_bit.start

            num >>= item.var_mod_bit.start
            num &= mask

            item.var_disp_value = num.toString()
            item.var_fmt_value = fmtStr;
        }
    }

    else if (item.type == 'bool') {

        let { num, isHex, fmtStr } = parseNumber(item.var_value);

        // raw value
        {
            item.var_disp_value = num.toString();
            item.var_fmt_value = fmtStr;
        }
    }

    else if (item.type == 'option') {

        let { num, isHex, fmtStr } = parseNumber(item.var_value);

        // 处理选项的值是非数字的情况
        // 注意：只有使用 <o key-identifier> 标签才能使用非数字的选项值，否则应该抛出错误
        /*
            //   <o TIMESTAMP_SRC>Time Stamp Source
            //      <dwt=>     DWT Cycle Counter
            //      <systick=> SysTick
            //      <user=>    User Timer 
            //   <i>Selects source for 32-bit time stamp
            #define TIMESTAMP_SRC  dwt
        */
        if (isNaN(num)) {
            if (item.var_name && item.var_enum) {
                for (const value of item.var_enum) {
                    if (item.var_value == value.val) {
                        item.var_disp_value = value.val;
                        return;
                    }
                }
            } else {
                const msg = `Syntax Error: Only <o key-identifier> options support non-number option value !\nAt line: ${item.location?.start}`;
                throw Error(msg);
            }
        }

        // normal val
        {
            item.var_disp_value = isHex ? `0x${num.toString(16)}` : num.toString();
            item.var_fmt_value = fmtStr;
        }

        // apply bits
        if (item.var_mod_bit) {

            if (!isNaN(num)) {

                let mask = get_mask(item.var_mod_bit.start, item.var_mod_bit.end) >>> item.var_mod_bit.start

                num >>= item.var_mod_bit.start
                num &= mask

                if (isHex) {
                    num >>>= 0
                    item.var_disp_value = `0x${align_hex_val(num.toString(16))}`
                } else {
                    item.var_disp_value = num.toString()
                }

                item.var_fmt_value = fmtStr;
            }
        }

        // fmt disp val
        if (item.var_disp_inf.operate) {

            let operator = item.var_disp_inf.operate.operator

            switch (operator) {
                case '+':
                    operator = '-'
                    break;
                case '-':
                    operator = '+'
                    break;
                case '*':
                    operator = '/'
                    break;
                case '/':
                    operator = '*'
                    break;
                default:
                    break;
            }

            let var_val = item.var_disp_value || item.var_value;
            let { num, isHex, fmtStr } = parseNumber(var_val);
            let disp_val = eval(`${num}${operator}${item.var_disp_inf.operate.val}`)

            if (typeof (disp_val) == 'string') {
                let { num, isHex, fmtStr } = parseNumber(item.var_value);
                disp_val = num;
            }

            if (typeof (disp_val) != 'number') {
                disp_val = NaN
            }

            if (!isNaN(disp_val)) {

                if (isHex) {
                    disp_val >>>= 0
                    item.var_disp_value = `0x${align_hex_val(disp_val.toString(16))}`
                } else {
                    item.var_disp_value = disp_val.toString()
                }

                item.var_fmt_value = fmtStr;
            }
        }
    }

    // format string
    else if (item.type == 'string') {
        const matcher = /"(.*)"/
        const m = matcher.exec(item.var_value)
        if (m && m.length > 1) {
            item.var_disp_value = m[1];
            item.var_fmt_value = item.var_value.replace(matcher, '"{}"') // in UI, '{}' will be replace to real value
        }
    }
}
