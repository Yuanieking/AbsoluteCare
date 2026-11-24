import { createContext, useContext } from 'react'

/** Server-side validation messages for the open settings section, keyed by field name. */
export const SettingsFieldErrorsContext = createContext({})

export function useSettingsFieldError(field) {
  const errors = useContext(SettingsFieldErrorsContext)
  return field ? errors[field] : undefined
}
