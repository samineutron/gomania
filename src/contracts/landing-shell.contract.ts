// Contrato público del módulo landing-shell (navegación y marca).
export type ThemeId = 'impacto-rosado' | 'candy-limpio' | 'pop-dual';

export interface SocialLinksDTO {
  tiktok: string;
  instagram: string;
  facebook: string;
  whatsappNumber: string;
  email: string;
}

export interface StoryMilestoneDTO {
  step: number;
  title: string;
  body: string;
}

export interface ILandingConfig {
  defaultTheme: ThemeId;
  socials: SocialLinksDTO;
  story: StoryMilestoneDTO[];
}
