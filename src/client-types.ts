import type * as React from 'react';
import type { createRepositoryManager } from './repositories.js';
import type { state, skillDetail, createSkill, listTrash, listWorkspaces, workspaceSkills } from './core.js';
import type { ImportResult } from './types.js';
export type Translate = (key: string, params?: object) => string;
type Success<T> = T extends {
    error: string;
} ? never : T;
export type ManagerSnapshot = Awaited<ReturnType<typeof state>>;
export type Detail = Success<Awaited<ReturnType<typeof skillDetail>>>;
export type TrashItem = Awaited<ReturnType<typeof listTrash>>[number];
type Manager = ReturnType<typeof createRepositoryManager>;
export type RepositoryRoutes = {
    [K in keyof Manager as K extends 'sources' | 'list' | 'restoreTrash' ? never : `/repositories/${K}`]: Awaited<ReturnType<Manager[K]>>;
};
export type ApiRoutes = RepositoryRoutes & {
    '/repositories': Awaited<ReturnType<Manager['list']>>;
    '/state': ManagerSnapshot;
    '/workspaces': { items: Awaited<ReturnType<typeof listWorkspaces>> };
    '/workspace-skills': Success<Awaited<ReturnType<typeof workspaceSkills>>>;
    '/import': ImportResult;
    '/detail': Detail;
    '/create': Success<Awaited<ReturnType<typeof createSkill>>>;
    '/upload': ImportResult;
    '/delete': unknown;
    '/trash-restore': unknown;
    '/trash-delete': unknown;
    '/enable': unknown;
    '/disable': unknown;
    '/source-enable': unknown;
    '/source-disable': unknown;
    '/category-create': unknown;
    '/category-rename': unknown;
    '/category-delete': unknown;
    '/category-assign': unknown;
    '/category-enable': unknown;
    '/category-disable': unknown;
};
export type ApiCall = <K extends keyof ApiRoutes>(path: K, options?: RequestInit) => Promise<ApiRoutes[K]>;
export interface ModalProps {
    title: string;
    closeLabel: string;
    onClose: () => void;
    children?: React.ReactNode;
    wide?: boolean;
    className?: string;
}
export interface SourceSelectProps {
    value?: string;
    label: string;
    disabled?: boolean;
    action?: boolean;
    icon?: React.ReactNode;
    options: {
        value: string;
        label: React.ReactNode;
        disabled?: boolean;
        danger?: boolean;
    }[];
    onChange: (value: string) => void;
}
export interface SessionSnapshot {
    current?: string;
    ids?: string[];
    byId?: Record<string, {
        retainedBy?: {
            mainView?: unknown;
        };
    }>;
}
export interface SectionProps {
    t: Translate;
    useSessions?: (selector: (snapshot?: SessionSnapshot) => string | undefined) => string | undefined;
}
export interface Filters {
    query: string;
    source: string;
    status: string;
}
export interface ViewProps extends SectionProps {
    sessionId?: string;
    scope: string;
    setScope: React.Dispatch<React.SetStateAction<string>>;
    savedFilters: Record<string, Filters>;
    setSavedFilters: React.Dispatch<React.SetStateAction<Record<string, Filters>>>;
    expanded: Record<string, boolean>;
    setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}
/**
 * 一次 slot 注册的公共选项。
 *
 * slot 专属选项（`main` 的键、`sidebar.panellist` 的位置与文本）由宿主
 * `dsh-client-ui-slots` 的插槽目录声明；这里只登记本插件用到的公共字段。
 */
export interface SlotRegistrationOptions {
    name: string;
    /** 键控插槽（`main`）的面板 id；与侧栏条目的 `id` 取同一值。 */
    key?: string;
    /** 列表插槽（`sidebar.panellist`）的条目 id。 */
    id?: string;
    /** 列表内的升序位置（缺省 0）；宿主按它决定侧栏行先后。 */
    order?: number;
    /** 导航行文本；thunk 在每次投影时重读，因此跟随语言切换。 */
    label?: string | (() => string);
    /** 注册时声明的 locale 命名空间，宿主用它解析 label。 */
    locale: string;
    /** 注入组件的业务 props（宿主渲染该 slot 时合并进标准 props）。 */
    inject?: () => Record<string, unknown>;
}
/** 侧栏面板行交给图标的呈现参数（对应宿主 `SidebarPanelIconOwnerProps`）。 */
export interface SidebarPanelIconProps {
    /** 宿主请求的方形边长（px）。 */
    size: number;
    /** 该面板当前是否显示在中间列。 */
    active: boolean;
}
export interface ClientContext {
    effect: (effect: () => void | (() => void), label?: string) => unknown;
    locale: {
        register: (namespace: string, dictionary: Record<string, Record<string, string>>) => () => void;
        bind: (namespace: string) => Translate;
        /** Public LocaleRuntime snapshot: already resolves locale.preference. */
        getLocale?: () => { active: string };
    };
    slots: {
        inject: (name: string, factory: () => unknown) => unknown;
        register: <P>(options: SlotRegistrationOptions, component: React.ComponentType<P>) => unknown;
    };
}
interface Require {
    (id: 'react'): typeof React;
    (id: 'react-dom'): unknown;
    (id: 'react-dom/client'): unknown;
    (id: 'react/jsx-runtime'): unknown;
}
declare global {
    interface Window {
        __ModuleLoader__: {
            load: (module: {
                id: string;
                factory: (require: Require) => Record<string, unknown>;
            }) => void;
        };
    }
}
/** 文件夹选择器的非标准属性由 Chromium/DSH 提供。 */
declare module 'react' {
    interface InputHTMLAttributes<T> {
        webkitdirectory?: string;
        directory?: string;
    }
}
