declare module 'react-google-recaptcha' {
  import type { Component } from 'react'

  export type RecaptchaProps = {
    sitekey: string
    onChange?: (token: string | null) => void
    onExpired?: () => void
    onErrored?: () => void
    theme?: 'light' | 'dark'
    size?: 'compact' | 'normal' | 'invisible'
    badge?: 'bottomright' | 'bottomleft' | 'inline'
    tabindex?: number
  }

  export default class ReCAPTCHA extends Component<RecaptchaProps> {
    reset(): void
    execute(): Promise<string | null>
    executeAsync(): Promise<string | null>
  }
}
