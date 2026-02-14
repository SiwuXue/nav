// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav
import { signal, computed } from '@angular/core'
import dbJson from '../../data/db.json'
import searchJson from '../../data/search.json'
import settingsJson from '../../data/settings.json'
import tagJson from '../../data/tag.json'
import internalJson from '../../data/internal.json'
import componentJson from '../../data/component.json'
import type {
  ISettings,
  ISearchProps,
  ISearchItemProps,
  ITagProp,
  InternalProps,
  ITagPropValues,
  INavProps,
  IComponentProps,
} from 'src/types'
import { isSelfDevelop } from 'src/utils/utils'

const builtinSearchList: ISearchItemProps[] = [
  {
    name: '百度',
    url: 'https://www.baidu.com/s?wd=${q}',
    icon: 'https://www.baidu.com/favicon.ico',
    placeholder: '输入关键词，百度一下',
    blocked: false,
    isInner: false,
  },
  {
    name: 'Google',
    url: 'https://www.google.com/search?q=${q}',
    icon: 'https://www.google.com/favicon.ico',
    placeholder: 'Search with Google',
    blocked: false,
    isInner: false,
  },
  {
    name: '必应',
    url: 'https://www.bing.com/search?q=${q}',
    icon: 'https://www.bing.com/favicon.ico',
    placeholder: '输入搜索内容',
    blocked: false,
    isInner: false,
  },
  {
    name: '搜狗',
    url: 'https://www.sogou.com/web?query=${q}',
    icon: 'https://www.sogou.com/favicon.ico',
    placeholder: '搜狗搜索',
    blocked: false,
    isInner: false,
  },
  {
    name: '360 搜索',
    url: 'https://www.so.com/s?q=${q}',
    icon: 'https://www.so.com/favicon.ico',
    placeholder: '360 搜索',
    blocked: false,
    isInner: false,
  },
]

export function withSearchDefaults(data?: ISearchProps): ISearchProps {
  const base = data || ({} as ISearchProps)
  const list = Array.isArray(base.list) ? base.list.slice() : []
  const nameSet = new Set(list.map((item) => item.name))

  for (const item of builtinSearchList) {
    if (!nameSet.has(item.name)) {
      list.push(item)
    }
  }

  return {
    ...base,
    list,
  }
}

export const settings = signal<ISettings>(settingsJson as ISettings)

export const search = signal<ISearchProps>(
  withSearchDefaults(isSelfDevelop ? ({} as ISearchProps) : searchJson),
)

export const tagList = signal<Array<ITagPropValues>>(
  isSelfDevelop ? [] : tagJson,
)

export const tagMap = computed<ITagProp>(() => {
  const map: ITagProp = {}
  tagList().forEach((item) => {
    if (item.id) {
      map[item.id] = {
        ...item,
      }
    }
  })
  return map
})

export const internal = signal<InternalProps>(internalJson)

export const navs = signal<INavProps[]>(
  isSelfDevelop ? [] : (dbJson as INavProps[]),
)

export const component = signal<IComponentProps>(
  isSelfDevelop ? { zoom: 1, components: [] } : componentJson,
)
