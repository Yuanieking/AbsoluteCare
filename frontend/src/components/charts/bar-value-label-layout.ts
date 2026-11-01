export type BarValueLabelOrientation = 'auto' | 'horizontal' | 'vertical'
export type BarValueLabelPosition = 'top' | 'center' | 'bottom'

const LABEL_LINE_HEIGHT = 12
const LABEL_INSET = 6
const MIN_CROSS_SIZE = LABEL_LINE_HEIGHT + 6

export function getBarValueLabelLayout({
  x,
  y,
  width,
  height,
  labelWidth,
  isHorizontal,
  orientation,
  position,
}: {
  x: number
  y: number
  width: number
  height: number
  labelWidth: number
  isHorizontal: boolean
  orientation: BarValueLabelOrientation
  position: BarValueLabelPosition
}) {
  const normalFits = width >= labelWidth + 10 && height >= MIN_CROSS_SIZE
  const rotatedFits = height >= labelWidth + 10 && width >= MIN_CROSS_SIZE
  let fits = normalFits || rotatedFits
  if (orientation === 'horizontal') {
    fits = normalFits
  } else if (orientation === 'vertical') {
    fits = rotatedFits
  }

  const rotated = fits && (orientation === 'vertical' || (orientation === 'auto' && !normalFits))
  const extentX = rotated ? LABEL_LINE_HEIGHT : labelWidth
  const extentY = rotated ? labelWidth : LABEL_LINE_HEIGHT

  let labelX = x + width / 2
  let labelY = y + height / 2
  if (isHorizontal) {
    if (position === 'top') {
      labelX = x + width - LABEL_INSET - extentX / 2
    } else if (position === 'bottom') {
      labelX = x + LABEL_INSET + extentX / 2
    }
  } else if (position === 'top') {
    labelY = y + LABEL_INSET + extentY / 2
  } else if (position === 'bottom') {
    labelY = y + height - LABEL_INSET - extentY / 2
  }

  return { fits, rotated, x: labelX, y: labelY }
}
