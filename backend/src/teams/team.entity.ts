import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DirectoryPerson } from '../directory/directory-person.entity';

/** An org-structure grouping of directory people, with an optional manager, used to
 * eventually let managers filter the leaderboard down to their own team. */
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  managerId: string | null;

  @ManyToOne(() => DirectoryPerson, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'managerId' })
  manager: DirectoryPerson | null;

  @OneToMany(() => DirectoryPerson, (person) => person.team)
  members: DirectoryPerson[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
