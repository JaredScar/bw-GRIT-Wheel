export enum GritCategory {
  GRATITUDE = 'GRATITUDE',
  RESPONSIBILITY = 'RESPONSIBILITY',
  INNOVATION = 'INNOVATION',
  TRUST = 'TRUST',
  GRIT = 'GRIT',
}

export const GRIT_CATEGORY_LABELS: Record<GritCategory, string> = {
  [GritCategory.GRATITUDE]: 'Gratitude',
  [GritCategory.RESPONSIBILITY]: 'Responsibility',
  [GritCategory.INNOVATION]: 'Innovation',
  [GritCategory.TRUST]: 'Trust',
  [GritCategory.GRIT]: 'Grit',
};

export const GRIT_CATEGORY_DESCRIPTIONS: Record<GritCategory, string> = {
  [GritCategory.GRATITUDE]:
    'Celebrate contributions, champion the open source community, and cultivate an inclusive environment.',
  [GritCategory.RESPONSIBILITY]:
    'Do the right thing and deliver the best work for Bitwarden customers and each other.',
  [GritCategory.INNOVATION]:
    'Thinking boldly and pursuing creative solutions that push security forward for customers and the community.',
  [GritCategory.TRUST]:
    'Lead with integrity, honesty, and transparency to give every user security confidence.',
  [GritCategory.GRIT]:
    'Showing passion, perseverance, and adaptability to help push Bitwarden forward.',
};

export const GRIT_CATEGORIES: GritCategory[] = [
  GritCategory.GRATITUDE,
  GritCategory.RESPONSIBILITY,
  GritCategory.INNOVATION,
  GritCategory.TRUST,
  GritCategory.GRIT,
];
