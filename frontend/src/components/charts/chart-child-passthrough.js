import { Children, cloneElement, createElement, Fragment, isValidElement } from 'react'

export const CHART_CLIP_PASSTHROUGH = '__chartClipPassthrough'

export function isChartClipPassthrough(type) {
  return typeof type === 'function' && type[CHART_CLIP_PASSTHROUGH] === true
}

const REACT_LAZY_TYPE = Symbol.for('react.lazy')

function isLazyComponentType(type) {
  return (
    typeof type === 'object' &&
    type !== null &&
    type.$$typeof === REACT_LAZY_TYPE &&
    typeof type._init === 'function'
  )
}

export function resolveLazyChartChild(child) {
  const type = child.type
  if (!isLazyComponentType(type)) {
    return child
  }
  let resolved
  try {
    resolved = type._init(type._payload)
  } catch {
    return child
  }
  if (typeof resolved !== 'function' && !(typeof resolved === 'object' && resolved !== null)) {
    return child
  }
  return createElement(resolved, {
    ...child.props,
    ...(child.key == null ? {} : { key: child.key }),
  })
}

export function resolveChartChildElement(child) {
  const element = resolveLazyChartChild(child)
  if (isChartClipPassthrough(element.type)) {
    const inner = element.props.children
    if (isValidElement(inner)) {
      return resolveChartChildElement(inner)
    }
  }
  return element
}

export function renderableChartChild(child) {
  return resolveLazyChartChild(child)
}

export function forEachChartChild(children, callback) {
  let index = 0
  const visit = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return
      }
      if (child.type === Fragment) {
        visit(child.props.children)
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

export function isPostOverlayComponent(child) {
  const childType = child.type

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

export function isUnderlayComponent(child) {
  const childType = child.type
  const componentName =
    typeof child.type === 'function' ? childType.displayName || childType.name || '' : ''
  return UNDERLAY_COMPONENT_NAMES.has(componentName)
}

export function isClipExcludedComponent(child) {
  const childType = child.type
  const componentName =
    typeof child.type === 'function' ? childType.displayName || childType.name || '' : ''
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName)
}

export function renderKeyedChartLayers(children) {
  return children.map((child, index) =>
    cloneElement(child, { key: child.key ?? `chart-layer-${index}` }),
  )
}
