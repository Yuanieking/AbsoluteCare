import {
  Children,
  cloneElement,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'

export const CHART_CLIP_PASSTHROUGH = '__chartClipPassthrough' as const

export function isChartClipPassthrough(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    (type as { [CHART_CLIP_PASSTHROUGH]?: boolean })[CHART_CLIP_PASSTHROUGH] === true
  )
}

const REACT_LAZY_TYPE = Symbol.for('react.lazy')

interface LazyComponentType {
  $$typeof: symbol
  _init: (payload: unknown) => unknown
  _payload: unknown
}

function isLazyComponentType(type: unknown): type is LazyComponentType {
  return (
    typeof type === 'object' &&
    type !== null &&
    (type as { $$typeof?: unknown }).$$typeof === REACT_LAZY_TYPE &&
    typeof (type as { _init?: unknown })._init === 'function'
  )
}

export function resolveLazyChartChild(child: ReactElement): ReactElement {
  const type: unknown = child.type
  if (!isLazyComponentType(type)) {
    return child
  }
  let resolved: unknown
  try {
    resolved = type._init(type._payload)
  } catch {
    return child
  }
  if (typeof resolved !== 'function' && !(typeof resolved === 'object' && resolved !== null)) {
    return child
  }
  return createElement(resolved as Parameters<typeof createElement>[0], {
    ...(child.props as object),
    ...(child.key == null ? {} : { key: child.key }),
  })
}

export function resolveChartChildElement(child: ReactElement): ReactElement {
  const element = resolveLazyChartChild(child)
  if (isChartClipPassthrough(element.type)) {
    const inner = (element.props as { children?: unknown }).children
    if (isValidElement(inner)) {
      return resolveChartChildElement(inner)
    }
  }
  return element
}

export function renderableChartChild(child: ReactElement): ReactElement {
  return resolveLazyChartChild(child)
}

export function forEachChartChild(
  children: ReactNode,
  callback: (child: ReactElement, index: number) => void,
) {
  let index = 0
  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return
      }
      if (child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children)
        return
      }
      callback(resolveLazyChartChild(child), index)
      index += 1
    })
  }
  visit(children)
}

const CLIP_EXCLUDED_COMPONENT_NAMES = new Set([
  'Background',
  'Grid',
  'XAxis',
  'YAxis',
  'BarXAxis',
  'BarYAxis',
  'LiveXAxis',
  'LiveYAxis',
])

const UNDERLAY_COMPONENT_NAMES = new Set([
  'ReferenceArea',
  'BarColumnTrack',
  'Weekends',
  'Deadline',
])

export function isPostOverlayComponent(child: ReactElement): boolean {
  const childType = child.type as {
    displayName?: string
    name?: string
    __isChartMarkers?: boolean
    __isPostOverlay?: boolean
  }

  if (childType.__isChartMarkers || childType.__isPostOverlay) {
    return true
  }

  const componentName =
    typeof child.type === 'function' ? childType.displayName || childType.name || '' : ''

  return (
    componentName === 'ChartMarkers' ||
    componentName === 'MarkerGroup' ||
    componentName === 'ChartBrush'
  )
}

export function isUnderlayComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string }
  const componentName =
    typeof child.type === 'function' ? childType.displayName || childType.name || '' : ''
  return UNDERLAY_COMPONENT_NAMES.has(componentName)
}

export function isClipExcludedComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string }
  const componentName =
    typeof child.type === 'function' ? childType.displayName || childType.name || '' : ''
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName)
}

export function renderKeyedChartLayers(children: ReactElement[]) {
  return children.map((child, index) =>
    cloneElement(child, { key: child.key ?? `chart-layer-${index}` }),
  )
}
