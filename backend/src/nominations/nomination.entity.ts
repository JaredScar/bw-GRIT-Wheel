import {
  Column,
  CreateDateColumn,
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

  @OneToMany(() => NominationUpvote, (upvote) => upvote.nomination)
  upvotes: NominationUpvote[];
}
