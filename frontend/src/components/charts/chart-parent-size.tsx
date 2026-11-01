'use client'

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface ElementSize {
  width: number
  height: number
}

const ZERO_SIZE: ElementSize = { width: 0, height: 0 }

function readElementSize(element: HTMLElement): ElementSize {
  const style = getComputedStyle(element)
  const width = Number.parseFloat(style.width)
  const height = Number.parseFloat(style.height)
  return {
    width: Number.isFinite(width) ? width : element.clientWidth,
    height: Number.isFinite(height) ? height : element.clientHeight,
  }
}

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  debounceTime = 0,
): ElementSize {
  const [size, setSize] = useState<ElementSize>(ZERO_SIZE)

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const apply = () => {
      const next = readElementSize(element)
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next))
    }
    apply()

    if (typeof ResizeObserver === 'undefined') {
      return
    }
    let timeout: ReturnType<typeof setTimeout> | null = null
    let trailing = false
    const observer = new ResizeObserver(() => {
      if (debounceTime <= 0) {
        apply()
        return
      }
      if (timeout !== null) {
        trailing = true
        return
      }
      apply()
      const flush = () => {
        if (trailing) {
          trailing = false
          apply()
          timeout = setTimeout(flush, debounceTime)
          return
        }
        timeout = null
      }
      timeout = setTimeout(flush, debounceTime)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (timeout !== null) {
        clearTimeout(timeout)
      }
    }
  }, [ref, debounceTime])

  return size
}

export interface ChartParentSizeProps {
  children: (size: { width: number; height: number }) => ReactNode
  className?: string
  debounceTime?: number
  style?: CSSProperties
}

export function ParentSize({ children, className, debounceTime, style }: ChartParentSizeProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(parentRef, debounceTime ?? 300)
  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <div ref={parentRef} style={{ position: 'absolute', inset: 0 }}>
        {children({ width, height })}
      </div>
    </div>
  )
}
