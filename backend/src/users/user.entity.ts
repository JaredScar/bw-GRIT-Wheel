import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../auth/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /**
   * Google profile picture URL, refreshed on each sign-in. Only ever populated for
   * people who have actually signed in — nominees are free text on the nomination,
   * so most of them will have no row here and fall back to initials.
   */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  pictureUrl: string | null;

  @Column({ type: 'simple-array', default: Role.User })
  roles: Role[];

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
