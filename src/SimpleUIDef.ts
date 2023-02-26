
export interface SimpleUIConfig {

    title: string; // title for this config

    readonly?: boolean;

    iconName?: string;

    items: {
        [key: string]: SimpleUIConfigItem;
    };
};

export interface SimpleUIConfigData {

    value: any;

    default: any;
}

export interface SimpleUIConfigItem {

    type: 'input' | 'options' | 'table' | 'text';

    typeDetail: { [key: string]: string | boolean | number };

    name: string; // readable name

    description?: string; // a description for this item

    data: SimpleUIConfigData | SimpleUIConfigData_input | SimpleUIConfigData_options | SimpleUIConfigData_table;
};

export interface SimpleUIConfigData_input extends SimpleUIConfigData {

    value: string;

    default: string;

    placeHolder?: string;
}

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

export interface SimpleUIConfigData_text extends SimpleUIConfigData {

    value: string;
}
