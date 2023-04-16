import * as vscode from 'vscode';

export interface SimpleUIConfig {

    title: string; // title for this config

    readonly?: boolean;

    iconName?: string;

    viewColumn?: vscode.ViewColumn;

    notTakeFocus?: boolean;

    btns?: {
        'submit'?: SimpleUIBtnInfo;
        'reset'?: SimpleUIBtnInfo;
    };

    items: {
        [key: string]: SimpleUIConfigItem;
    };
};

export interface SimpleUIBtnInfo {

    title: string; // title for button

    hidden?: boolean; // hide this button

    disabled?: boolean; // button is disabled
}

export interface SimpleUIConfigData {

    value: any;

    default: any;
}

export interface SimpleUIConfigItem {

    type: 'input' | 'options' | 'table' | 'text' | 'bool' | 'divider' | 'tag' | 'button';

    attrs: { [key: string]: string | boolean | number };

    name: string; // readable title

    description?: string; // a description for this item

    data: SimpleUIConfigData | 
          SimpleUIConfigData_input | 
          SimpleUIConfigData_options | 
          SimpleUIConfigData_table | 
          SimpleUIConfigData_text | 
          SimpleUIConfigData_boolean |
          SimpleUIConfigData_divider |
          SimpleUIConfigData_tag |
          SimpleUIConfigData_button;
};

// input box
//
// all attrs:
//  - 'singleLine': [bool]      Make it as a single line input box.
//  - 'size':       [number]    Sets the width of the element to a specified number of characters.
//  - 'readonly':   [bool]      When true, the control will be immutable by any user interaction.
//  - 'disabled':   [bool]      Prevents the user from interacting with the button––it cannot be pressed or focused.
//
// attrs only for multi-line input boxs:
//  - 'rows':       [number]    Sizes the component vertically by a number of character rows.
//  - 'resize':     [string]    The resize mode of the component. Options: 'none', 'vertical', 'horizontal', 'both'.
//
export interface SimpleUIConfigData_input extends SimpleUIConfigData {

    value: string;

    default: string;

    placeHolder?: string;
}

// options box
//
// all attrs:
//  - 'disabled': [bool]    Prevents the user from interacting with the button––it cannot be pressed or focused.
//
export interface SimpleUIConfigData_options extends SimpleUIConfigData {

    value: number; // index of enum

    default: number;

    enum: string[];

    enumDescriptions: string[];
}

export interface SimpleUIConfigData_table extends SimpleUIConfigData {

    value: { [col: string]: string }[];

    default: { [col: string]: string }[];
}

// text
//
// all attrs:
//  - 'style':   [string]    CSS style for this element, like: 'font-size: 24px;'
//
export interface SimpleUIConfigData_text extends SimpleUIConfigData {

    subType?: 'raw' | 'code';

    value: string;
}

// boolean
//
// all attrs:
//  - 'readonly': [bool]      When true, the control will be immutable by user interaction.
//  - 'disabled': [bool]      Prevents the user from interacting with the button––it cannot be pressed or focused.
//
export interface SimpleUIConfigData_boolean extends SimpleUIConfigData {

    value: boolean;

    default: boolean;
}

// divider line
//
// all attrs:
//  - 'role': [string]      Indicates the semantic meaning of the divider.
//                          The 'separator' option is the default value and indicates that the divider semantically separates content.
//                          The 'presentation' option indicates that the divider has no semantic value and is for visual presentation only.
//
export interface SimpleUIConfigData_divider extends SimpleUIConfigData {
    // divider not have content
}

export interface SimpleUIConfigData_tag extends SimpleUIConfigData {

    value: string;
}

// button
//
// all attrs:
//  - 'disabled':   [bool]      Prevents the user from interacting with the button––it cannot be pressed or focused.
//  - 'appearance': [string]    Determines the visual appearance (primary, secondary) of the button.
//
export interface SimpleUIConfigData_button extends SimpleUIConfigData {

    clickEvent: string; // a message will be emit when button has been clicked
}
