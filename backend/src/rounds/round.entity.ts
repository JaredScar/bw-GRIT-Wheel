import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Nomination } from '../nominations/nomination.entity';

export enum RoundStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum WheelMode {
  EQUAL = 'EQUAL',
  WEIGHTED = 'WEIGHTED',
}

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'date', nullable: true })
  eventDate: string | null;

  @Column({ type: 'varchar', default: RoundStatus.OPEN })
  status: RoundStatus;

  @Column({ type: 'varchar', nullable: true })
  winnerNominationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  winnerNomineeName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  spunAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  wheelMode: WheelMode | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Nomination, (nomination) => nomination.round)
  nominations: Nomination[];
}
