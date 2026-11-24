import { describe, expect, it } from 'vitest'
import { describeChange } from './auditFormat'

describe('describeChange', () => {
  it('keeps simple values readable', () => {
    expect(describeChange('a@b.test', 'c@d.test')).toEqual(['a@b.test → c@d.test'])
    expect(describeChange(false, true)).toEqual(['Off → On'])
  })

  it('diffs nested permission objects leaf by leaf', () => {
    const before = { secretary: { reports: { read: true, create: false } } }
    const after = { secretary: { reports: { read: true, create: true } } }
    expect(describeChange(before, after)).toEqual(['secretary · reports · create: Off → On'])
  })

  it('never prints [object Object]', () => {
    const lines = describeChange({ a: { b: 1 } }, { a: { b: 2 }, c: ['x', 'y'] })
    expect(lines.join(' ')).not.toContain('[object Object]')
    expect(lines).toContain('c: — → x, y')
  })
})
