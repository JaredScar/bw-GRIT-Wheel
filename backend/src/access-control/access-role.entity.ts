import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.enum';

/**
 * A named permission set that admins assign to accounts. Every non-admin account resolves
 * its capabilities through exactly one of these; admins bypass them.
 */
@Entity('access_roles')
export class AccessRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', length: 280, nullable: true })
  description: string | null;

  /**
   * `simple-array` stores this as comma-joined text; an empty array round-trips as ''.
   * Always read through `sanitizePermissions()` so a stale value can't leak through.
   */
  @Column({ type: 'simple-array', default: '' })
  permissions: Permission[];

  /** The role new accounts are created with. Exactly one row has this set. */
  @Column({ default: false })
  isDefault: boolean;

  /**
   * Seeded roles. Their permissions are still editable — admins just can't delete them,
   * so there's always somewhere to move people when a custom role is removed.
   */
  @Column({ default: false })
  isSystem: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
