import { expect, test } from 'vitest'
import { keys } from './keys'

test('list keys include their filters', () => {
  expect(keys.appointments.list({ status: 'confirmed' })).toEqual([
    'appointments',
    'list',
    { status: 'confirmed' },
  ])
  expect(keys.appointments.list()).toEqual(['appointments', 'list', {}])
})

test('detail keys are stringified and distinct per id', () => {
  expect(keys.users.detail(7)).toEqual(['users', 'detail', '7'])
  expect(keys.users.detail(7)).not.toEqual(keys.users.detail(8))
  expect(keys.users.all).toEqual(['users'])
})
