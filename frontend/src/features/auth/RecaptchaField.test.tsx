import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RecaptchaField from './RecaptchaField'

vi.mock('react-google-recaptcha', () => ({
  default: () => <div data-testid="captcha">I'm not a robot</div>,
}))

const props = {
  enabled: true,
  siteKey: 'saved-site-key',
  onChange: vi.fn(),
  recaptchaRef: { current: null },
}

describe('CAPTCHA field errors', () => {
  it('renders Invalid CAPTCHA directly after the checkbox with an accessible alert', () => {
    const html = renderToStaticMarkup(<RecaptchaField {...props} error="Invalid CAPTCHA" />)
    expect(html).toMatch(
      /I&#x27;m not a robot<\/div><span[^>]*role="alert">Invalid CAPTCHA<\/span>/,
    )
  })

  it('renders expiry and availability messages without replacing them', () => {
    for (const error of [
      'Your verification expired. Please try again.',
      "We couldn't verify you right now. Please try again.",
    ]) {
      expect(renderToStaticMarkup(<RecaptchaField {...props} error={error} />)).toContain(
        error.replaceAll("'", '&#x27;'),
      )
    }
  })

  it('does not show an error after verification succeeds or CAPTCHA is disabled', () => {
    expect(renderToStaticMarkup(<RecaptchaField {...props} />)).not.toContain('role="alert"')
    expect(
      renderToStaticMarkup(<RecaptchaField {...props} enabled={false} error="Invalid CAPTCHA" />),
    ).toBe('')
  })
})
