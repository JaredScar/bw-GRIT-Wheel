import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Nomination } from './nomination.entity';
import { ReactionType } from './reaction-type.enum';

// One row per (nomination, voter, reaction type) — a single voter can react to a
// nomination with more than one reaction type, but only once per type.
@Entity('nomination_upvotes')
@Unique(['nominationId', 'voterEmail', 'type'])
export class NominationUpvote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Nomination, (nomination) => nomination.upvotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nominationId' })
  nomination: Nomination;

  @Column()
  nominationId: string;

  @Column()
  voterEmail: string;

  @Column({ type: 'enum', enum: ReactionType, default: ReactionType.THUMBS_UP })
  type: ReactionType;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
