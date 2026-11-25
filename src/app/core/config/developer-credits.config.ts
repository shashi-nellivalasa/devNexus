/**
 * Product version shown in the dashboard hero, footer, and related UI.
 * Keep `version` in sync with `package.json` when you cut a release.
 */
export const DEVELOPER_CREDITS = {
  productName: 'DevNexus',
  version: '1.0.0',
  developerName: 'Shashi Nellivalasa',
  /** Copyright + registration / legal notice shown in the site footer. */
  registrationNotice: '© 2026 DevNexus. All rights reserved.',
  githubUrl: 'https://github.com/shashi-nellivalasa',
  linkedInUrl: 'https://www.linkedin.com/in/shashi-nellivalasa',
  licenseName: 'MIT License',
  licenseUrl: 'https://opensource.org/license/mit'
} as const;

export type DeveloperCredits = typeof DEVELOPER_CREDITS;