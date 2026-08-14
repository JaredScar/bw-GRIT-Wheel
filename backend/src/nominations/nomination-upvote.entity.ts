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

@Entity('nomination_upvotes')
@Unique(['nominationId', 'voterEmail'])
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
