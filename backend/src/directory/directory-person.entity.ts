import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from '../teams/team.entity';

/**
 * The nominate-able roster, imported from a Slack member-list CSV export by an admin.
 * Deliberately separate from `User`: most employees here have never signed into the
 * GRIT app themselves, so there is no session/role/picture data to attach to them.
 */
@Entity('directory_people')
export class DirectoryPerson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, (team) => team.members, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
