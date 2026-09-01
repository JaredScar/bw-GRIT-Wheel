export enum ReactionType {
  THUMBS_UP = 'THUMBS_UP',
  PARTY = 'PARTY',
  CLAP = 'CLAP',
  STAR = 'STAR',
}

export const REACTION_TYPES: ReactionType[] = [
  ReactionType.THUMBS_UP,
  ReactionType.PARTY,
  ReactionType.CLAP,
  ReactionType.STAR,
];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  [ReactionType.THUMBS_UP]: '👍',
  [ReactionType.PARTY]: '🎉',
  [ReactionType.CLAP]: '👏',
  [ReactionType.STAR]: '⭐',
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  [ReactionType.THUMBS_UP]: 'Agree',
  [ReactionType.PARTY]: 'Celebrate',
  [ReactionType.CLAP]: 'Applaud',
  [ReactionType.STAR]: 'Star',
};
