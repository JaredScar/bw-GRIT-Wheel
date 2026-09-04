import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GritCategory } from '../common/grit-category.enum';
import { Round } from '../rounds/round.entity';
import { NominationUpvote } from './nomination-upvote.entity';

@Entity('nominations')
export class Nomination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nominatorName: string;

  @Column()
  nominatorEmail: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column()
  nomineeName: string;

  @Column()
  nomineeEmail: string;

  // Default lets the auto-sync ALTER TABLE succeed against existing rows on deploy —
  // without it, Postgres rejects adding a NOT NULL array column to a non-empty table.
  @Column('text', { array: true, default: () => "'{}'" })
  gritCategories: GritCategory[];

  @Column({ type: 'text' })
  reason: string;

  @ManyToOne(() => Round, (round) => round.nominations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roundId' })
  round: Round;

  @Column()
  roundId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Set whenever an admin corrects a nomination. Surfaced publicly as an "edited" marker:
  // nominations are public recognition, so a silently rewritten one would be worse than
  // no correction at all.
  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  editedByEmail: string | null;

  // Removal is a soft delete so an admin misclick can't permanently destroy someone's
  // recognition. TypeORM adds `deletedAt IS NULL` to every repository query on this
  // entity automatically, so the feed, wheel, profiles and leaderboard all skip deleted
  // rows without each having to remember to filter.
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedByEmail: string | null;

  @OneToMany(() => NominationUpvote, (upvote) => upvote.nomination)
  upvotes: NominationUpvote[];
}
