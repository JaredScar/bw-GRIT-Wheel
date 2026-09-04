import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccessRole } from '../access-control/access-role.entity';
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
   * Once true, sign-in stops overwriting `name` from the Google profile — otherwise a
   * manually-chosen display name would silently revert the next time they log in.
   */
  @Column({ default: false })
  nameSetByUser: boolean;

  /**
   * Google profile picture URL, refreshed on each sign-in. Only ever populated for
   * people who have actually signed in — nominees are free text on the nomination,
   * so most of them will have no row here and fall back to initials.
   */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  pictureUrl: string | null;

  @Column({ type: 'simple-array', default: Role.User })
  roles: Role[];

  /**
   * The access role granting this account's non-admin permissions. Kept separate from
   * `roles` so admin access (and its ADMIN_EMAILS recovery path) stays independent of
   * whatever admins configure here.
   *
   * Nullable only so a deleted role can't orphan the row; a null resolves to the default
   * role at permission-check time and is backfilled on the next boot.
   */
  @Column({ type: 'uuid', nullable: true })
  accessRoleId: string | null;

  @ManyToOne(() => AccessRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accessRoleId' })
  accessRole: AccessRole | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
